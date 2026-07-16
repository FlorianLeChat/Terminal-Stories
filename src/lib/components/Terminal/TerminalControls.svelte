<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import type { TerminalView } from "$lib/stores/terminal";
    import { isCustomStoryId } from "$lib";

    interface Props {
        view: TerminalView;
        /** True when the current story has a save in localStorage. */
        hasSave: boolean;
        /** True while the typewriter animation is running. */
        isAnimating: boolean;
        /** True when a wiki entry detail is open (shows back hint instead of nav hints). */
        wikiEntryOpen: boolean;
        /** True when the search input is currently open. */
        searchActive: boolean;
        /** True when playing a generated story and sitting on an ending scene. */
        atGeneratedEnding: boolean;
        /** True when playing a catalog story and sitting on an ending scene. */
        atStandardEnding: boolean;
        /** Skips the running typewriter animation (owned by the parent terminal). */
        onSkip: () => void;
        /** Moves the highlighted menu story up (-1) or down (1), wrapping around the list. */
        onMenuNavigate: ( delta: -1 | 1 ) => void;
        /** Opens the menu story currently highlighted — the same action as pressing ENTER. */
        onMenuSelect: () => void;
        /** Creates a blank custom story and opens it in the editor. */
        onCustomNew: () => void;
        /** Forks the currently previewed catalog story into the editor. */
        onFork: () => void;
    }

    let {
        view,
        hasSave,
        isAnimating,
        wikiEntryOpen,
        searchActive,
        atGeneratedEnding,
        atStandardEnding,
        onSkip,
        onMenuNavigate,
        onMenuSelect,
        onCustomNew,
        onFork
    }: Props = $props();

    // Read here so the story-info actions can target the current story directly,
    // letting every control work by touch as well as by keyboard.
    let currentStory = $derived( $terminal.currentStory );

    // Generated stories are ephemeral and have no shareable URL, so the share
    // control is offered for catalog stories only.
    let isGenerated = $derived( $terminal.currentStoryIsGenerated );

    // Custom stories are private: no share control, and no fork control (they
    // are already editable copies).
    let isCustomStory = $derived( currentStory !== null && isCustomStoryId( currentStory.id ) );

    // Read here so the "my stories" footer buttons can target the currently
    // highlighted custom story directly, the same as the ENTER key.
    let customSelectedIndex = $derived( $terminal.customSelectedIndex );

    // Read here so the wiki open/navigate footer buttons can target the
    // currently highlighted entry directly, the same as the ENTER key.
    let wikiSelectedIndex = $derived( $terminal.wiki.selectedIndex );

    /**
     * Starts a fresh playthrough of the currently previewed story.
     *
     * @author Claude
     */
    const handleStart = () =>
    {
        if ( currentStory ) terminal.startStory( currentStory.id );
    };

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
    Two footers in one, chosen by screen size:
      - Desktop (>= sm): the full keyboard-shortcut legend. Every hint keeps its
        [KEY] label as a reminder and stays clickable for mouse users.
      - Mobile (< sm): page-navigation buttons only (short labels, no [KEY]).
        Every other action is reachable by tapping the matching on-page control
        (filters, list items, the story action bar, the search button).
    The underlying keyboard shortcuts (handled in Terminal.svelte) are unchanged.
