import { storiesMeta } from "$lib/data";
import { achievements } from "$lib/data/achievements";
import { loadDiscoveredEndings } from "$lib/utilities/saveService";
import type { AchievementContext, AchievementId, UnlockedAchievement } from "$lib/types/achievement";

/** localStorage key holding the set of unlocked achievements (all stories). */
const ACHIEVEMENTS_KEY = "terminal-stories:achievements";

/**
 * Reads the list of unlocked achievements from localStorage. Returns an empty
 * array in SSR environments or when nothing has been unlocked yet.
 *
 * @returns The persisted unlocked achievements, oldest first.
 * @author Claude
 */
export const loadUnlockedAchievements = (): UnlockedAchievement[] =>
{
    if ( globalThis.window === undefined ) return [];

    const raw = localStorage.getItem( ACHIEVEMENTS_KEY );
    if ( !raw ) return [];

    try
    {
        return JSON.parse( raw ) as UnlockedAchievement[];
    }
    catch
    {
        return [];
    }
};

/**
 * Returns whether a given achievement has already been unlocked.
 *
 * @param id - The achievement identifier to test.
 * @returns `true` when the achievement is unlocked, `false` otherwise.
 * @author Claude
 */
export const isUnlocked = ( id: AchievementId ): boolean =>
{
    return loadUnlockedAchievements().some( ( a ) => a.id === id );
};

/**
 * Returns the set of ids the player has unlocked, for quick membership tests.
 *
 * @returns A set of unlocked achievement ids.
 * @author Claude
 */
export const unlockedAchievementIds = (): Set<AchievementId> =>
{
    return new Set( loadUnlockedAchievements().map( ( a ) => a.id ) );
};

/**
 * Counts the distinct catalog stories with at least one discovered ending,
 * always counting `currentStoryId` as completed since the caller reaches this
 * only when an ending of that story was just hit (and not yet persisted).
 *
 * @param currentStoryId - The story whose ending was just reached.
 * @returns The number of stories the player has completed at least once.
 * @author Claude
 */
export const countCompletedStories = ( currentStoryId: string ): number =>
{
    return storiesMeta.filter( ( meta ) =>
    {
        const isCurrent = meta.id === currentStoryId;
        const hasDiscovered = loadDiscoveredEndings( meta.id ).size > 0;

        return isCurrent || hasDiscovered;
    } ).length;
};

/**
 * Counts the catalog stories whose every ending has been discovered. The just
 * reached ending is folded into the current story's discovered set so the tally
 * reflects the moment even before persistence happens.
 *
 * @param currentStoryId - The story whose ending was just reached.
 * @param currentSceneId - The ending scene just reached (folded in for that story).
 * @returns The number of fully completed stories.
 * @author Claude
 */
export const countFullyCompletedStories = ( currentStoryId: string, currentSceneId: string ): number =>
{
    return storiesMeta.filter( ( meta ) =>
    {
        const hasEndings = meta.endingIds.length > 0;
        if ( !hasEndings ) return false;

        const discovered = loadDiscoveredEndings( meta.id );

        // Fold the just reached ending into its own story so the count is current.
        if ( meta.id === currentStoryId ) discovered.add( currentSceneId );

        return meta.endingIds.every( ( endingId ) => discovered.has( endingId ) );
    } ).length;
};

/**
 * Total number of catalog stories, used by the completionist check and the UI.
 */
export const totalStoriesCount = storiesMeta.length;

/**
 * Erases every unlocked achievement from localStorage, restoring a fresh
 * start. No-op in SSR environments.
 *
 * @author Claude
 */
export const resetAchievements = (): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.removeItem( ACHIEVEMENTS_KEY );
};

/**
 * Evaluates every locked achievement against the given context, persists any
 * newly unlocked ones, and returns their ids. Idempotent: already-unlocked
 * achievements are never re-added or re-timestamped.
 *
 * @param context - The fully-resolved evaluation context for this ending.
 * @returns The ids of achievements unlocked by this evaluation (possibly empty).
 * @author Claude
 */
export const evaluateAchievements = ( context: AchievementContext ): AchievementId[] =>
{
    if ( globalThis.window === undefined ) return [];

    const current = loadUnlockedAchievements();
    const alreadyUnlocked = new Set( current.map( ( a ) => a.id ) );

    const newlyUnlocked: UnlockedAchievement[] = [];

    for ( const achievement of achievements )
    {
        const isLocked = !alreadyUnlocked.has( achievement.id );
        const conditionMet = isLocked && achievement.check( context );

        if ( conditionMet )
        {
            newlyUnlocked.push( { id: achievement.id, unlockedAt: Date.now() } );
        }
    }

    if ( newlyUnlocked.length === 0 ) return [];

    localStorage.setItem( ACHIEVEMENTS_KEY, JSON.stringify( [ ...current, ...newlyUnlocked ] ) );

    return newlyUnlocked.map( ( a ) => a.id );
};
