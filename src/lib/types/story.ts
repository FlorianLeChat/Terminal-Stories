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
    scenes: number;
    endings: number;
    words: number;
    minutes: number;
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
    endingIds: string[];
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
