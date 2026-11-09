<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import { PUBLIC_VERSION } from "$app/env/public";
    import { terminal } from "#lib/stores/terminal.ts";
    import { isCustomStoryId, listCustomStories } from "#lib";
    import type { TerminalView } from "#lib/stores/terminal.ts";

    interface Props {
        view: TerminalView;
        /** True while the typewriter animation is running. */
        isAnimating: boolean;
        /** True when a wiki entry detail is open (shows back hint instead of nav hints). */
        wikiEntryOpen: boolean;
        /** True when the search input is currently open. */
        searchActive: boolean;
        /** True when playing a story and sitting on an ending scene. */
        atEnding: boolean;
        /** Moves the highlighted menu story up (-1) or down (1), wrapping around the list. */
        onMenuNavigate: ( delta: -1 | 1 ) => void;
        /** Opens the menu story currently highlighted — the same action as pressing ENTER. */
        onMenuSelect: () => void;
        /** Opens the keyboard-shortcut help dialog. */
        onHelp: () => void;
    }

    let {
        view,
        isAnimating,
        wikiEntryOpen,
        searchActive,
        atEnding,
        onMenuNavigate,
        onMenuSelect,
        onHelp
    }: Props = $props();

    /**
     * Highlighted custom story, read from the store (not props) so footer
     * buttons act on the highlighted entry exactly as their keyboard shortcuts.
     *
     * @author Claude
     */
    let customSelectedIndex = $derived( $terminal.customSelectedIndex );

    let wikiSelectedIndex = $derived( $terminal.wiki.selectedIndex );

    /**
     * True while a scene's choices are on screen, the only time number keys
     * pick a choice.
     *
     * @author Claude
     */
    let canChoose = $derived( !isAnimating && !atEnding );

    /**
     * True for a catalog story, the only kind with a shareable URL.
     *
     * @author Claude
     */
    let isCatalogStory = $derived.by( () =>
    {
        const story = $terminal.currentStory;
        const hasStory = story !== null;

        return hasStory && !$terminal.currentStoryIsGenerated && !isCustomStoryId( story.id );
    } );

    /**
     * True when the custom story list has an entry for the list keys to act on.
     *
     * @author Claude
     */
    let hasCustomStories = $derived.by( () =>
    {
        void $terminal.customStoriesVersion;

        return view === "custom-stories" && listCustomStories().length > 0;
    } );
</script>

<!--
    Two footers in one, chosen by screen size (the keyboard shortcuts
    themselves are handled in Terminal.svelte):
      - Desktop (>= sm): the keyboard-shortcut legend. Every hint keeps its
        [KEY] label and stays clickable for mouse users. It only lists what the
        page does not already offer: during a story, what the action bar does
        not carry (share moves here while choices wait and the bar is hidden).
      - Mobile (< sm): page-navigation buttons only (short labels, no [KEY]).
        Every other action is done through its on-page control, and the footer
        folds away during a story, whose action bar carries the way back and
        the help.
-->

<!--
    A clickable legend hint. It only renders in the desktop legend, where
    `sm:flex-none` gives it its natural pill width.
