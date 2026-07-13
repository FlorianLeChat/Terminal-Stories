<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { asset } from "$app/paths";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import { achievements, hideOnError, type AchievementId } from "$lib";

    let unlockedIds = $derived( new Set( $terminal.unlockedAchievements ) );
    let unlockedCount = $derived( unlockedIds.size );

    let confirmDialog: HTMLDialogElement;

    /**
     * Opens the reset confirmation dialog.
     *
     * @author Claude
     */
    const openResetConfirm = () =>
    {
        confirmDialog?.showModal();
    };

    /**
     * Erases every unlocked achievement and closes the confirmation dialog.
     *
     * @author Claude
     */
    const confirmReset = () =>
    {
        terminal.resetAchievements();
        confirmDialog?.close();
    };

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

    <p class="text-terminal-dim text-xs text-center mt-4 mb-2">
        <output>{m.achievements_count( { unlocked: unlockedCount, total: achievements.length } )}</output>
    </p>

    <p class="text-center mb-4">
        <button
            type="button"
            class="text-xs px-2 py-1 border border-terminal-dim/40 rounded text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 motion-safe:transition-colors"
            onclick={openResetConfirm}
        >
            {m.achievements_reset_button()}
        </button>
    </p>

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

<!--
    Reset confirmation — a native <dialog> mirroring ShareDialog's pattern, so
    the destructive action always requires an explicit second step.
-->
<dialog
    bind:this={confirmDialog}
    aria-labelledby="achievements-reset-title"
    class="bg-transparent backdrop:bg-black/70 m-auto max-w-[90vw] text-terminal-green"
>
    <article class="w-80 max-w-full border border-terminal-dim/60 rounded bg-terminal-bg p-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(0,255,70,0.12)]">
        <h2 id="achievements-reset-title" class="text-terminal-white font-bold tracking-widest text-sm">
            {m.achievements_reset_confirm_title()}
        </h2>

        <p class="text-terminal-amber/90 text-xs leading-relaxed">
            {m.achievements_reset_confirm_desc()}
        </p>

        <div class="flex justify-end gap-2">
            <button
                type="button"
                class="text-xs px-3 py-1.5 border border-terminal-dim/40 rounded text-terminal-dim hover:text-terminal-white hover:border-terminal-dim motion-safe:transition-colors"
                onclick={() => confirmDialog?.close()}
            >
                {m.achievements_reset_confirm_cancel()}
            </button>

            <button
                type="button"
                class="text-xs px-3 py-1.5 border border-terminal-amber/60 rounded text-terminal-amber hover:text-terminal-white hover:border-terminal-amber motion-safe:transition-colors"
                onclick={confirmReset}
            >
                {m.achievements_reset_confirm_confirm()}
            </button>
        </div>
    </article>
</dialog>

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
