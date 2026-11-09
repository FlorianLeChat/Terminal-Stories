<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import { display } from "#lib/stores/display.ts";

    let enabled = $derived( $display.scanlines );

    let toggleColor = $derived( enabled ? "text-terminal-green" : "text-terminal-dim" );
</script>

<button
    type="button"
    onclick={() => display.toggleScanlines()}
    aria-pressed={enabled}
    aria-label={m.scanlines_toggle()}
    title={m.scanlines_toggle()}
    class="flex items-center justify-center shrink-0 min-w-11 min-h-11 {toggleColor}"
>
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M9 21h6M12 17v4" />
        {#if enabled}
            <path d="M7 9h10M7 12.5h10" stroke-width="1.5" />
        {:else}
            <path d="M5 6l14 9" />
        {/if}
    </svg>
</button>
