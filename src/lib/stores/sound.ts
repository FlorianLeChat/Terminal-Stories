import { writable } from "svelte/store";
import type { SoundSettings } from "#lib/types/audio.ts";
import { resumeAudio, setEnabled, setVolume } from "#lib/utilities/audioEngine.ts";
import { loadSoundSettings, saveSoundSettings } from "#lib/utilities/soundSettings.ts";

/**
 * Builds the sound store, seeding it from persisted preferences and pushing
 * those values into the audio engine so the two stay in sync from the start.
 * The store only owns the on/off and volume preferences: playback triggers
 * (SFX, music) live in the engine and are called directly by their owners.
 *
 * @returns The sound store: a readable of {@link SoundSettings} plus actions.
 * @author Claude
 */
const createSoundStore = () =>
{
    const initial = loadSoundSettings();
    const { subscribe, update } = writable<SoundSettings>( initial );

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
