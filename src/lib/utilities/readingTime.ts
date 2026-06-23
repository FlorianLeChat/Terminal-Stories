import type { Story, Scene, Choice, StoryStats } from "$lib/types/story";

/** Average reading speed in words per minute (prose). */
const WORDS_PER_MINUTE = 200;

function countWords( value: string ): number
{
    const trimmed = value.trim();
    if ( trimmed === "" ) return 0;

    return trimmed.split( /\s+/ ).length;
}

function textWords( text: string | string[] ): number
{
    const parts = Array.isArray( text ) ? text : [ text ];

    return parts.reduce( ( sum, t ) => sum + countWords( t ), 0 );
}

/** Words shown when reaching a scene: narration + labels of all offered choices. */
function sceneNarrationWords( scene: Scene ): number
{
    let words = textWords( scene.text );

    for ( const choice of scene.choices )
    {
        words += countWords( choice.text );
    }

    return words;
}

/** Words read when a choice is made: action + consequence. */
function choiceWords( choice: Choice ): number
{
    return countWords( choice.action ) + countWords( choice.consequence );
}

/**
 * Expected number of words for a single playthrough, averaging over the choices
 * available from the start scene. Loops are neutralized via the call stack to
 * avoid double counting.
 */
function expectedWords( story: Story, sceneId: string, memo: Map<string, number>, stack: Set<string> ): number
{
    if ( stack.has( sceneId ) ) return 0;

    const cached = memo.get( sceneId );
    if ( cached !== undefined ) return cached;

    const scene = story.scenes[ sceneId ];
    if ( !scene ) return 0;

    const narration = sceneNarrationWords( scene );

    if ( scene.isEnding || scene.choices.length === 0 )
    {
        memo.set( sceneId, narration );

        return narration;
    }

    stack.add( sceneId );

    let branches = 0;

    for ( const choice of scene.choices )
    {
        branches += choiceWords( choice ) + expectedWords( story, choice.nextScene, memo, stack );
    }

    stack.delete( sceneId );

    const result = narration + branches / scene.choices.length;
    memo.set( sceneId, result );

    return result;
}

/** Total number of words across all the story's content. */
function totalWords( story: Story ): number
{
    let words = 0;

    for ( const scene of Object.values( story.scenes ) )
    {
        words += textWords( scene.text );

        for ( const choice of scene.choices )
        {
            words += countWords( choice.text ) + choiceWords( choice );
        }
    }

    return words;
}

function toMinutes( words: number ): number
{
    return Math.max( 1, Math.round( words / WORDS_PER_MINUTE ) );
}

/** Computes the reading statistics for a story. */
export function computeStoryStats( story: Story ): StoryStats
{
    const scenes = Object.values( story.scenes );
    const endings = scenes.filter( ( s ) => s.isEnding ).length;
    const words = totalWords( story );
    const playthroughWords = expectedWords( story, story.startScene, new Map(), new Set() );

    return {
        scenes: scenes.length,
        endings,
        words,
        minutes: toMinutes( playthroughWords ),
        fullMinutes: toMinutes( words )
    };
}

/** Formats a duration in minutes for display. */
export function formatReadingTime( minutes: number ): string
{
    return `≈ ${ minutes } minutes`;
}
