<script lang="ts">
    import { asset } from "$app/paths";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import { getAchievement, type Achievement } from "#lib";

    /**
     * Definitions of the just-unlocked achievements. Unknown ids (e.g. a renamed
     * achievement in an old save) are skipped.
     *
     * @author Claude
     */
    let unlocked = $derived(
        $terminal.achievementToast
            .map( ( id ) => getAchievement( id ) )
            .filter( ( a ): a is Achievement => a !== undefined )
    );
</script>

{#if unlocked.length > 0}
    <div
        class="toast w-full border border-terminal-green/60 rounded bg-terminal-panel pl-3 pr-1 pt-1 pb-2 shadow-(--shadow-toast)"
        role="status"
        aria-live="polite"
    >
        <div class="flex items-center justify-between gap-2">
            <h2 class="text-terminal-green text-xs font-bold uppercase tracking-wide">
                ✦ {m.achievements_toast_title( { count: unlocked.length } )}
            </h2>

            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 text-terminal-dim hover:text-terminal-white text-sm leading-none"
                aria-label={m.toast_dismiss()}
                onclick={() => terminal.dismissAchievementToast()}
            >
                ✕
            </button>
        </div>

        <ul class="space-y-2 pr-2">
            {#each unlocked as achievement ( achievement.id )}
                <li class="flex items-center gap-3">
                    <!-- Masked so the icon takes the theme's primary instead of its fixed green. -->
                    <span
                        class="w-6 h-6 shrink-0 bg-terminal-green mask-contain mask-center mask-no-repeat"
                        style:mask-image="url({asset( achievement.icon )})"
                        aria-hidden="true"
                    ></span>

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
            transform: translateY(-0.75rem);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
