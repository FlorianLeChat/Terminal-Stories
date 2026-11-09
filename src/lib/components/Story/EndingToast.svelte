<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import type { EndingDiscoveryToast } from "#lib/stores/terminal.ts";

    /** Border color matching the tone of the ending just reached. */
    const BORDER_BY_TYPE: Record<EndingDiscoveryToast[ "endingType" ], string> = {
        good: "border-terminal-green/60",
        bad: "border-terminal-amber/60",
        neutral: "border-terminal-dim/60"
    };

    let toast = $derived( $terminal.endingToast );

    /**
     * Words the discovery after the story's own tone: a tragic ending is
     * never greeted with a celebration.
     *
     * @param discovery - The ending discovery to describe.
     * @returns The localized message.
     * @author Claude
     */
    const discoveryMessage = ( discovery: EndingDiscoveryToast ): string =>
    {
        const counts = { found: discovery.found, total: discovery.total };

        if ( discovery.allDiscovered ) return m.ending_all_discovered( counts );
        if ( discovery.endingType === "good" ) return m.ending_new_discovered_good( counts );
        if ( discovery.endingType === "bad" ) return m.ending_new_discovered_bad( counts );

        return m.ending_new_discovered_neutral( counts );
    };
</script>

{#if toast !== null}
    <div
        class="toast w-full border {BORDER_BY_TYPE[ toast.endingType ]} rounded bg-terminal-panel pl-3 pr-1 py-1 shadow-(--shadow-toast)"
        role="status"
        aria-live="polite"
    >
        <div class="flex items-center justify-between gap-2">
            <p class="text-terminal-white text-sm min-w-0">
                {discoveryMessage( toast )}
            </p>

            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 text-terminal-dim hover:text-terminal-white text-sm leading-none"
                aria-label={m.toast_dismiss()}
                onclick={() => terminal.dismissEndingToast()}
            >
                ✕
            </button>
        </div>
    </div>
{/if}

<style>
    .toast {
        animation: toast-in 0.25s ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
        .toast {
            animation: none;
        }
    }

    @keyframes toast-in {
        from {
            opacity: 0;
            transform: translateY(-0.75rem);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
