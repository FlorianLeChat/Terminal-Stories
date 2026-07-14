import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from "$lib/types/audio";

// Single localStorage slot holding the user's sound preferences (on/off and
// master volume). Mirrors the aiSettings persistence pattern.
const settingsKey = "terminal-stories:sound-settings";

/**
 * Clamps a stored volume to the [0, 1] range, falling back to the default for
 * non-finite or non-number values.
 *
 * @param value - The candidate volume read from storage.
 * @returns A usable volume in [0, 1].
 * @author Claude
 */
const coerceVolume = ( value: unknown ): number =>
{
    const isUsable = typeof value === "number" && Number.isFinite( value );
    if ( !isUsable ) return DEFAULT_SOUND_SETTINGS.volume;

    return Math.min( 1, Math.max( 0, value ) );
};

/**
 * Reads the persisted sound settings from localStorage. Returns the defaults
 * (sound off) when nothing is stored or in SSR environments.
 *
 * @returns The current sound settings.
 * @author Claude
 */
export const loadSoundSettings = (): SoundSettings =>
{
    if ( globalThis.window === undefined ) return { ...DEFAULT_SOUND_SETTINGS };

    const raw = localStorage.getItem( settingsKey );
    if ( !raw ) return { ...DEFAULT_SOUND_SETTINGS };

    try
    {
        const parsed = JSON.parse( raw ) as Partial<SoundSettings>;

        return {
            enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SOUND_SETTINGS.enabled,
            volume: coerceVolume( parsed.volume )
        };
    }
    catch
    {
        return { ...DEFAULT_SOUND_SETTINGS };
    }
};

/**
 * Persists the given sound settings to localStorage. No-ops in SSR.
 *
 * @param settings - The settings to store.
 * @author Claude
 */
export const saveSoundSettings = ( settings: SoundSettings ): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.setItem( settingsKey, JSON.stringify( settings ) );
};
