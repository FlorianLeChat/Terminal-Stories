<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";

    /** How long the notification stays on screen before auto-dismissing. */
    const AUTO_DISMISS_MS = 6000;

    let toast = $derived( $terminal.endingToast );

    let message = $derived(
        toast === null
            ? ""
            : toast.allDiscovered
                ? m.ending_all_discovered( { total: toast.total } )
                : m.ending_new_discovered( { found: toast.found, total: toast.total } )
    );

    // Auto-dismiss whenever a new toast appears; the timer resets on each
    // change and is cleared if the component unmounts or it is dismissed early.
    $effect( () =>
    {
        if ( toast === null ) return;

        const timer = setTimeout( () => terminal.dismissEndingToast(), AUTO_DISMISS_MS );

        return () => clearTimeout( timer );
    } );
</script>

{#if toast !== null}
    <div
        class="toast w-full border border-terminal-green/60 rounded bg-[rgba(0,20,0,0.95)] px-3 py-2 shadow-[0_0_20px_rgba(0,255,70,0.25)]"
        role="status"
        aria-live="polite"
    >
        <div class="flex items-center justify-between gap-2">
            <p class="text-terminal-white text-sm min-w-0">
                🏁 {message}
            </p>

            <button
                type="button"
                class="shrink-0 text-terminal-dim hover:text-terminal-white text-xs leading-none px-1"
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
