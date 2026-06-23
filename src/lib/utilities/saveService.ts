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
