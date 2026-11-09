import type { Story } from "#lib/types/story.ts";

/** One choice offered at a step of the path, as the reader saw it. */
export interface EndingPathChoice {
    /** Text of the choice. */
    text: string;
    /** Whether the reader picked this choice. */
    isPicked: boolean;
    /** Whether this (discarded) choice can still lead to an ending not yet found. */
    leadsToUnfoundEnding: boolean;
}

/** One branching point of the path: the choices offered and the one taken. */
export interface EndingPathStep {
    /** Id of the scene where the choice was made. */
    sceneId: string;
    /** Choices that were available at that point, in display order. */
    choices: EndingPathChoice[];
}

/**
 * Lists every ending reachable from a scene by following choices, ignoring
 * flags (a gated branch still counts as a way to reach its endings).
 *
 * @param story - The story whose scene graph is walked.
 * @param startSceneId - The scene to start from.
 * @returns The ids of the reachable ending scenes.
 * @author Claude
 */
const reachableEndings = ( story: Story, startSceneId: string ): Set<string> =>
{
    const endings = new Set<string>();
    const visited = new Set<string>();
    const queue = [ startSceneId ];

    while ( queue.length > 0 )
    {
        const sceneId = queue.shift() as string;

        // Loop guard: stories may contain cycles between scenes.
        if ( visited.has( sceneId ) ) continue;
        visited.add( sceneId );

        const scene = story.scenes[ sceneId ];
        if ( !scene ) continue;

        if ( scene.isEnding ) endings.add( sceneId );

        scene.choices.forEach( ( choice ) => queue.push( choice.nextScene ) );
    }

    return endings;
};

/**
 * Rebuilds the path a reader took to an ending: for every scene in the
 * history, the choices that were available (replaying the flags set along the
 * way) and the one picked, i.e. the one leading to the next visited scene.
 * Discarded choices are marked when they can still lead to an ending the
 * reader has not found yet.
 *
 * @param story - The story being played.
 * @param history - Ids of the scenes visited before the ending, in order.
 * @param endingSceneId - Id of the ending scene just reached.
 * @param discoveredEndings - Ending ids already found, including this one.
 * @returns One step per branching point, in reading order.
 * @author Claude
 */
export const buildEndingPath = (
    story: Story,
    history: string[],
    endingSceneId: string,
    discoveredEndings: Set<string>
): EndingPathStep[] =>
{
    const flags = new Set<string>();
    const steps: EndingPathStep[] = [];

    const unfoundCache = new Map<string, boolean>();

    /**
     * Tells whether a scene can still lead to an ending not found yet. Memoized
     * per scene, since the same branch often appears on many steps.
     *
     * @param sceneId - The scene a discarded choice leads to.
     * @returns True when an unfound ending is reachable from it.
     * @author Claude
     */
    const leadsToUnfoundEnding = ( sceneId: string ): boolean =>
    {
        const cached = unfoundCache.get( sceneId );
        if ( cached !== undefined ) return cached;

        const endings = [ ...reachableEndings( story, sceneId ) ];
        const hasUnfound = endings.some( ( id ) => !discoveredEndings.has( id ) );

        unfoundCache.set( sceneId, hasUnfound );

        return hasUnfound;
    };

    history.forEach( ( sceneId, index ) =>
    {
        const scene = story.scenes[ sceneId ];
        if ( !scene ) return;

        const nextSceneId = history[ index + 1 ] ?? endingSceneId;
        const available = scene.choices.filter( ( c ) => !c.requiresFlag || flags.has( c.requiresFlag ) );
        const picked = available.find( ( c ) => c.nextScene === nextSceneId );

        if ( picked?.setsFlag ) flags.add( picked.setsFlag );

        const choices = available.map( ( choice ): EndingPathChoice =>
        {
            const isPicked = choice === picked;

            return {
                text: choice.text,
                isPicked,
                leadsToUnfoundEnding: !isPicked && leadsToUnfoundEnding( choice.nextScene )
            };
        } );

        steps.push( { sceneId, choices } );
    } );

    return steps;
};
