<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import { display } from "#lib/stores/display.ts";
    import type { ThemePreference } from "#lib/utilities/colorScheme.ts";

    /** Translated name of each theme choice, shown in the control's label. */
    const THEME_LABELS: Record<ThemePreference, () => string> = {
        system: m.theme_mode_system,
        light: m.theme_mode_light,
        dark: m.theme_mode_dark
    };

    let preference = $derived( $display.theme );

    let label = $derived( m.theme_toggle( { mode: THEME_LABELS[ preference ]() } ) );

    let isForced = $derived( preference !== "system" );
    let toggleColor = $derived( isForced ? "text-terminal-green" : "text-terminal-dim" );
</script>

<button
    type="button"
    onclick={() => display.cycleTheme()}
    aria-label={label}
    aria-keyshortcuts="T"
    title={label}
    class="flex items-center justify-center shrink-0 min-w-11 min-h-11 {toggleColor}"
>
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if preference === "light"}
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        {:else if preference === "dark"}
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        {:else}
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
        {/if}
    </svg>
</button>
