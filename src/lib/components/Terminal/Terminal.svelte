<script lang="ts">
    import { onMount } from "svelte";
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { sound } from "#lib/stores/sound.ts";
    import HelpDialog from "./HelpDialog.svelte";
    import * as m from "#lib/locales/messages.js";
    import ShareDialog from "./ShareDialog.svelte";
    import { display } from "#lib/stores/display.ts";
    import BootSequence from "../BootSequence.svelte";
    import StoryMenu from "../Story/StoryMenu.svelte";
    import AiStorySetup from "../AiStorySetup.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import { terminal } from "#lib/stores/terminal.ts";
    import TerminalOutput from "./TerminalOutput.svelte";
    import WikiBrowser from "../Wiki/WikiBrowser.svelte";
    import TerminalHeader from "./TerminalHeader.svelte";
    import EndingToast from "../Story/EndingToast.svelte";
    import StoryEditor from "../Editor/StoryEditor.svelte";
    import TerminalControls from "./TerminalControls.svelte";
    import StoryActionBar from "../Story/StoryActionBar.svelte";
    import AchievementToast from "../Achievements/AchievementToast.svelte";
    import CustomStoriesMenu from "../CustomStories/CustomStoriesMenu.svelte";
    import AchievementsBrowser from "../Achievements/AchievementsBrowser.svelte";
    import { storiesMeta, filterStories, searchStories, hasSave, parseDeepLink, deepLinkError, deepLinkSearch, playKeyPress, playNavigate, playSelect, playBack, resumeAudio, startMusic, createBlankStory, forkStory, isCustomStoryId, customStoryErrorMessage, resolvePhosphor, storyLocale, DEFAULT_PHOSPHOR, type DeepLinkTarget, type PhosphorTheme } from "#lib";

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

    /**
     * Phosphor (color theme) of the monitor: the story's own on the story
     * views, the default green everywhere else.
     *
     * @author Claude
     */
    let phosphor = $derived.by( (): PhosphorTheme =>
    {
        const isStoryView = view === "story-info" || view === "story";
        const story = $terminal.currentStory;

        return isStoryView && story ? resolvePhosphor( story ) : DEFAULT_PHOSPHOR;
    } );

    /**
     * Locale of the current story, used to print in-story strings in its own
     * language.
     *
     * @author Claude
     */
    let currentStoryLocale = $derived( storyLocale( $terminal.currentStory?.language ?? "" ) );

    /** Wrapper of the current view, target of the skip link. */
    let contentEl: HTMLElement | undefined = $state();

    /**
     * Moves focus past the status bar to the current view without touching
     * the address bar (which only ever carries the deep-link query).
     *
     * @param e - The click event of the skip link.
     * @author Claude
     */
    const handleSkipToContent = ( e: MouseEvent ) =>
    {
        e.preventDefault();
        contentEl?.focus();
    };

    /**
     * Bound to TerminalOutput: true while lines are being typed out. The
     * ending and achievement toasts wait for it to fall, so they surface once
     * the ending's dialogue has finished typing (or right away when skipped).
     *
     * @author Claude
     */
    let isAnimating = $state( false );

    $effect( () =>
    {
        if ( isAnimating ) return;
        if ( $terminal.pendingEndingReveal ) terminal.revealEndingToasts();
    } );

    /**
     * True when playing a generated story and sitting on an ending scene.
     *
     * @author Claude
     */
    let atGeneratedEnding = $derived(
        $terminal.view === "story"
        && $terminal.currentStoryIsGenerated
        && $terminal.currentStory?.scenes[ $terminal.gameState?.currentScene ?? "" ]?.isEnding === true
    );

    /**
     * True when playing a non-generated story and sitting on an ending scene.
     *
     * @author Claude
     */
    let atStandardEnding = $derived(
        $terminal.view === "story"
        && !$terminal.currentStoryIsGenerated
        && $terminal.currentStory?.scenes[ $terminal.gameState?.currentScene ?? "" ]?.isEnding === true
    );

    /**
     * Whether the previewed story has a save to resume, read from localStorage
     * each time the story-info screen opens.
     *
     * @author Claude
     */
    let currentStoryHasSave = $derived(
        $terminal.view === "story-info" && $terminal.currentStory
            ? hasSave( $terminal.currentStory.id )
            : false
    );

    /**
     * Shareable location of the current view: a story (info or playback) or
     * an open wiki entry, `null` for every other view. Custom stories are
     * private and never written to the address bar.
     *
     * Mirrored into the address bar with a shallow, replacing `goto` (ESC
     * drives the back navigation, so the history never grows), but only once
     * boot is over: the URL must survive until handleBoot reads the deep link.
     *
     * @author Claude
     */
    let deepLinkTarget = $derived.by( (): DeepLinkTarget | null =>
    {
        const isStoryView = $terminal.view === "story-info" || $terminal.view === "story";
        const storyId = $terminal.currentStory?.id;

        if ( isStoryView && storyId && !isCustomStoryId( storyId ) )
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

    $effect( () =>
    {
        if ( $terminal.view === "boot" ) return;

        const search = deepLinkSearch( deepLinkTarget );

        // Live address bar, not page.url: shallow routing never updates page.url.
        if ( search === window.location.search ) return;

        goto( resolve( `/${ search }` ), { shallow: true, replace: true, state: {} } );
    } );

    /**
     * Opens the story or wiki entry referenced by a deep link, restoring the
     * matching view directly instead of the default menu. A wiki entry is
     * opened within its own category, so a later ESC lands on a populated list.
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
            terminal.openWiki();
            terminal.openRelatedEntry( target.id );
        }
    };

    /**
     * Leaves the boot screen: honours a deep link when the URL points to a
     * story or wiki entry, otherwise falls back to the main menu (with a
     * notice when the link points to something that no longer exists). The
     * URL is the only source for restoring a story after a refresh, read from
     * the live address bar since shallow routing never updates page.url.
     *
     * Leaving boot is a user gesture, so it also resumes an audio context
     * suspended by the autoplay policy (no-op when sound is off).
     *
     * @author Claude
     */
    const handleBoot = () =>
    {
        resumeAudio();

        const params = new URLSearchParams( window.location.search );
        const target = parseDeepLink( params );

        if ( target )
        {
            applyDeepLink( target );
            return;
        }

        terminal.startMenu();

        const linkError = deepLinkError( params );
        if ( linkError ) terminal.showMenuNotice( linkError );
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

        terminal.update( ( s ) =>
        {
            // From "no highlight" (-1, touch screens), step onto the first or last story.
            const hasNoHighlight = s.selectedStoryIndex < 0;
            const fromIndex = hasNoHighlight && delta === -1 ? 0 : s.selectedStoryIndex;
            const nextIndex = ( fromIndex + delta + count ) % count;

            return { ...s, selectedStoryIndex: nextIndex };
        } );
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
        const story = visibleStories[ $terminal.selectedStoryIndex ];
        if ( !story ) return;

        terminal.selectStory( story.id );
    };

    /**
     * Creates a blank custom story (seeded with localized starter content) and
     * opens it in the editor. Shared by the [N] key and the footer button.
     *
     * @author Claude
     */
    const handleCustomNew = () =>
    {
        try
        {
            const record = createBlankStory( {
                title: m.editor_new_story_title(),
                language: m.language_self_name(),
                universe: m.editor_new_universe(),
                sceneText: m.editor_new_scene_text()
            } );

            terminal.bumpCustomStories();
            terminal.openEditor( record.story.id, true );
        }
        catch ( error )
        {
            alert( customStoryErrorMessage( error ) );
        }
    };

    /**
     * Forks the currently previewed catalog story into a private custom copy
     * and opens it in the editor. Shared by the [F] key and the footer button.
     * Generated and custom stories cannot be forked.
     *
     * @author Claude
     */
    const handleFork = () =>
    {
        const story = $terminal.currentStory;

        const canFork = story !== null && !$terminal.currentStoryIsGenerated && !isCustomStoryId( story.id );
        if ( !canFork || !story ) return;

        try
        {
            const record = forkStory( story );

            terminal.bumpCustomStories();
            terminal.openEditor( record.story.id );
        }
        catch ( error )
        {
            alert( customStoryErrorMessage( error ) );
        }
    };

    /**
     * Plays a single interface sound matched to the key pressed: a selection
     * chime on ENTER, a back blip on ESC, a navigation blip on arrows, and a
     * subtle click for everything else. Held keys (auto-repeat) and bare
     * modifier presses are ignored so the feedback never machine-guns.
     *
     * When sound is on, the keydown also resumes an audio context suspended by
     * the autoplay policy (skipped while muted so no context is created).
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const playKeySound = ( e: KeyboardEvent ) =>
    {
        if ( e.repeat ) return;

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
     * view. Boot input is handled by the boot component itself, and an open
     * modal (share, confirmation, help) owns its input through the native
     * <dialog>.
     *
     * - [?] opens the help on every view, unless typing in a field.
     * - The AI setup and editor screens are forms, so typing flows to the
     *   focused field. ESC leaves the AI setup. In the editor, ESC inside a
     *   field only parks focus on the editor root (a reflexive press never
     *   quits), and a second ESC asks to leave.
     * - In the search input, ESC closes the search, arrows and ENTER fall
     *   through, and every other key stays in the field.
     * - [M] toggles the sound on any view and [/] opens the search on the
     *   lists (menu, wiki) only, both unless an input is focused.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleKeydown = ( e: KeyboardEvent ) =>
    {
        if ( view === "boot" ) return;

        const isModalOpen = $terminal.shareOpen || document.querySelector( "dialog[open]" ) !== null;
        if ( isModalOpen ) return;

        playKeySound( e );

        const focusedElement = document.activeElement;
        const isTypingInField = focusedElement instanceof HTMLInputElement || focusedElement instanceof HTMLTextAreaElement || focusedElement instanceof HTMLSelectElement;

        if ( e.key === "?" && !isTypingInField )
        {
            e.preventDefault();
            helpOpen = true;
            return;
        }

        if ( view === "ai-setup" )
        {
            if ( e.key === "Escape" )
            {
                e.preventDefault();
                terminal.startMenu();
            }

            return;
        }

        if ( view === "editor" )
        {
            if ( e.key !== "Escape" ) return;

            e.preventDefault();

            const focused = document.activeElement;
            const isTextField = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
            const isEditingField = isTextField || focused instanceof HTMLSelectElement;

            if ( isEditingField )
            {
                const editorRoot = focused.closest<HTMLElement>( "[data-editor-root]" );

                if ( editorRoot ) editorRoot.focus();
                else focused.blur();

                return;
            }

            terminal.requestCloseEditor();
            return;
        }

        const isInputFocused = document.activeElement instanceof HTMLInputElement;

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

        if ( ( e.key === "m" || e.key === "M" ) && !isInputFocused )
        {
            e.preventDefault();
            sound.toggle();
            return;
        }

        const isSearchableView = view === "menu" || view === "wiki";

        if ( e.key === "/" && !isInputFocused && isSearchableView )
        {
            e.preventDefault();
            terminal.activateSearch();
            return;
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
        if ( view === "custom-stories" )
        {
            handleCustomStoriesKey( e );
            return;
        }
    };

    /**
     * Handles keys on the main menu: filter shortcuts (G/L/C/W), arrow
     * navigation, ENTER to open a story, and number keys for direct access.
     * Letter shortcuts are ignored while the search input is open, so typing a
     * query never triggers them.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleMenuKey = ( e: KeyboardEvent ) =>
    {
        const key = e.key.toLowerCase();

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

            if ( key === "e" )
            {
                e.preventDefault();
                terminal.openCustomStories();
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
            const focused = document.activeElement;
            const isControlFocused = focused instanceof HTMLButtonElement || focused instanceof HTMLAnchorElement;
            if ( isControlFocused ) return;

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

    /** True while the keyboard-shortcut help dialog is shown. */
    let helpOpen = $state( false );

    /** True while the "erase the save and start over?" confirmation is shown. */
    let newGameConfirmOpen = $state( false );

    /**
     * Starts the previewed story from scratch. When a save exists this would
     * erase it, so a confirmation is shown first. Shared by the [N] key, the
     * action bar and the footer.
     *
     * @author Claude
     */
    const handleNewGame = () =>
    {
        const storyId = $terminal.currentStory?.id;
        if ( !storyId ) return;

        if ( currentStoryHasSave )
        {
            newGameConfirmOpen = true;
            return;
        }

        terminal.startStory( storyId );
    };

    /**
     * Erases the save and starts the previewed story over, once confirmed.
     *
     * @author Claude
     */
    const confirmNewGame = () =>
    {
        newGameConfirmOpen = false;

        const storyId = $terminal.currentStory?.id;
        if ( storyId ) terminal.startStory( storyId );
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

        if ( e.key.toLowerCase() === "f" )
        {
            e.preventDefault();
            handleFork();
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
            handleNewGame();
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
     * Handles keys on the "my stories" screen: arrows navigate the list, ENTER
     * opens the highlighted story, N creates a new one, ESC returns to the
     * main menu.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleCustomStoriesKey = ( e: KeyboardEvent ) =>
    {
        if ( e.key === "Escape" )
        {
            e.preventDefault();
            terminal.startMenu();
        }
        else if ( e.key === "ArrowDown" )
        {
            e.preventDefault();
            terminal.moveCustomSelection( 1 );
        }
        else if ( e.key === "ArrowUp" )
        {
            e.preventDefault();
            terminal.moveCustomSelection( -1 );
        }
        else if ( e.key === "Enter" )
        {
            e.preventDefault();
            terminal.selectCustomStoryAt( $terminal.customSelectedIndex );
        }
        else if ( e.key.toLowerCase() === "n" )
        {
            e.preventDefault();
            handleCustomNew();
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
     * Handles keys during story playback: SPACE skips the typewriter, number
     * keys pick a choice, [S] opens sharing (ignored by the store for
     * generated stories), ESC returns to the menu, and ENTER on an ending
     * restarts the story once its dialogue has finished typing.
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

            if ( isAnimating ) return;

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
     * a mouse pointer: menu entries, filters, story choices, footer actions,
     * dialogs... Delegated on the window so every current and future button is
     * covered without wiring each handler by hand. Pointer events never fire
     * for keyboard activation, so this never doubles up with the per-key sound
     * in handleKeydown. Touch/pen activation is left silent, as it is the
     * dominant input on mobile where a beep on every tap feels noisy, and
     * range inputs (the volume slider) stay silent while dragged. The click
     * also resumes an audio context suspended by autoplay.
     *
     * @param e - The pointer event.
     * @author Claude
     */
    const handlePointerDown = ( e: PointerEvent ) =>
    {
        if ( !$sound.enabled ) return;
        if ( e.pointerType !== "mouse" ) return;

        const target = e.target as HTMLElement | null;

        const control = target?.closest( "button, a, [role=button]" );
        if ( !control ) return;

        resumeAudio();
        playSelect();
    };

    onMount( () =>
    {
        window.focus();

        // A shared link skips the system boot and goes straight to its target.
        const params = new URLSearchParams( window.location.search );
        const isSharedLink = parseDeepLink( params ) !== null || deepLinkError( params ) !== null;

        if ( isSharedLink ) handleBoot();

        // Remembered until the first gesture when autoplay is blocked.
        startMusic( "menu" );
    } );
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={handlePointerDown} />

<main class="bg-terminal-bg monitor relative w-full h-full max-w-4xl flex flex-col" data-phosphor={phosphor}>
    <a
        href="#terminal-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:px-3 focus:py-2 focus:rounded focus:border focus:border-terminal-green focus:bg-terminal-bg focus:text-terminal-white text-sm"
        onclick={handleSkipToContent}
    >
        {m.skip_to_content()}
    </a>

    {#if $display.scanlines}
        <div class="scanlines inset-0 absolute z-10 pointer-events-none"></div>
    {/if}

    <TerminalHeader {view} />

    <div id="terminal-content" class="flex-1 min-h-0 flex flex-col" tabindex="-1" bind:this={contentEl}>
        {#if view === "boot"}
            <BootSequence ondone={handleBoot} />
        {:else if view === "menu"}
            <StoryMenu {selectedIndex} onselect={handleMenuSelect} onnavigate={handleMenuNavigate} />
        {:else if view === "story-info" || view === "story"}
            {#key $terminal.storyKey}
                <TerminalOutput {lines} animated={view === "story"} skipSignal={effectiveSkipSignal} bind:isAnimating onchoice={terminal.makeChoice} locale={currentStoryLocale} />
            {/key}

            <StoryActionBar
                {view}
                hasSave={currentStoryHasSave}
                {isAnimating}
                {atGeneratedEnding}
                {atStandardEnding}
                onSkip={handleSkip}
                onFork={handleFork}
                onNewGame={handleNewGame}
                onHelp={() => { helpOpen = true; }}
            />

            <ConfirmDialog
                open={newGameConfirmOpen}
                id="new-game"
                title={m.confirm_new_game_title()}
                description={m.confirm_new_game_desc()}
                confirmLabel={m.confirm_new_game_confirm()}
                cancelLabel={m.confirm_new_game_cancel()}
                onconfirm={confirmNewGame}
                oncancel={() => { newGameConfirmOpen = false; }}
            />
        {:else if view === "wiki"}
            <WikiBrowser />
        {:else if view === "achievements"}
            <AchievementsBrowser />
        {:else if view === "ai-setup"}
            <AiStorySetup />
        {:else if view === "custom-stories"}
            <CustomStoriesMenu oncreate={handleCustomNew} />
        {:else if view === "editor"}
            {#key $terminal.editingStoryId}
                <StoryEditor />
            {/key}
        {/if}
    </div>

    <TerminalControls
        {view}
        {isAnimating}
        wikiEntryOpen={!!$terminal.wiki.selectedEntryId}
        searchActive={$terminal.searchActive}
        atEnding={atGeneratedEnding || atStandardEnding}
        onMenuNavigate={handleMenuStep}
        onMenuSelect={handleMenuSelectCurrent}
        onHelp={() => { helpOpen = true; }}
    />

    <HelpDialog open={helpOpen} {view} onclose={() => { helpOpen = false; }} />

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
        box-shadow: var( --shadow-monitor );
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

    @media (prefers-contrast: more) {
        .scanlines {
            display: none;
        }
    }
</style>
