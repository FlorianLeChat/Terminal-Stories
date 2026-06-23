<script lang="ts">
    import { onMount } from "svelte";
    import { terminal } from "$lib/stores/terminal";
    import { storiesMeta, filterStories } from "$lib/data";
    import { hasSave } from "$lib/utilities/saveService";
    import BootSequence from "./BootSequence.svelte";
    import StoryMenu from "./StoryMenu.svelte";
    import TerminalOutput from "./TerminalOutput.svelte";
    import WikiBrowser from "./WikiBrowser.svelte";
    import TerminalControls from "./TerminalControls.svelte";

    let view = $derived( $terminal.view );
    let lines = $derived( $terminal.lines );
    let selectedIndex = $derived( $terminal.selectedStoryIndex );
    let visibleStories = $derived( filterStories( storiesMeta, $terminal.filters ) );

    /** Incremented each time the user requests an animation skip. */
    let skipAnimationSignal = $state( 0 );
    /** Bound to TerminalOutput — true while lines are being typed out. */
    let isAnimating = $state( false );

    // Re-evaluated each time the story-info screen opens (view or story changes),
    // reading from localStorage to know whether to offer the resume option.
    let currentStoryHasSave = $derived(
        $terminal.view === "story-info" && $terminal.currentStory
            ? hasSave( $terminal.currentStory.id )
            : false
    );

    /**
     * Leaves the boot screen and shows the main menu.
     *
     * @author Claude
     */
    const handleBoot = () =>
    {
        terminal.startMenu();
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
            skipAnimationSignal++;
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
            if ( scene?.isEnding ) terminal.goBack();
        }
    };

    // Grab focus on mount so keyboard input is captured without a click first.
    onMount( () =>
    {
        window.focus();
    } );
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="crt-wrapper h-screen w-screen flex items-center justify-center bg-black overflow-hidden">
    <div class="monitor relative w-full max-w-4xl h-full max-h-screen flex flex-col">
        <div class="scanlines pointer-events-none"></div>

        <div class="screen flex flex-col h-full overflow-hidden" role="main">
            <div
                class="status-bar flex items-center justify-between px-4 py-1 text-xs font-mono text-terminal-dim border-b border-terminal-dim/30 select-none shrink-0"
                role="banner"
                aria-label="Barre d'état"
            >
                <span>TERMINAL STORIES</span>

                <span class="flex items-center gap-4">
                    {#if view === "story" && $terminal.currentStory}
                        <span class="text-terminal-amber">{$terminal.currentStory.title}</span>
                        <span>|</span>
                    {/if}

                    <span class="text-terminal-green">
                        {#if view === "boot"}DÉMARRAGE{/if}
                        {#if view === "menu"}MENU PRINCIPAL{/if}
                        {#if view === "story-info"}INFO HISTOIRE{/if}
                        {#if view === "story"}LECTURE EN COURS{/if}
                        {#if view === "wiki"}BASE DE CONNAISSANCES{/if}
                    </span>
                </span>

                <span class="cursor-blink">█</span>
            </div>

            <div class="flex-1 flex flex-col overflow-hidden">
                {#if view === "boot"}
                    <BootSequence ondone={handleBoot} />
                {:else if view === "menu"}
                    <StoryMenu {selectedIndex} onselect={handleMenuSelect} onnavigate={handleMenuNavigate} />
                {:else if view === "story-info" || view === "story"}
                    <TerminalOutput {lines} animated={view === "story"} skipSignal={skipAnimationSignal} bind:isAnimating onchoice={terminal.makeChoice} />
                {:else if view === "wiki"}
                    <WikiBrowser />
                {/if}
            </div>

            <TerminalControls
                {view}
                hasSave={currentStoryHasSave}
                {isAnimating}
                wikiEntryOpen={!!$terminal.wiki.selectedEntryId}
            />
        </div>
    </div>
</div>

<style>
    .crt-wrapper {
        background: #000;
    }

    .monitor {
        background: #0a0f0a;
        box-shadow: 0 0 60px rgba(0, 255, 70, 0.08), inset 0 0 60px rgba(0, 0, 0, 0.8);
    }

    .screen {
        position: relative;
        background: #050e05;
    }

    .scanlines {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 2px,
            rgba(0, 0, 0, 0.08) 2px,
            rgba(0, 0, 0, 0.08) 4px
        );
        z-index: 10;
    }

    .status-bar {
        background: rgba(0, 20, 0, 0.8);
    }

    .cursor-blink {
        animation: blink 1s step-end infinite;
        color: #00ff46;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .cursor-blink {
            animation: none;
        }
    }
</style>