-->
{#snippet control( label: string, onclick: () => void )}
    <button
        type="button"
        class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        {onclick}
    >
        {label}
    </button>
{/snippet}

<!--
    A legend entry with no single target (e.g. the number keys picking a
    choice): same pill look as `control`, but plain text since there is
    nothing to click.
-->
{#snippet hint( label: string )}
    <span class="inline-flex items-center justify-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim">
        {label}
    </span>
{/snippet}

<!--
    Mobile page-navigation button: fills the row equally with its siblings and
    reads as a real touch target (larger hit area, no [KEY] prefix).
-->
{#snippet navButton( label: string, onclick: () => void )}
    <button
        type="button"
        class="flex-1 inline-flex items-center justify-center min-h-11 min-w-11 px-3 py-1.5 border border-terminal-dim/40 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        {onclick}
    >
        {label}
    </button>
{/snippet}

<footer
    class="shrink-0 border-t border-terminal-dim/30 px-2 py-1.5 text-xs text-terminal-dim flex flex-wrap items-center gap-1.5 select-none bg-terminal-panel/60 {view === "story" ? "max-sm:hidden" : ""}"
    style="padding-bottom: calc( 0.375rem + env( safe-area-inset-bottom ) )"
>
    <nav id="terminal-controls-legend" class="hidden sm:contents" aria-label={m.controls_legend_aria()}>
        {#if view === "story"}
            {#if canChoose}
                {@render hint( m.controls_story_choose() )}

                {#if isCatalogStory}
                    {@render control( m.help_share(), () => terminal.openShare() )}
                {/if}
            {/if}

            {@render control( m.controls_story_menu(), () => terminal.goBack() )}
        {:else if view === "story-info"}
            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
        {:else if view === "menu"}
            {#if searchActive}
                {@render control( m.controls_menu_cancel_search(), () => terminal.deactivateSearch() )}
            {:else}
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
            {/if}

            {@render control( m.controls_navigate_up(), () => onMenuNavigate( -1 ) )}
            {@render control( m.controls_navigate_down(), () => onMenuNavigate( 1 ) )}
            {@render control( m.controls_menu_select(), onMenuSelect )}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {@render control( m.controls_wiki_back(), () => terminal.backToWikiList() )}
            {:else if searchActive}
                {@render control( m.controls_wiki_consult(), () => terminal.selectWikiEntryAt( wikiSelectedIndex ) )}
                {@render control( m.controls_menu_cancel_search(), () => terminal.deactivateSearch() )}
                {@render hint( m.controls_navigate_list() )}
            {:else}
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
                {@render control( m.controls_wiki_category(), () => terminal.cycleWikiCategory( 1 ) )}
                {@render hint( m.controls_navigate_list() )}
                {@render control( m.controls_story_menu(), () => terminal.closeWiki() )}
            {/if}
        {:else if view === "achievements"}
            {@render control( m.controls_story_menu(), () => terminal.closeAchievements() )}
        {:else if view === "ai-setup"}
            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
        {:else if view === "custom-stories"}
            {#if hasCustomStories}
                {@render control( m.controls_custom_open(), () => terminal.selectCustomStoryAt( customSelectedIndex ) )}
                {@render hint( m.controls_navigate_list() )}
            {/if}

            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
        {:else if view === "editor"}
            {@render control( m.controls_editor_back(), () => terminal.requestCloseEditor() )}
        {/if}

        {#if view !== "boot"}
            {@render control( m.controls_help(), onHelp )}
        {/if}
    </nav>

    <nav class="contents sm:hidden" aria-label={m.controls_nav_aria()}>
        {#if view === "menu"}
            <span class="grid grid-cols-2 gap-1.5 flex-1">
                {@render navButton( m.nav_wiki(), () => terminal.openWiki() )}
                {@render navButton( m.nav_custom(), () => terminal.openCustomStories() )}
                {@render navButton( m.nav_ai(), () => terminal.openAiSetup() )}
                {@render navButton( m.nav_achievements(), () => terminal.openAchievements() )}
            </span>
        {:else if view === "story-info"}
            {@render navButton( m.nav_main_menu(), () => terminal.startMenu() )}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {@render navButton( m.nav_back_to_list(), () => terminal.backToWikiList() )}
            {:else}
                {@render navButton( m.nav_main_menu(), () => terminal.closeWiki() )}
            {/if}
        {:else if view === "achievements"}
            {@render navButton( m.nav_main_menu(), () => terminal.closeAchievements() )}
        {:else if view === "ai-setup"}
            {@render navButton( m.nav_main_menu(), () => terminal.startMenu() )}
        {:else if view === "custom-stories"}
            {@render navButton( m.nav_main_menu(), () => terminal.startMenu() )}
        {:else if view === "editor"}
            {@render navButton( m.nav_back_to_custom(), () => terminal.requestCloseEditor() )}
        {/if}

        {#if view !== "boot"}
            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 border border-terminal-dim/40 rounded text-terminal-dim hover:text-terminal-white active:bg-terminal-green/15 active:text-terminal-white"
                aria-label={m.nav_help()}
                onclick={onHelp}
            >
                ?
            </button>
        {/if}
    </nav>

    {#if view === "boot"}
        <a
            rel="noopener noreferrer"
            href="https://github.com/FlorianLeChat/Terminal-Stories"
            class="inline-flex items-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
            target="_blank"
        >
            {m.controls_source_code()}
        </a>

        <code class="ml-auto gap-3">
            {PUBLIC_VERSION}
        </code>
    {/if}
</footer>
