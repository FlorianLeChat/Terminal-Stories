import type { MusicTheme, SceneSoundEffect } from "#lib/types/audio.ts";

/**
 * Every phosphor color a story can be displayed in, as a runtime list so
 * user-provided data (imported or edited stories) can be validated against it.
 */
export const PHOSPHOR_THEMES = [ "green", "amber", "cyan" ] as const;

/** The phosphor (color theme) of the monitor while a story is shown. */
export type PhosphorTheme = ( typeof PHOSPHOR_THEMES )[ number ];

export type CharacterRole = "protagonist" | "antagonist" | "ally" | "npc" | "narrator";

export interface Character {
    id: string;
    name: string;
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

/**
 * A single line within a scene that names a speaker other than the scene's
 * own default (a character id, or the `"narrator"` sentinel).
 */
export interface DialogueLine {
    speaker: string;
    text: string;
}

/**
 * One entry of a scene's `text`. A plain string is a line spoken by the
 * scene's default speaker (its own `speaker`, or `"narrator"` if unset); a
 * {@link DialogueLine} is used only when a line's speaker differs from that
 * default.
 */
export type SceneTextEntry = string | DialogueLine;

export interface Scene {
    id: string;
    speaker?: string;
    text: SceneTextEntry[];
    image?: string;
    choices: Choice[];
    isEnding?: boolean;
    endingType?: "good" | "bad" | "neutral";
    /**
     * Optional music override for this specific "moment". When set, entering the
     * scene switches the background ambiance to this theme; when absent, the
     * story's own {@link Story.music} theme keeps playing.
     */
    music?: MusicTheme;
    /**
     * Optional one-shot sound effect fired once when the player enters the
     * scene, layered over the background music to punctuate a moment.
     */
    sound?: SceneSoundEffect;
}

export interface Story {
    id: string;
    title: string;
    genre: string;
    language: string;
    universe: string;
    description: string;
    author?: string;
    /**
     * Optional default background-music ambiance for the whole story, started
     * when playback begins. Falls back to the `"default"` theme when absent.
     */
    music?: MusicTheme;
    /**
     * Optional phosphor the monitor switches to while this story is shown.
     * Falls back to a theme picked from the genre when absent.
     */
    phosphor?: PhosphorTheme;
    characters: Character[];
    startScene: string;
    scenes: Record<string, Scene>;
}

/**
 * On-disk shape of a story file: scenes are authored as a flat array (each
 * scene already carries its own `id`) instead of a keyed map, to keep the
 * JSON lighter to write by hand.
 */
export interface StoryFile extends Omit<Story, "scenes"> {
    scenes: Scene[];
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
    stats: StoryStats;
    endingIds: string[];
    /** The phosphor the story is shown in (its own, or its genre's). */
    phosphor: PhosphorTheme;
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
