<script lang="ts">
    import { sound } from "#lib/stores/sound.ts";
    import * as m from "#lib/locales/messages.js";

    let enabled = $derived( $sound.enabled );
    let volume = $derived( $sound.volume );

    let volumePercent = $derived( Math.round( volume * 100 ) );

    let toggleColor = $derived( enabled ? "text-terminal-green" : "text-terminal-dim" );

    /**
     * Toggles sound on/off. The click itself is the user gesture the audio
     * engine needs to resume its context on first enable.
     *
     * @author Claude
     */
    const handleToggle = () =>
    {
        sound.toggle();
    };

    /**
     * Relays the volume slider's value (0 to 100) to the store as a [0, 1]
     * gain. The slider is hidden on mobile, where the toggle is the only
     * sound control.
     *
     * @param event - The range input event.
     * @author Claude
     */
    const handleVolume = ( event: Event ) =>
    {
        const target = event.currentTarget as HTMLInputElement;
        const ratio = Number( target.value ) / 100;

        sound.changeVolume( ratio );
    };
</script>

<span class="flex items-center gap-2">
    <button
        type="button"
        onclick={handleToggle}
        aria-pressed={enabled}
        aria-label={m.sound_toggle()}
        title={m.sound_toggle()}
        class="sound-toggle flex items-center justify-center shrink-0 min-w-11 min-h-11 {toggleColor}"
    >
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
            {#if enabled}
                <path d="M16 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 6a8 8 0 0 1 0 12" />
            {:else}
                <path d="M17 9l4 6M21 9l-4 6" />
            {/if}
        </svg>
    </button>

    <input
        type="range"
        min="0"
        max="100"
        value={volumePercent}
        oninput={handleVolume}
        disabled={!enabled}
        aria-label={m.sound_volume()}
        class="sound-volume hidden sm:block sm:w-16 disabled:opacity-40"
    />
</span>

<style>
    .sound-toggle {
        transition: color 0.15s ease;
    }

    .sound-volume {
        accent-color: var( --color-terminal-green, #00ff46 );
        cursor: pointer;
        height: 2px;
    }

    .sound-volume:disabled {
        cursor: default;
    }
</style>
