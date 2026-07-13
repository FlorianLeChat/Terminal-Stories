<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { asset } from "$app/paths";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import { achievements, hideOnError, type AchievementId } from "$lib";

    let unlockedIds = $derived( new Set( $terminal.unlockedAchievements ) );
    let unlockedCount = $derived( unlockedIds.size );

    /**
     * Resolves how a single achievement should be presented given its unlock
     * state: unlocked entries reveal their real name/description/icon, hidden
     * (secret) locked entries stay masked, and ordinary locked entries show a
     * dimmed icon with their real text.
     *
     * @param id - The achievement id to describe.
     * @param name - The achievement's real display name.
     * @param description - The achievement's real description.
     * @param hidden - Whether the achievement is a secret one.
     * @returns The name, description, and display flags for the card.
     * @author Claude
     */
    const present = ( id: AchievementId, name: string, description: string, hidden: boolean ) =>
    {
        const isUnlocked = unlockedIds.has( id );
        const isSecret = hidden === true && !isUnlocked;

        return {
            isUnlocked,
            isSecret,
            name: isSecret ? m.achievements_hidden_name() : name,
            description: isSecret ? m.achievements_hidden_desc() : description
        };
    };
</script>

<div class="flex-1 overflow-y-auto px-4 py-2 scrollbar-terminal">
    <TerminalLogo subtitle={m.achievements_subtitle()} />

    <p class="text-terminal-dim text-xs text-center my-4">
        <output>{m.achievements_count( { unlocked: unlockedCount, total: achievements.length } )}</output>
    </p>

    <nav class="text-terminal-dim text-xs mb-4 text-center">
        {m.achievements_nav_default()}
    </nav>

    <ol class="border border-terminal-dim rounded px-2 py-1 mb-4">
        {#each achievements as achievement, i ( achievement.id )}
            {@const view = present( achievement.id, achievement.name(), achievement.description(), achievement.hidden === true )}

            <li>
                <article class="flex items-center gap-3 px-3 py-3 {view.isUnlocked ? "" : "opacity-60"}">
                    <figure class="shrink-0 w-10 h-10 flex items-center justify-center border border-terminal-dim/40 rounded bg-terminal-green/5">
                        {#if view.isSecret}
                            <span class="text-terminal-dim text-lg select-none" aria-hidden="true">?</span>
                        {:else}
                            <img
                                src={asset( achievement.icon )}
                                alt=""
                                width="24"
                                height="24"
                                class="w-6 h-6 {view.isUnlocked ? "" : "grayscale"}"
                                style="image-rendering: pixelated"
                                use:hideOnError
                            />
                        {/if}
                    </figure>

                    <div class="flex-1 min-w-0">
                        <h3 class="text-terminal-white font-bold text-sm {view.isUnlocked ? "" : "text-terminal-dim"}">
                            {view.name}
                        </h3>

                        <p class="text-terminal-green text-xs mt-0.5 opacity-80 leading-relaxed">
                            {view.description}
                        </p>
                    </div>

                    <span class="shrink-0 text-xs px-2 py-0.5 rounded border {view.isUnlocked
                        ? "border-terminal-green text-terminal-green"
                        : "border-terminal-dim/40 text-terminal-dim"}">
                        {view.isUnlocked ? m.achievements_status_unlocked() : m.achievements_status_locked()}
                    </span>
                </article>

                {#if i < achievements.length - 1}
                    <div class="border-t border-terminal-dim/20 mx-3" aria-hidden="true"></div>
                {/if}
            </li>
        {/each}
    </ol>
</div>

<style>
    .scrollbar-terminal::-webkit-scrollbar {
        width: 4px;
    }

    .scrollbar-terminal::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollbar-terminal::-webkit-scrollbar-thumb {
        background: #1a4a1a;
        border-radius: 2px;
    }
</style>
