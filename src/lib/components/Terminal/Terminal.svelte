<script lang="ts">
    import { onMount } from "svelte";
    import { terminal } from "$lib/stores/terminal";
    import BootSequence from "../BootSequence.svelte";
    import StoryMenu from "../Story/StoryMenu.svelte";
    import TerminalOutput from "./TerminalOutput.svelte";
    import WikiBrowser from "../Wiki/WikiBrowser.svelte";
    import AiStorySetup from "../AiStorySetup.svelte";
    import TerminalControls from "./TerminalControls.svelte";
    import TerminalHeader from "./TerminalHeader.svelte";
    import { storiesMeta, filterStories, searchStories, hasSave, loadActiveSession } from "$lib";

    let view = $derived( $terminal.view );
    let lines = $derived( $terminal.lines );
    let selectedIndex = $derived( $terminal.selectedStoryIndex );
    let visibleStories = $derived(
        $terminal.searchActive && $terminal.searchQuery !== ""
            ? filterStories( searchStories( $terminal.searchQuery ), $terminal.filters )
            : filterStories( storiesMeta, $terminal.filters )
    );

    /**
     * Tracks animation-skip requests paired with the storyKey at the time of the
     * request. When storyKey changes (story restart), effectiveSkipSignal resets
     * to 0 automatically so the new playthrough always starts with the typewriter.
     */
    let skipState = $state( { count: 0, key: -1 } );
    let effectiveSkipSignal = $derived(
        skipState.key === $terminal.storyKey ? skipState.count : 0
    );

    /** Bound to TerminalOutput — true while lines are being typed out. */
    let isAnimating = $state( false );

    // True when playing a generated story and sitting on an ending scene, so the
    // footer can offer restart/menu the same way classic stories surface hints.
    let atGeneratedEnding = $derived(
        $terminal.view === "story"
        && $terminal.currentStoryIsGenerated
        && $terminal.currentStory?.scenes[ $terminal.gameState?.currentScene ?? "" ]?.isEnding === true
    );

    // True when playing a catalog story and sitting on an ending scene, so the
    // footer switches from choice hints to the menu hint.
    let atStandardEnding = $derived(
        $terminal.view === "story"
        && !$terminal.currentStoryIsGenerated
        && $terminal.currentStory?.scenes[ $terminal.gameState?.currentScene ?? "" ]?.isEnding === true
    );

    // Re-evaluated each time the story-info screen opens (view or story changes),
    // reading from localStorage to know whether to offer the resume option.
    let currentStoryHasSave = $derived(
        $terminal.view === "story-info" && $terminal.currentStory
            ? hasSave( $terminal.currentStory.id )
            : false
    );

    /**
     * Leaves the boot screen: resumes the active story if one was interrupted by
     * a page refresh, otherwise shows the main menu.
     *
     * @author Claude
     */
    const handleBoot = () =>
    {
        const activeStoryId = loadActiveSession();
        const canResume = activeStoryId !== null && hasSave( activeStoryId );

        if ( canResume )
        {
            terminal.selectStory( activeStoryId );
        }
        else
        {
            terminal.startMenu();
        }
    };

    /**
     * Opens the info screen for the chosen story.
     *
     * @param id - The id of the selected story.
     * @author Claude
     */
    const handleMenuSelect = ( id: string ) =>
    {
        terminal.selectStory( id );
    };

    /**
     * Updates the highlighted story in the menu (e.g. on hover).
     *
     * @param index - The index of the story to highlight.
     * @author Claude
     */
    const handleMenuNavigate = ( index: number ) =>
    {
        terminal.update( ( s ) => ( { ...s, selectedStoryIndex: index } ) );
    };

    /**
     * Global key handler: dispatches the event to the handler for the current
     * view. Boot input is handled by the boot component itself.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleKeydown = ( e: KeyboardEvent ) =>
    {
        if ( view === "boot" ) return;

        // The AI setup screen is a plain form: let typing flow to the focused
        // field, and only intercept ESC to return to the menu.
        if ( view === "ai-setup" )
        {
            if ( e.key === "Escape" )
            {
                e.preventDefault();
                terminal.startMenu();
            }

            return;
        }

        const isInputFocused = document.activeElement instanceof HTMLInputElement;

        // When the search input is focused, intercept ESC to close search;
        // let navigation keys fall through; swallow everything else.
        if ( isInputFocused )
        {
            if ( e.key === "Escape" )
            {
                e.preventDefault();
                terminal.deactivateSearch();
            }
            else if ( e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Enter" )
            {
                return;
            }
        }

        // Global search trigger: / activates search on any searchable view.
        if ( e.key === "/" && !isInputFocused )
        {
            if ( view === "menu" || view === "wiki" )
            {
                e.preventDefault();
                terminal.activateSearch();
                return;
            }

            if ( view === "story" || view === "story-info" )
            {
                e.preventDefault();
                terminal.startMenu();
                terminal.activateSearch();
                return;
            }
        }

        if ( view === "menu" )
        {
            handleMenuKey( e );
            return;
        }
        if ( view === "story-info" )
        {
            handleInfoKey( e );
            return;
        }
        if ( view === "story" )
        {
            handleStoryKey( e );
            return;
        }
        if ( view === "wiki" )
        {
            handleWikiKey( e );
            return;
        }
    };

    /**
     * Handles keys on the main menu: filter shortcuts (G/L/C/W), arrow
     * navigation, ENTER to open a story, and number keys for direct access.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleMenuKey = ( e: KeyboardEvent ) =>
    {
        const key = e.key.toLowerCase();

        // Single-letter shortcuts are blocked while the search input is open
        // so they don't trigger filters when the user is typing a query.
        if ( !$terminal.searchActive )
        {
            if ( key === "g" )
            {
                e.preventDefault();
                terminal.cycleGenre();
                return;
            }

            if ( key === "l" )
            {
                e.preventDefault();
                terminal.cycleLanguage();
                return;
            }

            if ( key === "c" )
            {
                e.preventDefault();
                terminal.clearFilters();
                return;
            }

            if ( key === "w" )
            {
                e.preventDefault();
                terminal.openWiki();
                return;
            }

            if ( key === "i" )
            {
                e.preventDefault();
                terminal.openAiSetup();
                return;
            }
        }

        const count = visibleStories.length;
        if ( count === 0 ) return;

        if ( e.key === "ArrowDown" )
        {
            e.preventDefault();
            terminal.update( ( s ) => ( { ...s, selectedStoryIndex: ( s.selectedStoryIndex + 1 ) % count } ) );
        }
        else if ( e.key === "ArrowUp" )
        {
            e.preventDefault();
            terminal.update( ( s ) => ( { ...s, selectedStoryIndex: ( s.selectedStoryIndex - 1 + count ) % count } ) );
        }
        else if ( e.key === "Enter" )
        {
            terminal.selectStory( visibleStories[ $terminal.selectedStoryIndex ].id );
        }
        else
        {
            const num = parseInt( e.key );

            if ( !isNaN( num ) && num >= 1 && num <= count )
            {
                terminal.selectStory( visibleStories[ num - 1 ].id );
            }
        }
    };

    /**
     * Handles keys on the story-info screen. When a save exists: ENTER resumes,
     * N starts a new game. Without a save: ENTER starts a new game. ESC always
     * returns to the menu.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleInfoKey = ( e: KeyboardEvent ) =>
    {
        const storyId = $terminal.currentStory?.id;
        if ( !storyId ) return;

        if ( e.key === "Enter" )
        {
            if ( currentStoryHasSave )
            {
                terminal.resumeStory( storyId );
            }
            else
            {
                terminal.startStory( storyId );
            }
        }
        else if ( e.key.toLowerCase() === "n" && currentStoryHasSave )
        {
            terminal.startStory( storyId );
        }
        else if ( e.key === "Escape" )
        {
            terminal.startMenu();
        }
    };

    /**
     * Handles keys in the wiki: ESC steps back (entry → list → menu), arrows
     * change category and navigate entries, ENTER opens the highlighted entry.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleWikiKey = ( e: KeyboardEvent ) =>
    {
        const wiki = $terminal.wiki;

        if ( e.key === "Escape" )
        {
            e.preventDefault();

            if ( wiki.selectedEntryId )
            {
                terminal.backToWikiList();
            }
            else
            {
                terminal.closeWiki();
            }

            return;
        }

        if ( wiki.selectedEntryId ) return;

        if ( e.key === "ArrowRight" )
        {
            e.preventDefault();
            terminal.cycleWikiCategory( 1 );
        }
        else if ( e.key === "ArrowLeft" )
        {
            e.preventDefault();
            terminal.cycleWikiCategory( -1 );
        }
        else if ( e.key === "ArrowDown" )
        {
            e.preventDefault();
            terminal.moveWikiSelection( 1 );
        }
        else if ( e.key === "ArrowUp" )
        {
            e.preventDefault();
            terminal.moveWikiSelection( -1 );
        }
        else if ( e.key === "Enter" )
        {
            e.preventDefault();
            terminal.selectWikiEntryAt( wiki.selectedIndex );
        }
    };

    /**
     * Skips the running typewriter animation by bumping the skip signal. Shared
     * by the SPACE shortcut and the touch control in the footer.
     *
     * @author Claude
     */
    const handleSkip = () =>
    {
        skipState = { count: skipState.count + 1, key: $terminal.storyKey };
    };

    /**
     * Handles keys during story playback: number keys pick a choice, ESC
     * returns to the menu, and ENTER on an ending returns to the menu.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleStoryKey = ( e: KeyboardEvent ) =>
    {
        if ( e.key === " " && isAnimating )
        {
            e.preventDefault();
            handleSkip();
            return;
        }

        if ( e.key === "Escape" )
        {
            terminal.goBack();
            return;
        }

        const num = parseInt( e.key );
        if ( !isNaN( num ) && num >= 1 && num <= 9 )
        {
            terminal.makeChoice( num );
        }

        if ( e.key === "Enter" )
        {
            const scene = $terminal.currentStory?.scenes[ $terminal.gameState?.currentScene ?? "" ];
            if ( !scene?.isEnding ) return;

            // ENTER replays the story from the start on any ending, whether
            // AI-generated or catalog. ESC returns to the menu instead.
            if ( $terminal.currentStoryIsGenerated )
            {
                terminal.restartGeneratedStory();
            }
            else
            {
                terminal.restartStory();
            }
        }
    };

    // Grab focus on mount so keyboard input is captured without a click first.
    onMount( () =>
    {
        window.focus();
    } );
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="bg-terminal-bg monitor relative w-full h-full max-w-4xl flex flex-col">
    <div class="scanlines inset-0 absolute z-10 pointer-events-none"></div>

    <TerminalHeader {view} />

    {#if view === "boot"}
        <BootSequence ondone={handleBoot} />
    {:else if view === "menu"}
        <StoryMenu {selectedIndex} onselect={handleMenuSelect} onnavigate={handleMenuNavigate} />
    {:else if view === "story-info" || view === "story"}
        {#key $terminal.storyKey}
            <TerminalOutput {lines} animated={view === "story"} skipSignal={effectiveSkipSignal} bind:isAnimating onchoice={terminal.makeChoice} />
        {/key}
    {:else if view === "wiki"}
        <WikiBrowser />
    {:else if view === "ai-setup"}
        <AiStorySetup />
    {/if}

    <TerminalControls
        {view}
        hasSave={currentStoryHasSave}
        {isAnimating}
        wikiEntryOpen={!!$terminal.wiki.selectedEntryId}
        searchActive={$terminal.searchActive}
        {atGeneratedEnding}
        {atStandardEnding}
        endingsFound={$terminal.endingsFound}
        endingsTotal={$terminal.endingsTotal}
        onSkip={handleSkip}
    />
</main>

<style>
    .monitor {
        box-shadow: 0 0 60px rgba(0, 255, 70, 0.08), inset 0 0 60px rgba(0, 0, 0, 0.8);
    }

    .scanlines {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 2px,
            rgba(0, 0, 0, 0.20) 2px,
            rgba(0, 0, 0, 0.20) 4px
        );
    }
</style>
