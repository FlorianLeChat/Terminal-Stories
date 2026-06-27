<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import type { TerminalView } from "$lib/stores/terminal";

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
        /** Number of endings discovered so far (meaningful only when at an ending). */
        endingsFound: number;
        /** Total endings in the current story (meaningful only when at an ending). */
        endingsTotal: number;
        /** Skips the running typewriter animation (owned by the parent terminal). */
        onSkip: () => void;
    }

    let {
        view,
        hasSave,
        isAnimating,
        wikiEntryOpen,
        searchActive,
        atGeneratedEnding,
        atStandardEnding,
        endingsFound,
        endingsTotal,
        onSkip
    }: Props = $props();

    const showEndingsCount = $derived( ( atGeneratedEnding || atStandardEnding ) && endingsTotal > 0 );

    // Read here so the story-info actions can target the current story directly,
    // letting every control work by touch as well as by keyboard.
    let currentStory = $derived( $terminal.currentStory );

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
    <button
        type="button"
        class="inline-flex items-center min-h-8 px-2 py-1 border border-terminal-dim/30 rounded whitespace-nowrap text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        {onclick}
    >
        {label}
    </button>
{/snippet}

<!--
    `class="contents"` on <nav> makes it layout-invisible (its children
    participate directly in the footer's flex container) while preserving its
    semantic role: these buttons navigate between app views.
-->
<footer
    class="shrink-0 border-t border-terminal-dim/30 px-2 py-1.5 text-xs text-terminal-dim flex flex-wrap items-center gap-1.5 select-none bg-[rgba(0,20,0,0.6)]"
    style="padding-bottom: calc( 0.375rem + env( safe-area-inset-bottom ) )"
>
    <nav class="contents">
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
        {:else if view === "story-info"}
            {#if hasSave}
                {@render control( m.controls_story_info_resume(), handleResume )}
                {@render control( m.controls_story_info_new(), handleStart )}
                {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
            {:else}
                {@render control( m.controls_story_info_start(), handleStart )}
                {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
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
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
            {/if}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {@render control( m.controls_wiki_back(), () => terminal.backToWikiList() )}
            {:else if searchActive}
                {@render control( m.controls_menu_cancel_search(), () => terminal.deactivateSearch() )}
            {:else}
                {@render control( m.controls_wiki_category(), () => terminal.cycleWikiCategory( 1 ) )}
                {@render control( m.controls_story_menu(), () => terminal.closeWiki() )}
                {@render control( m.controls_menu_search(), () => terminal.activateSearch() )}
            {/if}
        {:else if view === "ai-setup"}
            {@render control( m.controls_story_menu(), () => terminal.startMenu() )}
        {/if}
    </nav>

    {#if showEndingsCount}
        <output class="ml-auto flex items-center gap-3">
            {m.ai_endings_progress( { found: endingsFound, total: endingsTotal } )}
        </output>
    {/if}

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
