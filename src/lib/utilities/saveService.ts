import type { GameState } from "$lib/types/story";

export interface SaveData
{
    storyId: string;
    currentScene: string;
    flags: string[];
    history: string[];
    timestamp: number;
}

/**
 * Builds the localStorage key for a given story's save slot.
 *
 * @param storyId - The story identifier.
 * @returns The namespaced key string.
 * @author Claude
 */
const saveKey = ( storyId: string ): string => `terminal-stories:save:${ storyId }`;

/**
 * Persists the current game state to localStorage. No-ops in SSR environments.
 *
 * @param gameState - The game state to persist.
 * @author Claude
 */
export const saveProgress = ( gameState: GameState ): void =>
{
    if ( globalThis.window === undefined ) return;

    const data: SaveData = {
        storyId: gameState.storyId,
        currentScene: gameState.currentScene,
        flags: Array.from( gameState.flags ),
        history: gameState.history,
        timestamp: Date.now()
    };

    localStorage.setItem( saveKey( gameState.storyId ), JSON.stringify( data ) );
};

/**
 * Reads a saved game state from localStorage for the given story.
 *
 * @param storyId - The story whose save slot to read.
 * @returns The saved data, or `null` if absent or unreadable.
 * @author Claude
 */
export const loadSave = ( storyId: string ): SaveData | null =>
{
    if ( globalThis.window === undefined ) return null;

    const raw = localStorage.getItem( saveKey( storyId ) );
    if ( !raw ) return null;

    try
    {
        return JSON.parse( raw ) as SaveData;
    }
    catch
    {
        return null;
    }
};

/**
 * Removes the save slot for the given story from localStorage.
 *
 * @param storyId - The story whose save slot to erase.
 * @author Claude
 */
export const deleteSave = ( storyId: string ): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.removeItem( saveKey( storyId ) );
};

/**
 * Returns whether a save slot exists for the given story.
 *
 * @param storyId - The story to check.
 * @returns `true` if a save exists, `false` otherwise.
 * @author Claude
 */
export const hasSave = ( storyId: string ): boolean =>
{
    if ( globalThis.window === undefined ) return false;

    return localStorage.getItem( saveKey( storyId ) ) !== null;
};

/**
 * Builds the localStorage key for the set of discovered endings of a story.
 *
 * @param storyId - The story identifier.
 * @returns The namespaced key string.
 * @author Claude
 */
const endingsKey = ( storyId: string ): string => `terminal-stories:endings:${ storyId }`;

/**
 * Loads the set of discovered ending scene IDs for a given story.
 *
 * @param storyId - The story to query.
 * @returns A set of ending scene IDs the player has reached at least once.
 * @author Claude
 */
export const loadDiscoveredEndings = ( storyId: string ): Set<string> =>
{
    if ( globalThis.window === undefined ) return new Set();

    const raw = localStorage.getItem( endingsKey( storyId ) );
    if ( !raw ) return new Set();

    try
    {
        return new Set( JSON.parse( raw ) as string[] );
    }
    catch
    {
        return new Set();
    }
};

/**
 * Marks a single ending scene as discovered and persists the updated set.
 *
 * @param storyId - The story the ending belongs to.
 * @param sceneId - The scene ID of the reached ending.
 * @author Claude
 */
export const saveDiscoveredEnding = ( storyId: string, sceneId: string ): void =>
{
    if ( globalThis.window === undefined ) return;

    const discovered = loadDiscoveredEndings( storyId );
    discovered.add( sceneId );
    localStorage.setItem( endingsKey( storyId ), JSON.stringify( Array.from( discovered ) ) );
};

/**
 * Removes the discovered-endings record for the given story from localStorage,
 * used when a custom story is deleted so no orphaned data lingers.
 *
 * @param storyId - The story whose endings record to erase.
 * @author Claude
 */
export const deleteDiscoveredEndings = ( storyId: string ): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.removeItem( endingsKey( storyId ) );
};
