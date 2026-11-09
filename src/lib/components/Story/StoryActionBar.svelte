<script lang="ts">
    import { isCustomStoryId } from "#lib";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";

    interface Props {
        /** Either the story-info preview screen or active playback. */
        view: "story-info" | "story";
        /** True when the current story has a save in localStorage. */
        hasSave: boolean;
        /** True while the typewriter animation is running. */
        isAnimating: boolean;
        /** True when playing a generated story and sitting on an ending scene. */
        atGeneratedEnding: boolean;
        /** True when playing a catalog story and sitting on an ending scene. */
        atStandardEnding: boolean;
        /** Skips the running typewriter animation (owned by the parent terminal). */
        onSkip: () => void;
        /** Forks the currently previewed catalog story into the editor. */
        onFork: () => void;
        /** Starts over, asking first when that would erase a save. */
        onNewGame: () => void;
        /** Opens the keyboard-shortcut help dialog. */
        onHelp: () => void;
    }

    let { view, hasSave, isAnimating, atGeneratedEnding, atStandardEnding, onSkip, onFork, onNewGame, onHelp }: Props = $props();

    /**
     * A keyboard shortcut: its visible key cap, printed on its button from `sm` up,
     * and its `aria-keyshortcuts` value.
     *
     * @author Claude
     */
    interface Shortcut {
        label: string;
        aria: string;
    }

    const SHORTCUT_ENTER: Shortcut = { label: m.key_enter(), aria: "Enter" };
    const SHORTCUT_SPACE: Shortcut = { label: m.key_space(), aria: "Space" };
    const SHORTCUT_N: Shortcut = { label: "N", aria: "N" };
    const SHORTCUT_F: Shortcut = { label: "F", aria: "F" };
    const SHORTCUT_S: Shortcut = { label: "S", aria: "S" };

    let currentStory = $derived( $terminal.currentStory );

    let isGenerated = $derived( $terminal.currentStoryIsGenerated );

    let isCustomStory = $derived( currentStory !== null && isCustomStoryId( currentStory.id ) );

    /**
     * True for catalog stories, the only ones offered share and fork: generated
     * stories are ephemeral with no shareable URL, custom stories are private and
     * already editable.
     *
     * @author Claude
     */
    let isCatalogStory = $derived( currentStory !== null && !isGenerated && !isCustomStory );

    let atEnding = $derived( atGeneratedEnding || atStandardEnding );

    /**
     * True when the bar has a main action (start, skip, restart) to show on desktop.
     * On a phone the bar is always shown during playback since it carries the
     * footer; on desktop, share alone moves to the footer legend instead.
     *
     * @author Claude
     */
    let hasDesktopContent = $derived(
        view === "story-info" || isAnimating || atEnding
    );

    let moreMenu: HTMLElement | undefined = $state();

    /**
     * Runs an action picked from the "more" menu, closing the menu first so
     * the dialog it may open gets the focus.
     *
     * @param run - The action to run.
     * @author Claude
     */
    const pickMore = ( run: () => void ) =>
    {
        moreMenu?.hidePopover();
        run();
    };

    // Once an ending has finished printing, focus the restart button.
    $effect( () =>
    {
        const isEndingSettled = atEnding && !isAnimating;
        if ( !isEndingSettled ) return;

        document.querySelector<HTMLButtonElement>( "[data-action='restart']" )?.focus( { preventScroll: true } );
    } );

    /**
     * Resumes the currently previewed story from its save.
     *
     * @author Claude
     */
    const handleResume = () =>
    {
        if ( currentStory ) terminal.resumeStory( currentStory.id );
    };

    /**
     * Restarts the current story from the start, using the right path for
     * generated versus catalog stories.
     *
     * @author Claude
     */
    const handleRestart = () =>
    {
        if ( atGeneratedEnding )
        {
            terminal.restartGeneratedStory();
        }
        else
        {
            terminal.restartStory();
        }
    };
</script>

<!--
    Action bar between the terminal output and the footer: touch-friendly
    controls to start, skip, restart, share or fork a story without the footer.