-->
{#snippet control( label: string, onclick: () => void )}
    <!--
        A single legend hint. It only renders inside the desktop legend (from
        `sm` up), so `sm:flex-none` gives it its natural pill width; `flex-1`
        is the harmless below-`sm` fallback while the legend itself is hidden.
    -->
    <button
        type="button"
        class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        {onclick}
    >
        {label}
    </button>
{/snippet}

<!--
    Mobile page-navigation button: fills the row equally with its siblings and
    reads as a real touch target (larger hit area, no [KEY] prefix).
-->
{#snippet navButton( label: string, onclick: () => void )}
    <button
        type="button"
        class="flex-1 inline-flex items-center justify-center min-h-9 px-3 py-1.5 border border-terminal-dim/40 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        {onclick}
    >
        {label}
    </button>
{/snippet}

<footer
    class="shrink-0 border-t border-terminal-dim/30 px-2 py-1.5 text-xs text-terminal-dim flex flex-wrap items-center gap-1.5 select-none bg-[rgba(0,20,0,0.6)]"
    style="padding-bottom: calc( 0.375rem + env( safe-area-inset-bottom ) )"
>
    <!--
        Desktop keyboard-shortcut legend. Hidden on mobile; from `sm` up it uses
        `contents` so its buttons flex directly into the footer row.
    -->
    <nav id="terminal-controls-legend" class="hidden sm:contents" aria-label={m.controls_legend_aria()}>
        {#if view === "story"}
            {#if atGeneratedEnding || atStandardEnding}
                {#if isAnimating}
                    {@render control( m.controls_story_skip(), onSkip )}
                {:else}
                    {@render control( m.controls_story_ending(), handleRestart )}
                {/if}

                {@render control( m.controls_story_menu(), () => terminal.goBack() )}
            {:else}
                {#if isAnimating}
                    {@render control( m.controls_story_skip(), onSkip )}
                {/if}

                {@render control( m.controls_story_menu(), () => terminal.goBack() )}
            {/if}

            {#if !isGenerated && !isCustomStory}
                {@render control( m.controls_story_share(), () => terminal.openShare() )}
            {/if}
        {:else if view === "story-info"}
            {#if hasSave}
                {@render control( m.controls_story_info_resume(), handleResume )}
                {@render control( m.controls_story_info_new(), handleStart )}
                {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
            {:else}
                {@render control( m.controls_story_info_start(), handleStart )}
                {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
            {/if}

            {#if !isGenerated && !isCustomStory}
                {@render control( m.controls_story_info_fork(), onFork )}
                {@render control( m.controls_story_share(), () => terminal.openShare() )}
            {/if}
        {:else if view === "menu"}
            {#if searchActive}
                {@render control( m.controls_menu_cancel_search(), () => terminal.deactivateSearch() )}
            {:else}
                {@render control( m.controls_menu_genre(), () => terminal.cycleGenre() )}
                {@render control( m.controls_menu_language(), () => terminal.cycleLanguage() )}
                {@render control( m.controls_menu_reset(), () => terminal.clearFilters() )}
                {@render control( m.controls_menu_wiki(), () => terminal.openWiki() )}
                {@render control( m.controls_menu_ai(), () => terminal.openAiSetup() )}
                {@render control( m.controls_menu_achievements(), () => terminal.openAchievements() )}
                {@render control( m.controls_menu_custom(), () => terminal.openCustomStories() )}
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
            {/if}

            {@render control( m.controls_navigate_up(), () => onMenuNavigate( -1 ) )}
            {@render control( m.controls_navigate_down(), () => onMenuNavigate( 1 ) )}
            {@render control( m.controls_menu_select(), onMenuSelect )}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {@render control( m.controls_wiki_back(), () => terminal.backToWikiList() )}
            {:else if searchActive}
                <!-- Alphabetical by key: [ENTER], [ESC], [↑], [↓]. -->
                {@render control( m.controls_wiki_consult(), () => terminal.selectWikiEntryAt( wikiSelectedIndex ) )}
                {@render control( m.controls_menu_cancel_search(), () => terminal.deactivateSearch() )}
                {@render control( m.controls_navigate_up(), () => terminal.moveWikiSelection( -1 ) )}
                {@render control( m.controls_navigate_down(), () => terminal.moveWikiSelection( 1 ) )}
            {:else}
                <!-- Alphabetical by key: [/], [ENTER], [ESC], [←→], [↑], [↓]. -->
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
                {@render control( m.controls_wiki_consult(), () => terminal.selectWikiEntryAt( wikiSelectedIndex ) )}
                {@render control( m.controls_story_menu(), () => terminal.closeWiki() )}
                {@render control( m.controls_wiki_category(), () => terminal.cycleWikiCategory( 1 ) )}
                {@render control( m.controls_navigate_up(), () => terminal.moveWikiSelection( -1 ) )}
                {@render control( m.controls_navigate_down(), () => terminal.moveWikiSelection( 1 ) )}
            {/if}
        {:else if view === "achievements"}
            {@render control( m.controls_achievements_menu(), () => terminal.closeAchievements() )}
        {:else if view === "ai-setup"}
            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
        {:else if view === "custom-stories"}
            <!-- Alphabetical by key: [ENTER], [ESC], [N], [↑], [↓]. -->
            {@render control( m.controls_custom_open(), () => terminal.selectCustomStoryAt( customSelectedIndex ) )}
            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
            {@render control( m.controls_custom_new(), onCustomNew )}
            {@render control( m.controls_navigate_up(), () => terminal.moveCustomSelection( -1 ) )}
            {@render control( m.controls_navigate_down(), () => terminal.moveCustomSelection( 1 ) )}
        {:else if view === "editor"}
            {@render control( m.controls_editor_back(), () => terminal.closeEditor() )}
        {/if}
    </nav>

    <!--
        Mobile navigation. Only buttons that reach another page live here; every
        other action (filters, list selection, start/skip/share, search) is done
        by tapping its dedicated on-page control. Hidden from `sm` up, where the
        legend above takes over.
    -->
    <nav class="contents sm:hidden" aria-label={m.controls_nav_aria()}>
        {#if view === "menu"}
            {@render navButton( m.nav_wiki(), () => terminal.openWiki() )}
            {@render navButton( m.nav_ai(), () => terminal.openAiSetup() )}
            {@render navButton( m.nav_achievements(), () => terminal.openAchievements() )}
            {@render navButton( m.nav_custom(), () => terminal.openCustomStories() )}
        {:else if view === "story"}
            {@render navButton( m.nav_back_to_stories(), () => terminal.goBack() )}
        {:else if view === "story-info"}
            {@render navButton( m.nav_back_to_stories(), () => terminal.startMenu() )}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {@render navButton( m.nav_back_to_list(), () => terminal.backToWikiList() )}
            {:else}
                {@render navButton( m.nav_back_to_stories(), () => terminal.closeWiki() )}
            {/if}
        {:else if view === "achievements"}
            {@render navButton( m.nav_back_to_stories(), () => terminal.closeAchievements() )}
        {:else if view === "ai-setup"}
            {@render navButton( m.nav_back_to_stories(), () => terminal.startMenu() )}
        {:else if view === "custom-stories"}
            {@render navButton( m.nav_back_to_stories(), () => terminal.startMenu() )}
        {:else if view === "editor"}
            {@render navButton( m.nav_back_to_custom(), () => terminal.closeEditor() )}
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
            1.0.0
        </code>
    {/if}
</footer>
