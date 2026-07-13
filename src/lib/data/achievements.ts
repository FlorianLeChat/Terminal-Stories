import * as m from "$lib/locales/messages";
import type { Achievement, AchievementContext } from "$lib/types/achievement";

/** Below this playthrough duration, reaching an ending counts as a speedrun. */
const SPEEDRUN_MAX_MS = 60_000;

/** At or above this playthrough duration, reaching an ending rewards dedication. */
const DEDICATION_MIN_MS = 600_000;

/** How many distinct stories must be completed to count as an explorer. */
const EXPLORER_STORIES = 3;

/**
 * The catalog of achievements, in display order. Each carries a pure `check`
 * predicate evaluated whenever a catalog ending is reached; the store supplies
 * a fully-resolved {@link AchievementContext}. Unlocking is idempotent, so a
 * predicate may safely return true again once its achievement is already earned.
 *
 * @author Claude
 */
export const achievements: Achievement[] = [
    {
        id: "first-ending",
        icon: "/assets/achievements/first-ending.svg",
        name: () => m.achievement_first_ending_name(),
        description: () => m.achievement_first_ending_desc(),
        // Reached only when sitting on an ending, so completing any story unlocks it.
        check: () => true
    },
    {
        id: "all-endings-single",
        icon: "/assets/achievements/all-endings-single.svg",
        name: () => m.achievement_all_endings_single_name(),
        description: () => m.achievement_all_endings_single_desc(),
        check: ( context: AchievementContext ): boolean =>
        {
            const hasEndings = context.endingsTotal > 0;
            const foundThemAll = context.endingsFound >= context.endingsTotal;

            return hasEndings && foundThemAll;
        }
    },
    {
        id: "speedrun",
        icon: "/assets/achievements/speedrun.svg",
        name: () => m.achievement_speedrun_name(),
        description: () => m.achievement_speedrun_desc(),
        check: ( context: AchievementContext ): boolean =>
        {
            const isTimed = context.elapsedMs > 0;
            const wasFast = context.elapsedMs < SPEEDRUN_MAX_MS;

            return isTimed && wasFast;
        }
    },
    {
        id: "dedication",
        icon: "/assets/achievements/dedication.svg",
        name: () => m.achievement_dedication_name(),
        description: () => m.achievement_dedication_desc(),
        check: ( context: AchievementContext ): boolean =>
        {
            return context.elapsedMs >= DEDICATION_MIN_MS;
        }
    },
    {
        id: "balanced",
        icon: "/assets/achievements/balanced.svg",
        name: () => m.achievement_balanced_name(),
        description: () => m.achievement_balanced_desc(),
        check: ( context: AchievementContext ): boolean =>
        {
            const hasGoodEnding = context.discoveredEndingTypes.has( "good" );
            const hasBadEnding = context.discoveredEndingTypes.has( "bad" );

            return hasGoodEnding && hasBadEnding;
        }
    },
    {
        id: "explorer",
        icon: "/assets/achievements/explorer.svg",
        name: () => m.achievement_explorer_name(),
        description: () => m.achievement_explorer_desc(),
        hidden: true,
        check: ( context: AchievementContext ): boolean =>
        {
            return context.completedStoriesCount >= EXPLORER_STORIES;
        }
    },
    {
        id: "completionist",
        icon: "/assets/achievements/completionist.svg",
        name: () => m.achievement_completionist_name(),
        description: () => m.achievement_completionist_desc(),
        hidden: true,
        check: ( context: AchievementContext ): boolean =>
        {
            const hasStories = context.totalStoriesCount > 0;
            const clearedEverything = context.fullyCompletedStoriesCount >= context.totalStoriesCount;

            return hasStories && clearedEverything;
        }
    }
];

/**
 * Looks up an achievement definition by id.
 *
 * @param id - The achievement identifier.
 * @returns The matching achievement, or `undefined` if none exists.
 * @author Claude
 */
export const getAchievement = ( id: string ): Achievement | undefined =>
{
    return achievements.find( ( a ) => a.id === id );
};
