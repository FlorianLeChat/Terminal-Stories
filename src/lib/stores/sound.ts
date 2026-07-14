import { writable } from "svelte/store";
import type { SoundSettings } from "$lib/types/audio";
import { loadSoundSettings, saveSoundSettings } from "$lib/utilities/soundSettings";
import { resumeAudio, setEnabled, setVolume } from "$lib/utilities/audioEngine";

// Reactive settings layer sitting on top of the stateless audio engine. It
// owns the persisted on/off + volume preferences, mirrors them into the engine,
// and exposes the actions the UI binds to. Playback triggers (SFX, music) live
// in the engine and are called directly by their owners (the terminal store for
// music/endings, the Terminal component for interface sounds).

/**
 * Builds the sound store, seeding it from persisted preferences and pushing
 * those values into the audio engine so the two stay in sync from the start.
 *
 * @returns The sound store: a readable of {@link SoundSettings} plus actions.
 * @author Claude
 */
const createSoundStore = () =>
{
    const initial = loadSoundSettings();
    const { subscribe, update } = writable<SoundSettings>( initial );

    // Prime the engine with the stored preferences (no-op during SSR).
    setEnabled( initial.enabled );
    setVolume( initial.volume );

    /**
     * Persists the current settings and mirrors them into the engine.
     *
     * @param next - The settings to apply.
     * @author Claude
     */
    const commit = ( next: SoundSettings ): void =>
    {
        saveSoundSettings( next );
        setEnabled( next.enabled );
        setVolume( next.volume );
    };

    /**
     * Toggles sound on/off. Enabling resumes the AudioContext first, using the
     * click/keypress that triggered this call as the required user gesture.
     *
     * @author Claude
     */
    const toggle = (): void =>
    {
        // Resume up front so the very first enable is not blocked by autoplay.
        resumeAudio();

        update( ( s ) =>
        {
            const next: SoundSettings = { ...s, enabled: !s.enabled };
            commit( next );

            return next;
        } );
    };

    /**
     * Sets the master volume, persisting the change. Enabling sound implicitly
     * when the user raises the volume from a muted state is intentional.
     *
     * @param volume - The new volume in [0, 1].
     * @author Claude
     */
    const changeVolume = ( volume: number ): void =>
    {
        resumeAudio();

        update( ( s ) =>
        {
            const next: SoundSettings = { ...s, volume };
            commit( next );

            return next;
        } );
    };

    return { subscribe, toggle, changeVolume };
};

export const sound = createSoundStore();
