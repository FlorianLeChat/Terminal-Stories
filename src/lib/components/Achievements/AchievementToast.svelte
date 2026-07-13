<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { asset } from "$app/paths";
    import { terminal } from "$lib/stores/terminal";
    import { getAchievement, hideOnError, type Achievement } from "$lib";

    /** How long the notification stays on screen before auto-dismissing. */
    const AUTO_DISMISS_MS = 6000;

    // Resolve the just-unlocked ids into their full definitions, skipping any
    // unknown id defensively (e.g. a renamed achievement in an old save).
    let unlocked = $derived(
        $terminal.achievementToast
            .map( ( id ) => getAchievement( id ) )
            .filter( ( a ): a is Achievement => a !== undefined )
    );

    // Auto-dismiss whenever a new batch appears; the timer resets on each change
    // and is cleared if the component unmounts or the toast is dismissed early.
    $effect( () =>
    {
        const hasToast = unlocked.length > 0;
        if ( !hasToast ) return;

        const timer = setTimeout( () => terminal.dismissAchievementToast(), AUTO_DISMISS_MS );

        return () => clearTimeout( timer );
    } );
</script>

{#if unlocked.length > 0}
    <div
        class="toast absolute left-1/2 top-4 z-20 w-[min(92%,26rem)] -translate-x-1/2 border border-terminal-green/60 rounded bg-[rgba(0,20,0,0.95)] px-3 py-2 shadow-[0_0_20px_rgba(0,255,70,0.25)]"
        role="status"
        aria-live="polite"
    >
        <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-terminal-green text-xs font-bold uppercase tracking-wide">
                ✦ {m.achievements_toast_title( { count: unlocked.length } )}
            </h2>

            <button
                type="button"
                class="shrink-0 text-terminal-dim hover:text-terminal-white text-xs leading-none px-1"
                aria-label={m.achievements_toast_dismiss()}
                onclick={() => terminal.dismissAchievementToast()}
            >
                ✕
            </button>
        </div>

        <ul class="space-y-2">
            {#each unlocked as achievement ( achievement.id )}
                <li class="flex items-center gap-3">
                    <img
                        src={asset( achievement.icon )}
                        alt=""
                        width="24"
                        height="24"
                        class="w-6 h-6 shrink-0"
                        style="image-rendering: pixelated"
                        use:hideOnError
                    />

                    <span class="text-terminal-white text-sm font-bold min-w-0 truncate">
                        {achievement.name()}
                    </span>
                </li>
            {/each}
        </ul>
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
            transform: translate(-50%, -0.75rem);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
</style>
