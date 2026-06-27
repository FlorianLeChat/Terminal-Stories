import { DEFAULT_AI_MODEL, type AiSettings } from "$lib/types/ai";

// Single localStorage slot holding the user's own Anthropic API key and model
// choice. Only these settings are persisted — generated stories are ephemeral
// and never written to storage.
const settingsKey = "terminal-stories:ai-settings";

/**
 * Coerces a stored model value to a usable id, falling back to the default for
 * empty or non-string values. Any non-empty id is accepted, since the list of
 * valid models is resolved dynamically from the Models API.
 *
 * @param value - The candidate model id read from storage.
 * @returns A non-empty model id.
 * @author Claude
 */
const coerceModel = ( value: unknown ): string =>
{
    const isUsable = typeof value === "string" && value.trim() !== "";

    return isUsable ? value : DEFAULT_AI_MODEL;
};

/**
 * Reads the persisted AI settings from localStorage. Returns sane defaults
 * (empty key, default model) when nothing is stored or in SSR environments.
 *
 * @returns The current AI settings.
 * @author Claude
 */
export const loadAiSettings = (): AiSettings =>
{
    if ( globalThis.window === undefined ) return { apiKey: "", model: DEFAULT_AI_MODEL };

    const raw = localStorage.getItem( settingsKey );
    if ( !raw ) return { apiKey: "", model: DEFAULT_AI_MODEL };

    try
    {
        const parsed = JSON.parse( raw ) as Partial<AiSettings>;

        return {
            apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
            model: coerceModel( parsed.model )
        };
    }
    catch
    {
        return { apiKey: "", model: DEFAULT_AI_MODEL };
    }
};

/**
 * Persists the given settings to localStorage. No-ops in SSR environments.
 *
 * @param settings - The settings to store.
 * @author Claude
 */
const writeAiSettings = ( settings: AiSettings ): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.setItem( settingsKey, JSON.stringify( settings ) );
};

/**
 * Stores the user's API key, preserving the current model choice.
 *
 * @param apiKey - The Anthropic API key to persist.
 * @author Claude
 */
export const saveAiKey = ( apiKey: string ): void =>
{
    const current = loadAiSettings();

    writeAiSettings( { ...current, apiKey } );
};

/**
 * Stores the selected model, preserving the current API key.
 *
 * @param model - The model to persist.
 * @author Claude
 */
export const saveAiModel = ( model: string ): void =>
{
    const current = loadAiSettings();

    writeAiSettings( { ...current, model } );
};