-->
{#snippet action( label: string, onclick: () => void, shortcut: Shortcut, primary: boolean = false, id: string = "" )}
    {@const variant = primary
        ? "border-terminal-green bg-terminal-green/15 text-terminal-white hover:bg-terminal-green/25"
        : "border-terminal-dim/40 text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white"}

    <button
        type="button"
        class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-11 sm:min-h-9 px-3 py-1.5 rounded border whitespace-nowrap motion-safe:transition-colors motion-safe:duration-100 {variant}"
        aria-keyshortcuts={shortcut.aria}
        data-action={id === "" ? undefined : id}
        {onclick}
    >
        {label}
        <kbd class="hidden sm:inline ml-2 text-xs font-[inherit] {primary ? "text-terminal-white" : "text-terminal-dim"}" aria-hidden="true">{shortcut.label}</kbd>
    </button>
{/snippet}

{#if view === "story" || hasDesktopContent}
<div class="shrink-0 border-t border-terminal-dim/30 px-4 py-1.5 sm:py-2 bg-terminal-panel/35 flex items-center gap-2 {view === "story-info" ? "flex-wrap" : ""} {hasDesktopContent ? "" : "sm:hidden"}">
    {#if view === "story-info"}
        {#if hasSave}
            {@render action( m.action_resume(), handleResume, SHORTCUT_ENTER, true )}
            {@render action( m.action_new_game(), onNewGame, SHORTCUT_N )}
        {:else}
            {@render action( m.action_start(), onNewGame, SHORTCUT_ENTER, true )}
        {/if}

        {#if isCatalogStory}
            {@render action( m.action_fork(), onFork, SHORTCUT_F )}
            {@render action( m.action_share(), () => terminal.openShare(), SHORTCUT_S )}
        {/if}
    {:else}
        {#if isAnimating}
            {@render action( m.action_skip(), onSkip, SHORTCUT_SPACE, true )}
        {:else if atEnding}
            {@render action( m.action_restart(), handleRestart, SHORTCUT_ENTER, true, "restart" )}
        {/if}

        {#if isCatalogStory}
            <span class="hidden sm:contents">
                {@render action( m.action_share(), () => terminal.openShare(), SHORTCUT_S )}
            </span>
        {/if}

        <span class="contents sm:hidden">
            <button
                type="button"
                class="flex-1 inline-flex items-center justify-center min-h-11 px-3 py-1.5 rounded border border-terminal-dim/40 text-terminal-dim whitespace-nowrap active:bg-terminal-green/15 active:text-terminal-white"
                onclick={() => terminal.goBack()}
            >
                {m.nav_main_menu()}
            </button>

            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded border border-terminal-dim/40 text-terminal-dim active:bg-terminal-green/15 active:text-terminal-white"
                popovertarget="story-more-actions"
                aria-label={m.action_more()}
            >
                <span aria-hidden="true">⋯</span>
            </button>
        </span>

        <ul
            bind:this={moreMenu}
            id="story-more-actions"
            popover="auto"
            class="more-menu min-w-48 m-0 p-1 rounded border border-terminal-dim/60 bg-terminal-bg text-sm shadow-(--shadow-dialog)"
            aria-label={m.action_more()}
        >
            {#if isCatalogStory}
                <li>
                    <button type="button" class="w-full min-h-11 px-3 text-left rounded text-terminal-text active:bg-terminal-green/15" onclick={() => pickMore( () => terminal.openShare() )}>
                        {m.action_share()}
                    </button>
                </li>
            {/if}

            <li>
                <button type="button" class="w-full min-h-11 px-3 text-left rounded text-terminal-text active:bg-terminal-green/15" onclick={() => pickMore( onHelp )}>
                    {m.nav_help()}
                </button>
            </li>
        </ul>
    {/if}
</div>
{/if}

<style>
    .more-menu {
        inset: auto 1rem calc( 4rem + env( safe-area-inset-bottom ) ) auto;
    }
</style>
