/** Claude models the user can pick for client-side story generation. */
export type AiModel = "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-opus-4-8";

/** The default model preference stored before the live list is fetched. */
export const DEFAULT_AI_MODEL: AiModel = "claude-sonnet-4-6";

/**
 * Persisted, user-provided settings for the AI feature. The API key never
 * leaves the browser (stored in localStorage) and is sent directly to the
 * Anthropic API. `model` is a free string so any id returned by the Models API
 * can be stored, not just the curated defaults.
 */
export interface AiSettings {
    apiKey: string;
    model: string;
}

/** A selectable model option fetched from the Models API. */
export interface AiModelOption {
    id: string;
    label: string;
}

/** Parameters the player tweaks before generating a one-off story. */
export interface AiGenerationParams {
    /** Free-text premise / idea driving the story (may be empty). */
    premise: string;
    /** Target genre (free text, optionally seeded from the catalog). */
    genre: string;
    /** Language the story should be written in (e.g. "Français"). */
    language: string;
    /** Rough number of scenes to aim for. */
    sceneCount: number;
}

/** State of the generation request, surfaced to the setup screen. */
export type AiStatus = "idle" | "generating" | "error";

/**
 * Machine-readable AI failure reasons. Services throw these codes (never
 * localized text); the UI maps them to translatable Paraglide messages.
 */
export type AiErrorCode = "network" | "auth" | "rate_limit" | "bad_request" | "api" | "empty_response" | "no_json" | "invalid_json" | "not_object" | "no_scenes" | "no_scene_ids" | "no_ending" | "unknown";
