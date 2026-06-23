export type CharacterRole = "protagonist" | "antagonist" | "ally" | "npc" | "narrator";

export interface Character {
    id: string;
    name: string;
    description: string;
    role: CharacterRole;
}

export interface Choice {
    id: string;
    text: string;
    action: string;
    consequence: string;
    nextScene: string;
    requiresFlag?: string;
    setsFlag?: string;
}

export interface Scene {
    id: string;
    text: string | string[];
    speaker?: string;
    image?: string;
    choices: Choice[];
    isEnding?: boolean;
    endingType?: "good" | "bad" | "neutral";
}

export interface Story {
    id: string;
    title: string;
    genre: string;
    language: string;
    universe: string;
    description: string;
    tags: string[];
    author?: string;
    characters: Character[];
    startScene: string;
    scenes: Record<string, Scene>;
}

export interface StoryStats {
    /** Number of scenes ("entries") in the story. */
    scenes: number;
    /** Number of possible endings. */
    endings: number;
    /** Total number of words across all content. */
    words: number;
    /** Estimated reading time for a single playthrough (average path), in minutes. */
    minutes: number;
    /** Reading time to explore all the content, in minutes. */
    fullMinutes: number;
}

export interface StoryMeta {
    id: string;
    title: string;
    genre: string;
    language: string;
    universe: string;
    description: string;
    tags: string[];
    stats: StoryStats;
}

export interface StoryFilters {
    genre: string | null;
    language: string | null;
}

export interface GameState {
    storyId: string;
    currentScene: string;
    flags: Set<string>;
    history: string[];
    characterName?: string;
}
