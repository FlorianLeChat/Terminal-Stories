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

    // On mobile the control bar can hold many buttons that wrap onto several
    // rows, eating precious vertical space. There it can be folded away behind
    // a toggle; from `sm` up the bar is always shown and the toggle is hidden.
    // Expanded by default so touch navigation stays discoverable; the choice is
    // kept per session only (reset on reload).
    let controlsExpanded = $state( true );

    // The toggle is only meaningful when the nav actually holds controls, which
    // is every view except the boot screen (whose footer is just a source link).
    let canToggleControls = $derived( view !== "boot" );

    // On mobile, fold the nav away (display: none) when collapsed; `contents`
    // keeps it layout-invisible when shown. The `sm:contents` class in the
    // markup always wins from `sm` up, so this only affects small screens.
    let navVisibilityClass = $derived( controlsExpanded ? "contents" : "hidden" );

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
    Control bar — every hint is a real, tappable button so the whole app is
    usable by touch on mobile, while remaining clickable on desktop. The
    underlying keyboard shortcuts (handled in Terminal.svelte) are unchanged,
    and the [KEY] labels keep doubling as shortcut reminders.
-->
{#snippet control( label: string, onclick: () => void )}
    <!--
        `flex-1` (grow + shrink + 0% basis) makes the buttons share each wrapped
        row equally on mobile, so they stretch to fill the free space instead of
        leaving a ragged right edge. `min-width: auto` still keeps a button from
        shrinking below its label. From `sm` up, `sm:flex-none` restores the
        natural pill width.
    -->
    <button
        type="button"
        class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
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
        `contents` keeps the nav layout-invisible (children flex directly). On
        mobile it collapses to `hidden` when folded; from `sm` up it is always
        `contents` regardless of the toggle state.
    -->
    <nav id="terminal-controls-nav" class="{navVisibilityClass} sm:contents">
        {#if view === "story"}
            {#if atGeneratedEnding || atStandardEnding}
                {@render control( m.controls_story_ending(), handleRestart )}
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

    <!--
        Mobile-only fold toggle. Deliberately styled unlike the control pills
        (no bordered pill, full width, its own divider) so it reads as footer
        chrome rather than one more control. `order-last` + `w-full` drop it
        onto its own row at the very bottom for easy thumb reach. Hidden from
        `sm` up, where the bar is always shown.
    -->
    {#if canToggleControls}
        <button
            type="button"
            class="sm:hidden order-last w-full flex items-center justify-center gap-2 min-h-9 mt-0.5 pt-2 border-t border-terminal-dim/25 tracking-wide uppercase text-terminal-dim/80 hover:text-terminal-white active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
            aria-expanded={controlsExpanded}
            aria-controls="terminal-controls-nav"
            onclick={() => ( controlsExpanded = !controlsExpanded )}
        >
            <span aria-hidden="true">{controlsExpanded ? "▾" : "▸"}</span>
            {m.controls_toggle()}
        </button>
    {/if}
</footer>
