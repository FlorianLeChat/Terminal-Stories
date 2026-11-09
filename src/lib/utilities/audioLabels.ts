import * as m from "#lib/locales/messages.js";
import type { MusicTheme, SceneSoundEffect } from "#lib/types/audio.ts";

/**
 * Localized label resolvers for each music theme. Stories keep storing the
 * theme identifier; only its display name is translated.
 */
const MUSIC_THEME_LABELS: Record<MusicTheme, () => string> = {
    default: m.music_theme_default,
    menu: m.music_theme_menu,
    calm: m.music_theme_calm,
    tense: m.music_theme_tense,
    mystery: m.music_theme_mystery,
    melancholic: m.music_theme_melancholic,
    heroic: m.music_theme_heroic,
    eerie: m.music_theme_eerie,
    dreamy: m.music_theme_dreamy,
    action: m.music_theme_action
};

/**
 * Localized label resolvers for each scene sound effect. Stories keep storing
 * the effect identifier; only its display name is translated.
 */
const SOUND_EFFECT_LABELS: Record<SceneSoundEffect, () => string> = {
    heartbeat: m.sound_effect_heartbeat,
    alarm: m.sound_effect_alarm,
    chime: m.sound_effect_chime,
    impact: m.sound_effect_impact,
    suspense: m.sound_effect_suspense,
    glitch: m.sound_effect_glitch,
    whoosh: m.sound_effect_whoosh,
    thunder: m.sound_effect_thunder,
    bell: m.sound_effect_bell,
    static: m.sound_effect_static,
    reveal: m.sound_effect_reveal,
    wind: m.sound_effect_wind
};

/**
 * Resolves a music theme identifier to its name in the active locale.
 *
 * @param theme - The music theme identifier.
 * @returns The localized theme name.
 * @author Claude
 */
export const musicThemeLabel = ( theme: MusicTheme ): string =>
{
    return MUSIC_THEME_LABELS[ theme ]();
};

/**
 * Resolves a scene sound effect identifier to its name in the active locale.
 *
 * @param effect - The sound effect identifier.
 * @returns The localized effect name.
 * @author Claude
 */
export const soundEffectLabel = ( effect: SceneSoundEffect ): string =>
{
    return SOUND_EFFECT_LABELS[ effect ]();
};
