import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface StoryChoice {
    nextScene: string;
    requiresFlag?: string;
    setsFlag?: string;
}

interface StoryScene {
    id: string;
    isEnding?: boolean;
    choices: StoryChoice[];
}

interface StoryFile {
    startScene: string;
    scenes: StoryScene[];
}

/**
 * Loads a bundled story file by id directly from disk, bypassing the app so
 * tests can reason about its scene graph without depending on rendered text.
 *
 * @param storyId - The id of the story (matches its JSON filename).
 * @returns The parsed story file.
 * @author Claude
 */
const loadStoryFile = ( storyId: string ): StoryFile =>
{
    const path = fileURLToPath( new URL( `../../../src/lib/data/stories/${ storyId }.json`, import.meta.url ) );

    return JSON.parse( readFileSync( path, "utf-8" ) ) as StoryFile;
};

/**
 * Depth-first search mirroring the app's own choice-filtering logic
 * (`getAvailableChoices` in the terminal store): a choice gated behind a flag
 * is skipped until that flag has been set earlier on the path.
 *
 * @param scenesById - Every scene in the story, keyed by id.
 * @param sceneId - The scene currently being explored.
 * @param flags - Flags set so far along this path.
 * @param path - 1-based choice indices taken so far.
 * @param visited - Scene ids already visited on this path (loop guard).
 * @returns The first ending path found from this scene, or `null`.
 * @author Claude
 */
const findEndingFrom = (
    scenesById: Record<string, StoryScene>,
    sceneId: string,
    flags: Set<string>,
    path: number[],
    visited: Set<string>
): number[] | null =>
{
    const scene = scenesById[ sceneId ];
    if ( !scene ) return null;
    if ( scene.isEnding ) return path;
    if ( visited.has( sceneId ) ) return null;

    const nextVisited = new Set( visited );
    nextVisited.add( sceneId );

    const available = scene.choices.filter( ( c ) => !( c.requiresFlag && !flags.has( c.requiresFlag ) ) );

    for ( let i = 0; i < available.length; i++ )
    {
        const choice = available[ i ];
        const nextFlags = new Set( flags );
        if ( choice.setsFlag ) nextFlags.add( choice.setsFlag );

        const result = findEndingFrom( scenesById, choice.nextScene, nextFlags, [ ...path, i + 1 ], nextVisited );
        if ( result ) return result;
    }

    return null;
};

/**
 * Computes a sequence of 1-based choice indices that leads a fresh
 * playthrough of the given story from its opening scene to an ending. The
 * indices match exactly what the UI displays (`[1]`, `[2]`, ...), so a test
 * can drive the story purely by pressing number keys.
 *
 * @param storyId - The id of the story to walk.
 * @returns The ordered choice indices to reach an ending.
 * @throws If no ending is reachable from the opening scene.
 * @author Claude
 */
export const findPathToEnding = ( storyId: string ): number[] =>
{
    const story = loadStoryFile( storyId );
    const scenesById: Record<string, StoryScene> = {};
    for ( const scene of story.scenes ) scenesById[ scene.id ] = scene;

    const path = findEndingFrom( scenesById, story.startScene, new Set(), [], new Set() );
    if ( !path ) throw new Error( `No ending reachable for story "${ storyId }"` );

    return path;
};
