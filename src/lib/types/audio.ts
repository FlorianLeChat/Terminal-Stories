/**
 * A named background-music ambiance. Themes are fully synthesized by the audio
 * engine (no audio files): each maps to a set of parameters — musical scale,
 * tempo, and oscillator shape — rather than a track on disk.
 */
export type MusicTheme
    = | "default"
      | "menu"
      | "calm"
      | "tense"
      | "mystery"
      | "melancholic"
      | "heroic"
      | "eerie"
      | "dreamy"
      | "action";

/**
 * The kind of ending reached, mirroring {@link Scene.endingType}. Used to pick
 * the ending sting played when the player reaches a final scene.
 */
export type EndingSoundType = "good" | "bad" | "neutral";

/**
 * A one-shot sound effect a scene can fire when the player enters it, layered
 * on top of the background music for a "moment". Each is fully synthesized:
 *
 * - `heartbeat` — two low thumps, for tension or dread.
 * - `alarm`     — a repeating klaxon, for danger or urgency.
 * - `chime`     — a bright bell arpeggio, for a discovery or a good turn.
 * - `impact`    — a short noise thud, for a hit, a slam, or an explosion.
 * - `suspense`  — a low rising drone swell, for creeping unease.
 * - `glitch`    — fast random-pitch blips, for tech, anomalies, or errors.
 * - `whoosh`    — a filtered noise sweep, for a transition or a passing rush.
 * - `thunder`   — a low rumble under a sharp crack, for a storm or a blast.
 * - `bell`      — a single resonant, inharmonic bell toll.
 * - `static`    — a burst of harsh radio static or interference.
 * - `reveal`    — a rising shimmer, for an unveiling or a magical event.
 * - `wind`      — a long, soft gust of wind for atmosphere.
 */
export type SceneSoundEffect
    = | "heartbeat"
      | "alarm"
      | "chime"
      | "impact"
      | "suspense"
      | "glitch"
      | "whoosh"
      | "thunder"
      | "bell"
      | "static"
      | "reveal"
      | "wind";

/**
 * User-tunable sound preferences, persisted across sessions. Sound is off by
 * default so nothing plays until the user opts in with a real gesture (which
 * also satisfies the browser autoplay policy).
 */
export interface SoundSettings {
    /** Whether any sound (interface SFX and music) is allowed to play. */
    enabled: boolean;
    /** Master volume in the [0, 1] range. */
    volume: number;
}

/** Default sound preferences applied when nothing is stored yet. */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
    enabled: false,
    volume: 0.5
};
