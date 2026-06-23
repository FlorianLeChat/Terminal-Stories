import type { Story, Scene, Choice, StoryStats } from "$lib/types/story";

/** Average reading speed in words per minute (prose). */
const WORDS_PER_MINUTE = 200;

/**
 * Counts the words in a single string, ignoring surrounding whitespace.
 *
 * @param value - The text to measure.
 * @returns The number of whitespace-separated words.
 * @author Claude
 */
const countWords = ( value: string ): number =>
{
    const trimmed = value.trim();
    if ( trimmed === "" ) return 0;

    return trimmed.split( /\s+/ ).length;
};

/**
 * Counts the words of a scene text, which may be a single string or a list of
 * paragraphs.
 *
 * @param text - The scene text, as stored in the story data.
 * @returns The total number of words across every paragraph.
 * @author Claude
 */
const textWords = ( text: string | string[] ): number =>
{
    const parts = Array.isArray( text ) ? text : [ text ];

    return parts.reduce( ( sum, t ) => sum + countWords( t ), 0 );
};

/**
 * Words shown when reaching a scene: the narration plus the labels of every
 * offered choice (the reader reads all options before deciding).
 *
 * @param scene - The scene being displayed.
 * @returns The number of words read upon arriving on the scene.
 * @author Claude
 */
const sceneNarrationWords = ( scene: Scene ): number =>
{
    let words = textWords( scene.text );

    // The player reads every choice label, not only the one they pick.
    for ( const choice of scene.choices )
    {
        words += countWords( choice.text );
    }

    return words;
};

/**
 * Words read once a choice is committed: its action and its consequence.
 *
 * @param choice - The chosen branch.
 * @returns The number of words revealed after picking the choice.
 * @author Claude
 */
const choiceWords = ( choice: Choice ): number =>
{
    return countWords( choice.action ) + countWords( choice.consequence );
};

/**
 * Expected number of words for a single playthrough, averaging over the choices
 * available from a given scene. Loops are neutralized via the call stack so a
 * scene already on the current path is not counted twice, and results are
 * memoized to keep the traversal linear on shared sub-paths.
 *
 * @param story - The story whose scene graph is being traversed.
 * @param sceneId - The scene to evaluate.
 * @param memo - Cache of already-computed expected word counts per scene.
 * @param stack - Scenes currently on the traversal path (cycle guard).
 * @returns The expected word count from this scene to an ending.
 * @author Claude
 */
const expectedWords = ( story: Story, sceneId: string, memo: Map<string, number>, stack: Set<string> ): number =>
{
    // Scene already on the current path: stop here to avoid counting a loop.
    if ( stack.has( sceneId ) ) return 0;

    const cached = memo.get( sceneId );
    if ( cached !== undefined ) return cached;

    const scene = story.scenes[ sceneId ];
    if ( !scene ) return 0;

    const narration = sceneNarrationWords( scene );

    // Endings (or dead ends) contribute only their narration.
    const isTerminal = scene.isEnding || scene.choices.length === 0;

    if ( isTerminal )
    {
        memo.set( sceneId, narration );

        return narration;
    }

    stack.add( sceneId );

    // Sum each branch, then average: a single playthrough follows one choice.
    let branches = 0;

    for ( const choice of scene.choices )
    {
        branches += choiceWords( choice ) + expectedWords( story, choice.nextScene, memo, stack );
    }

    stack.delete( sceneId );

    const result = narration + branches / scene.choices.length;
    memo.set( sceneId, result );

    return result;
};

/**
 * Total number of words across every scene of the story, regardless of the
 * path taken. Represents a completionist read of all the content.
 *
 * @param story - The story to measure.
 * @returns The full word count of all scenes and choices.
 * @author Claude
 */
const totalWords = ( story: Story ): number =>
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
};

/**
 * Converts a word count to a reading time in minutes, never below one minute.
 *
 * @param words - The number of words to read.
 * @returns The rounded reading time in minutes (minimum 1).
 * @author Claude
 */
const toMinutes = ( words: number ): number =>
{
    return Math.max( 1, Math.round( words / WORDS_PER_MINUTE ) );
};

/**
 * Computes the reading statistics of a story: number of scenes ("entries") and
 * endings, total word count, the estimated time for a single playthrough, and
 * the time required to explore all of the content.
 *
 * @param story - The story to analyze.
 * @returns The aggregated reading statistics.
 * @author Claude
 */
export const computeStoryStats = ( story: Story ): StoryStats =>
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
};

/**
 * Formats a duration in minutes for display in the UI.
 *
 * @param minutes - The duration in minutes.
 * @returns A human-readable label such as "≈ 5 min".
 * @author Claude
 */
export const formatReadingTime = ( minutes: number ): string =>
{
    return `≈ ${ minutes } min`;
};
