/** Every achievement the game can award, identified by a stable slug. */
export type AchievementId = "first-ending" | "all-endings-single" | "speedrun" | "dedication" | "balanced" | "explorer" | "completionist";

/**
 * A read-only definition of a single achievement: its identity, its icon, the
 * translatable name/description getters, whether it is a hidden ("secret")
 * achievement, and the pure predicate deciding when it unlocks.
 */
export interface Achievement {
    /** Stable slug identifying this achievement. */
    id: AchievementId;
    /** Static-asset path of the pixel-art icon (resolved through `asset()`). */
    icon: string;
    /** Translatable display name (a Paraglide message getter). */
    name: () => string;
    /** Translatable description (a Paraglide message getter). */
    description: () => string;
    /**
     * When true, the name and description stay masked in the UI until the
     * achievement is unlocked, keeping it a surprise for the player.
     */
    hidden?: boolean;
    /**
     * Pure predicate evaluated when a catalog ending is reached. Returns true
     * when the achievement's condition is met by the given context.
     */
    check: ( context: AchievementContext ) => boolean;
}

/** A persisted record of an unlocked achievement and when it was earned. */
export interface UnlockedAchievement {
    id: AchievementId;
    unlockedAt: number;
}

/**
 * Everything the achievement predicates need to evaluate their condition when a
 * catalog ending is reached. It is assembled by the store, which folds the just
 * reached (not-yet-persisted) ending into every derived count so the checks see
 * a consistent, up-to-date snapshot.
 */
export interface AchievementContext {
    /** Id of the story whose ending was just reached. */
    storyId: string;
    /** Whether this exact ending had never been reached before. */
    isNewEnding: boolean;
    /** Endings discovered in this story, including the one just reached. */
    endingsFound: number;
    /** Total number of endings this story has. */
    endingsTotal: number;
    /** Elapsed time of this playthrough, from its start to reaching the ending. */
    elapsedMs: number;
    /** Distinct catalog stories with at least one ending discovered. */
    completedStoriesCount: number;
    /** Catalog stories whose every ending has been discovered. */
    fullyCompletedStoriesCount: number;
    /** Total number of catalog stories. */
    totalStoriesCount: number;
    /** Ending types discovered in this story, including the one just reached. */
    discoveredEndingTypes: Set<"good" | "bad" | "neutral">;
}
