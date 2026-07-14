<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { sound } from "$lib/stores/sound";

    let enabled = $derived( $sound.enabled );
    let volume = $derived( $sound.volume );

    // Whole-percent value for the range input (kept in [0, 100]).
    let volumePercent = $derived( Math.round( volume * 100 ) );

    // Action-oriented label: describes what the button will do, not its state.
    let toggleLabel = $derived( enabled ? m.sound_toggle_off() : m.sound_toggle_on() );

    // Muted control reads as inactive (dim); active control is terminal-green.
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
     * Relays the volume slider's value (0–100) to the store as a [0, 1] gain.
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
        aria-label={toggleLabel}
        title={toggleLabel}
        class="sound-toggle flex items-center shrink-0 {toggleColor}"
    >
        <!-- Speaker glyph; sound waves when enabled, a cross when muted. -->
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
        class="sound-volume hidden sm:inline w-16 disabled:opacity-40"
    />
</span>

<style>
    .sound-toggle {
        transition: color 0.15s ease;
    }

    /* Keep the slider on-brand: thin terminal-green track and thumb. */
    .sound-volume {
        accent-color: var( --color-terminal-green, #00ff46 );
        cursor: pointer;
        height: 2px;
    }

    .sound-volume:disabled {
        cursor: default;
    }
</style>
