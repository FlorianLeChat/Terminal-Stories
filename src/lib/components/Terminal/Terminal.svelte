<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { resolve } from "$app/paths";
    import { replaceState } from "$app/navigation";
    import { terminal } from "$lib/stores/terminal";
    import BootSequence from "../BootSequence.svelte";
    import StoryMenu from "../Story/StoryMenu.svelte";
    import TerminalOutput from "./TerminalOutput.svelte";
    import WikiBrowser from "../Wiki/WikiBrowser.svelte";
    import AchievementsBrowser from "../Achievements/AchievementsBrowser.svelte";
    import AchievementToast from "../Achievements/AchievementToast.svelte";
    import EndingToast from "../Story/EndingToast.svelte";
    import AiStorySetup from "../AiStorySetup.svelte";
    import TerminalControls from "./TerminalControls.svelte";
    import TerminalHeader from "./TerminalHeader.svelte";
    import ShareDialog from "./ShareDialog.svelte";
    import { storiesMeta, filterStories, searchStories, hasSave, parseDeepLink, deepLinkSearch, playKeyPress, playNavigate, playSelect, playBack, resumeAudio, startMusic, type DeepLinkTarget } from "$lib";
    import { sound } from "$lib/stores/sound";

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

    // Surfaces the achievement/ending toast for the ending just reached only
    // once its dialogue has fully finished typing (or immediately when the
    // typewriter is skipped/disabled), rather than the instant the ending
    // scene is rendered.
    $effect( () =>
    {
        if ( isAnimating ) return;
        if ( $terminal.pendingEndingReveal ) terminal.revealEndingToasts();
    } );

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

    // The shareable location matching the current view: a story (info/playback)
    // or an open wiki entry. Any other view (menu, boot, wiki list, AI setup)
    // has no dedicated URL and maps to `null`.
    let deepLinkTarget = $derived.by( (): DeepLinkTarget | null =>
    {
        const isStoryView = $terminal.view === "story-info" || $terminal.view === "story";
        const storyId = $terminal.currentStory?.id;

        if ( isStoryView && storyId )
        {
            return { type: "story", id: storyId };
        }

        const openWikiEntryId = $terminal.view === "wiki" ? $terminal.wiki.selectedEntryId : null;

        if ( openWikiEntryId )
        {
            return { type: "wiki", id: openWikiEntryId };
        }

        return null;
    } );

    // Keep the address bar in sync with the current target so stories and wiki
    // entries stay shareable/bookmarkable. `replaceState` avoids growing the
    // history stack — the app drives its own back navigation via ESC.
    $effect( () =>
    {
        // The URL must survive the boot screen so a deep link can be read once
        // booting finishes (see handleBoot); never rewrite it before then.
        if ( $terminal.view === "boot" ) return;

        const search = deepLinkSearch( deepLinkTarget );

        if ( search === page.url.search ) return;

        // resolve() keeps the configured base path and swaps only the query
        // string on the single app route, satisfying typed-route navigation.
        replaceState( resolve( `/${ search }` ), {} );
    } );

    /**
     * Opens the story or wiki entry referenced by a deep link, restoring the
     * matching view directly instead of the default menu.
     *
     * @param target - The validated target parsed from the URL.
     * @author Claude
     */
    const applyDeepLink = ( target: DeepLinkTarget ) =>
    {
        if ( target.type === "story" )
        {
            terminal.selectStory( target.id );
        }
        else
        {
            // openRelatedEntry selects the entry within its own category so a
            // later "back" (ESC) lands on a coherent, populated list.
            terminal.openWiki();
            terminal.openRelatedEntry( target.id );
        }
    };

    /**
     * Leaves the boot screen: honours a deep link when the URL points to a
     * story or wiki entry, otherwise falls back to the main menu. The URL is
     * now the sole source of truth for restoring a story after a refresh.
     *
     * @author Claude
     */
    const handleBoot = () =>
    {
        // Pressing ENTER/clicking to leave boot is a user gesture: resume a
        // context suspended by the autoplay policy so the menu ambiance that
        // follows can play. No-op when sound is off.
        resumeAudio();

        const target = parseDeepLink( page.url.searchParams );

        if ( target )
        {
            applyDeepLink( target );
            return;
        }

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
     * Steps the highlighted menu story up or down by one position, wrapping
     * around the visible list. Shared by the ArrowUp/ArrowDown keys and the
     * footer's navigation buttons so both stay in sync.
     *
     * @param delta - -1 to move to the previous story, 1 for the next one.
     * @author Claude
     */
    const handleMenuStep = ( delta: -1 | 1 ) =>
    {
        const count = visibleStories.length;
        if ( count === 0 ) return;

        terminal.update( ( s ) => ( { ...s, selectedStoryIndex: ( s.selectedStoryIndex + delta + count ) % count } ) );
    };

    /**
     * Opens the story currently highlighted in the menu — the same action as
     * pressing ENTER. Shared by the keyboard handler and the footer's select
     * button.
     *
     * @author Claude
     */
    const handleMenuSelectCurrent = () =>
    {
        const count = visibleStories.length;
        if ( count === 0 ) return;

        terminal.selectStory( visibleStories[ $terminal.selectedStoryIndex ].id );
    };

    /**
     * Plays a single interface sound matched to the key pressed: a selection
     * chime on ENTER, a back blip on ESC, a navigation blip on arrows, and a
     * subtle click for everything else. Held keys (auto-repeat) and bare
     * modifier presses are ignored so the feedback never machine-guns.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const playKeySound = ( e: KeyboardEvent ) =>
    {
        if ( e.repeat ) return;

        // This keydown is a user gesture: when sound is on, resume a context
        // suspended by the autoplay policy so sound persisted as enabled comes
        // back to life. Skipped while muted so no context is created needlessly.
        if ( $sound.enabled ) resumeAudio();

        const key = e.key;
        const isModifier = key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
        if ( isModifier ) return;

        const isArrow = key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";

        if ( key === "Enter" ) playSelect();
        else if ( key === "Escape" ) playBack();
        else if ( isArrow ) playNavigate();
        else playKeyPress();
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

        // While the share overlay is open, let the native <dialog> own the input
        // (ESC closes it); don't fire story/menu shortcuts underneath it.
        if ( $terminal.shareOpen ) return;

        // Interface feedback: one subtle sound per key press (no-op when muted).
        playKeySound( e );

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

        // Global mute toggle: M works on any view, except while typing in an
        // input (where it must stay a literal character).
        if ( ( e.key === "m" || e.key === "M" ) && !isInputFocused )
        {
            e.preventDefault();
            sound.toggle();
            return;
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
        if ( view === "achievements" )
        {
            handleAchievementsKey( e );
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

            if ( key === "a" )
            {
                e.preventDefault();
                terminal.openAchievements();
                return;
            }
        }

        const count = visibleStories.length;
        if ( count === 0 ) return;

        if ( e.key === "ArrowDown" )
        {
            e.preventDefault();
            handleMenuStep( 1 );
        }
        else if ( e.key === "ArrowUp" )
        {
            e.preventDefault();
            handleMenuStep( -1 );
        }
        else if ( e.key === "Enter" )
        {
            handleMenuSelectCurrent();
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

        if ( e.key.toLowerCase() === "s" )
        {
            e.preventDefault();
            terminal.openShare();
            return;
        }

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
     * Handles keys on the achievements screen: ESC returns to the main menu.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleAchievementsKey = ( e: KeyboardEvent ) =>
    {
        if ( e.key === "Escape" )
        {
            e.preventDefault();
            terminal.closeAchievements();
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

        // [S] opens the share overlay (ignored for generated stories by the store).
        if ( e.key.toLowerCase() === "s" )
        {
            e.preventDefault();
            terminal.openShare();
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

    /**
     * Plays a click sound when the user activates any interactive control with
     * a pointer (mouse/touch): menu entries, filters, story choices, footer
     * actions, dialogs... Delegated on the window so every current and future
     * button is covered without wiring each handler by hand. Pointer events
     * never fire for keyboard activation, so this never doubles up with the
     * per-key sound in handleKeydown.
     *
     * @param e - The pointer event.
     * @author Claude
     */
    const handlePointerDown = ( e: PointerEvent ) =>
    {
        if ( !$sound.enabled ) return;

        const target = e.target as HTMLElement | null;

        // Only genuine controls click; the volume slider (a range input) is left
        // out so dragging it stays silent.
        const control = target?.closest( "button, a, [role=button]" );
        if ( !control ) return;

        // This pointer gesture can resume a context suspended by autoplay.
        resumeAudio();
        playSelect();
    };

    // Grab focus on mount so keyboard input is captured without a click first.
    onMount( () =>
    {
        window.focus();

        // Request the shell ambiance from the very first (boot) screen. It plays
        // right away for returning users with sound on, and is simply remembered
        // (until the first gesture) for everyone else, so startup has music too.
        startMusic( "menu" );
    } );
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={handlePointerDown} />

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
    {:else if view === "achievements"}
        <AchievementsBrowser />
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
        onMenuNavigate={handleMenuStep}
        onMenuSelect={handleMenuSelectCurrent}
    />

    {#if view === "story" || view === "story-info"}
        <ShareDialog />
    {/if}

    <div class="absolute left-1/2 top-4 z-20 flex w-[min(94%,32rem)] -translate-x-1/2 flex-col items-center gap-2">
        <EndingToast />
        <AchievementToast />
    </div>
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
