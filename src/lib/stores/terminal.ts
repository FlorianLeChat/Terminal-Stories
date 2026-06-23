import { writable, get } from "svelte/store";
import type { GameState, Story, Scene, Choice, StoryFilters } from "$lib/types/story";
import type { KnowledgeCategory, WikiState } from "$lib/types/knowledge";
import { getStory, availableGenres, availableLanguages } from "$lib/data";
import { categories, filterEntries, getEntry } from "$lib/data/knowledge";
import { computeStoryStats, formatReadingTime } from "$lib/utilities/readingTime";
import { saveProgress, loadSave, deleteSave, hasSave } from "$lib/utilities/saveService";

export type TerminalView = "boot" | "menu" | "story-info" | "story" | "wiki";

interface TerminalStore {
    view: TerminalView;
    selectedStoryIndex: number;
    filters: StoryFilters;
    gameState: GameState | null;
    currentStory: Story | null;
    lines: TerminalLine[];
    awaitingInput: boolean;
    wiki: WikiState;
}

export interface TerminalLine {
    id: number;
    text: string;
    type:
      | "system"
      | "narrator"
      | "speaker"
      | "choice"
      | "action"
      | "consequence"
      | "ending"
      | "error"
      | "title"
      | "separator"
      | "image"
      | "save";
    speaker?: string;
    choiceIndex?: number;
    imageSrc?: string;
    /** Completion percentage (0–100) carried by lines of type "save". */
    savePercent?: number;
}

// Monotonic counter giving every rendered terminal line a stable, unique key.
let lineId = 0;

/**
 * Returns the next unique line id.
 *
 * @returns A new, never-reused line identifier.
 * @author Claude
 */
const nextId = (): number =>
{
    return ++lineId;
};

/**
 * Keeps only the choices the player is allowed to take given their current
 * flags. A choice gated behind a flag stays hidden until that flag is set.
 *
 * @param scene - The scene whose choices are evaluated.
 * @param state - The current game state (holding the player's flags).
 * @returns The choices available from this scene.
 * @author Claude
 */
const getAvailableChoices = ( scene: Scene, state: GameState ): Choice[] =>
{
    return scene.choices.filter( ( c ) =>
    {
        return !( c.requiresFlag && !state.flags.has( c.requiresFlag ) );
    } );
};

/**
 * Creates the terminal store: a single Svelte store driving the whole UI
 * (boot, menu, story playback, and wiki) along with its action methods.
 *
 * @returns The store's `subscribe` plus its action API.
 * @author Claude
 */
const createTerminalStore = () =>
{
    const initial: TerminalStore = {
        view: "boot",
        selectedStoryIndex: 0,
        filters: { genre: null, language: null },
        gameState: null,
        currentStory: null,
        lines: [],
        awaitingInput: false,
        wiki: { category: "universe", language: null, universe: null, selectedIndex: 0, selectedEntryId: null }
    };

    const { subscribe, update } = writable<TerminalStore>( initial );

    /**
     * Appends rendered lines to the terminal, assigning each a unique id.
     *
     * @param newLines - The lines to append (without their id).
     * @author Claude
     */
    const addLines = ( newLines: Omit<TerminalLine, "id">[] ) =>
    {
        update( ( s ) => ( {
            ...s,
            lines: [ ...s.lines, ...newLines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
        } ) );
    };

    /**
     * Clears all rendered terminal lines.
     *
     * @author Claude
     */
    const clearLines = () =>
    {
        update( ( s ) => ( { ...s, lines: [] } ) );
    };

    /**
     * Switches to the main menu, resetting the selection and clearing output.
     *
     * @author Claude
     */
    const startMenu = () =>
    {
        clearLines();
        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: 0, awaitingInput: true } ) );
    };

    /**
     * Sets a story filter, toggling it off when the same value is selected
     * again, and resets the menu selection to the top.
     *
     * @param key - The filter to change (`genre` or `language`).
     * @param value - The value to apply, or `null` to clear.
     * @author Claude
     */
    const setFilter = ( key: keyof StoryFilters, value: string | null ) =>
    {
        update( ( s ) =>
        {
            const next = s.filters[ key ] === value ? null : value;

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: 0 };
        } );
    };

    /**
     * Advances a filter to the next value in `[none, ...values]`, wrapping
     * around. Lets a single key step through every option of a filter.
     *
     * @param key - The filter to cycle.
     * @param values - The ordered list of possible values.
     * @author Claude
     */
    const cycleFilter = ( key: keyof StoryFilters, values: string[] ) =>
    {
        update( ( s ) =>
        {
            const cycle = [ null, ...values ];
            const idx = cycle.indexOf( s.filters[ key ] );
            const next = cycle[ ( idx + 1 ) % cycle.length ];

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: 0 };
        } );
    };

    /**
     * Cycles the genre filter (bound to the [G] key).
     *
     * @author Claude
     */
    const cycleGenre = () =>
    {
        cycleFilter( "genre", availableGenres );
    };

    /**
     * Cycles the language filter (bound to the [L] key).
     *
     * @author Claude
     */
    const cycleLanguage = () =>
    {
        cycleFilter( "language", availableLanguages );
    };

    /**
     * Clears every active filter and resets the menu selection.
     *
     * @author Claude
     */
    const clearFilters = () =>
    {
        update( ( s ) => ( { ...s, filters: { genre: null, language: null }, selectedStoryIndex: 0 } ) );
    };

    /**
     * Opens the info screen for a story, rendering its summary, characters,
     * tags, and reading statistics before the player commits to playing it.
     * When a save exists for the story, shows resume and new-game options
     * instead of the default start prompt.
     *
     * @param id - The id of the story to present.
     * @author Claude
     */
    const selectStory = ( id: string ) =>
    {
        const story = getStory( id );
        if ( !story ) return;

        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "story-info",
            currentStory: story,
            awaitingInput: true
        } ) );

        const stats = computeStoryStats( story );
        const saveExists = hasSave( id );

        const actionPrompt = saveExists
            ? "[ENTRÉE] Reprendre   [N] Nouvelle partie   [ÉCHAP] Retour au menu"
            : "[ENTRÉE] Commencer l'histoire   [ÉCHAP] Retour au menu";

        const lines: Omit<TerminalLine, "id">[] = [
            { text: "═".repeat( 60 ), type: "separator" },
            { text: story.title, type: "title" },
            { text: `${ story.genre } — ${ story.universe }`, type: "system" },
            { text: "─".repeat( 60 ), type: "separator" },
            { text: story.description, type: "narrator" },
            { text: "", type: "narrator" },
            { text: `Personnages : ${ story.characters.map( ( c ) => c.name ).join( ", " ) }`, type: "system" },
            { text: `Tags : ${ story.tags.join( ", " ) }`, type: "system" },
            {
                text: `Lecture : ${ formatReadingTime( stats.minutes ) } / partie · ${ stats.scenes } entrées · ${ stats.endings } fin${ stats.endings > 1 ? "s" : "" } · ${ formatReadingTime( stats.fullMinutes ) } pour tout explorer`,
                type: "system"
            }
        ];

        if ( saveExists )
        {
            const save = loadSave( id );
            const savePercent = save
                ? Math.min( 100, Math.round( ( save.history.length + 1 ) / stats.scenes * 100 ) )
                : 0;

            lines.push( { text: "SAUVEGARDE TROUVÉE", type: "save", savePercent } );
        }

        lines.push(
            { text: "═".repeat( 60 ), type: "separator" },
            { text: actionPrompt, type: "system" }
        );

        addLines( lines );
    };

    /**
     * Starts a fresh playthrough of a story: clears any existing save, resets
     * the game state, and renders the opening scene.
     *
     * @param storyId - The id of the story to play.
     * @author Claude
     */
    const startStory = ( storyId: string ) =>
    {
        const story = getStory( storyId );
        if ( !story ) return;

        // Erase any prior save so a fresh run doesn't trigger the resume prompt.
        deleteSave( storyId );

        const gameState: GameState = {
            storyId,
            currentScene: story.startScene,
            flags: new Set(),
            history: []
        };

        clearLines();

        update( ( s ) => ( {
            ...s,
            view: "story",
            currentStory: story,
            gameState,
            awaitingInput: true
        } ) );

        renderScene( story, story.startScene, gameState );
    };

    /**
     * Resumes a story from the last saved checkpoint. Falls back to a fresh
     * start when no valid save is found.
     *
     * @param storyId - The id of the story to resume.
     * @author Claude
     */
    const resumeStory = ( storyId: string ) =>
    {
        const story = getStory( storyId );
        const save = loadSave( storyId );

        const canResume = story !== undefined && save !== null;

        if ( !canResume )
        {
            startStory( storyId );
            return;
        }

        const gameState: GameState = {
            storyId,
            currentScene: save.currentScene,
            flags: new Set( save.flags ),
            history: save.history
        };

        clearLines();

        update( ( s ) => ( {
            ...s,
            view: "story",
            currentStory: story,
            gameState,
            awaitingInput: true
        } ) );

        renderScene( story, save.currentScene, gameState );
    };

    /**
     * Renders a scene into terminal lines: optional image and speaker, the
     * narration, then either the ending prompt or the list of available
     * choices.
     *
     * @param story - The story being played.
     * @param sceneId - The id of the scene to render.
     * @param state - The current game state (used to gate choices).
     * @author Claude
     */
    const renderScene = ( story: Story, sceneId: string, state: GameState ) =>
    {
        const scene = story.scenes[ sceneId ];
        if ( !scene ) return;

        const texts = Array.isArray( scene.text ) ? scene.text : [ scene.text ];
        const lines: Omit<TerminalLine, "id">[] = [];

        lines.push( { text: "─".repeat( 60 ), type: "separator" } );

        if ( scene.image )
        {
            lines.push( { text: "", type: "image", imageSrc: scene.image } );
        }

        if ( scene.speaker )
        {
            const char = story.characters.find( ( c ) => c.id === scene.speaker );
            const name = char ? char.name : scene.speaker;

            lines.push( { text: `[ ${ name } ]`, type: "speaker", speaker: name } );
        }

        for ( const t of texts )
        {
            if ( t === "" )
            {
                lines.push( { text: "", type: "narrator" } );
            }
            else
            {
                lines.push( { text: t, type: scene.isEnding ? "ending" : "narrator" } );
            }
        }

        if ( scene.isEnding )
        {
            lines.push( { text: "", type: "narrator" }, { text: "[ENTRÉE] Revenir au menu", type: "system" } );
        }
        else if ( scene.choices.length > 0 )
        {
            lines.push(
                { text: "", type: "narrator" },
                { text: "> Que faites-vous ?", type: "system" },
                { text: "", type: "narrator" }
            );

            const available = getAvailableChoices( scene, state );

            available.forEach( ( choice, i ) =>
            {
                lines.push( {
                    text: `  [${ i + 1 }] ${ choice.text }`,
                    type: "choice",
                    choiceIndex: i + 1
                } );
            } );

            lines.push( { text: "", type: "narrator" }, { text: "[ÉCHAP] Menu principal", type: "system" } );
        }

        update( ( s ) => ( { ...s, lines: [ ...s.lines, ...lines.map( ( l ) => ( { ...l, id: nextId() } ) ) ] } ) );
    };

    /**
     * Applies the player's choice: echoes the action and consequence, sets any
     * resulting flag, advances the game state, and renders the next scene.
     *
     * @param choiceIndex - The 1-based index of the chosen option as displayed.
     * @author Claude
     */
    const makeChoice = ( choiceIndex: number ) =>
    {
        const state = get( { subscribe } );
        if ( !state.gameState || !state.currentStory ) return;

        const scene = state.currentStory.scenes[ state.gameState.currentScene ];
        if ( !scene ) return;

        const available = getAvailableChoices( scene, state.gameState );
        const choice = available[ choiceIndex - 1 ];
        if ( !choice ) return;

        const actionLines: Omit<TerminalLine, "id">[] = [
            { text: "", type: "narrator" },
            { text: `> ${ choice.text }`, type: "action" },
            { text: choice.action, type: "action" },
            { text: choice.consequence, type: "consequence" }
        ];

        update( ( s ) =>
        {
            if ( !s.gameState || !s.currentStory ) return s;

            const newFlags = new Set( s.gameState.flags );

            if ( choice.setsFlag ) newFlags.add( choice.setsFlag );

            const newState: GameState = {
                ...s.gameState,
                currentScene: choice.nextScene,
                flags: newFlags,
                history: [ ...s.gameState.history, s.gameState.currentScene ]
            };

            return {
                ...s,
                gameState: newState,
                lines: [ ...s.lines, ...actionLines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
            };
        } );

        const freshState = get( { subscribe } );

        if ( freshState.currentStory && freshState.gameState )
        {
            // Auto-save after every transition so progress survives a page close.
            saveProgress( freshState.gameState );
            renderScene( freshState.currentStory, choice.nextScene, freshState.gameState );
        }
    };

    /**
     * Abandons the current story and returns to the main menu. When leaving
     * from an ending scene the save is erased — the story is complete and the
     * next visit should offer a fresh start.
     *
     * @author Claude
     */
    const goBack = () =>
    {
        const state = get( { subscribe } );
        const currentSceneId = state.gameState?.currentScene ?? "";
        const currentScene = state.currentStory?.scenes[ currentSceneId ];
        const isLeavingFromEnding = currentScene?.isEnding === true;

        if ( isLeavingFromEnding && state.gameState )
        {
            deleteSave( state.gameState.storyId );
        }

        update( ( s ) => ( { ...s, view: "menu", currentStory: null, gameState: null } ) );
        startMenu();
    };

    /**
     * Returns the wiki entries currently visible under the active category and
     * language/universe filters.
     *
     * @returns The filtered list of knowledge entries.
     * @author Claude
     */
    const wikiVisibleEntries = () =>
    {
        const { wiki } = get( { subscribe } );

        return filterEntries( wiki.category, wiki.language, wiki.universe );
    };

    /**
     * Opens the knowledge base (wiki), resetting its selection.
     *
     * @author Claude
     */
    const openWiki = () =>
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "wiki",
            awaitingInput: true,
            wiki: { ...s.wiki, selectedIndex: 0, selectedEntryId: null }
        } ) );
    };

    /**
     * Closes the wiki and returns to the main menu.
     *
     * @author Claude
     */
    const closeWiki = () =>
    {
        update( ( s ) => ( { ...s, view: "menu" } ) );
        startMenu();
    };

    /**
     * Selects a wiki category, resetting the selection within it.
     *
     * @param category - The category to display.
     * @author Claude
     */
    const setWikiCategory = ( category: KnowledgeCategory ) =>
    {
        update( ( s ) => ( {
            ...s,
            wiki: { ...s.wiki, category, selectedIndex: 0, selectedEntryId: null }
        } ) );
    };

    /**
     * Steps to the next/previous wiki category, wrapping around (bound to the
     * ←/→ keys).
     *
     * @param direction - `1` for the next category, `-1` for the previous one.
     * @author Claude
     */
    const cycleWikiCategory = ( direction: 1 | -1 ) =>
    {
        update( ( s ) =>
        {
            const ids = categories.map( ( c ) => c.id );
            const idx = ids.indexOf( s.wiki.category );
            const next = ids[ ( idx + direction + ids.length ) % ids.length ];

            return { ...s, wiki: { ...s.wiki, category: next, selectedIndex: 0, selectedEntryId: null } };
        } );
    };

    /**
     * Toggles the wiki language filter. Changing language also clears the
     * universe filter, since universes are language-specific.
     *
     * @param language - The language to toggle.
     * @author Claude
     */
    const setWikiLanguage = ( language: string ) =>
    {
        update( ( s ) =>
        {
            const next = s.wiki.language === language ? null : language;

            return { ...s, wiki: { ...s.wiki, language: next, universe: null, selectedIndex: 0, selectedEntryId: null } };
        } );
    };

    /**
     * Toggles the wiki universe filter.
     *
     * @param universe - The universe to toggle, or `null` to clear.
     * @author Claude
     */
    const setWikiUniverse = ( universe: string | null ) =>
    {
        update( ( s ) =>
        {
            const next = s.wiki.universe === universe ? null : universe;

            return { ...s, wiki: { ...s.wiki, universe: next, selectedIndex: 0, selectedEntryId: null } };
        } );
    };

    /**
     * Sets the highlighted wiki entry by index (e.g. on hover).
     *
     * @param index - The index of the entry to highlight.
     * @author Claude
     */
    const navigateWiki = ( index: number ) =>
    {
        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedIndex: index } } ) );
    };

    /**
     * Moves the wiki highlight up or down, wrapping around the visible list
     * (bound to the ↑/↓ keys).
     *
     * @param direction - `1` to move down, `-1` to move up.
     * @author Claude
     */
    const moveWikiSelection = ( direction: 1 | -1 ) =>
    {
        const count = wikiVisibleEntries().length;
        if ( count === 0 ) return;

        update( ( s ) => ( {
            ...s,
            wiki: { ...s.wiki, selectedIndex: ( s.wiki.selectedIndex + direction + count ) % count }
        } ) );
    };

    /**
     * Opens the detailed view of a wiki entry by id.
     *
     * @param id - The id of the entry to open.
     * @author Claude
     */
    const openWikiEntry = ( id: string ) =>
    {
        if ( !getEntry( id ) ) return;

        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedEntryId: id } } ) );
    };

    /**
     * Opens the wiki entry at the given position in the visible list (used when
     * confirming the highlighted entry with ENTER).
     *
     * @param index - The index of the entry within the visible list.
     * @author Claude
     */
    const selectWikiEntryAt = ( index: number ) =>
    {
        const entries = wikiVisibleEntries();
        const entry = entries[ index ];
        if ( entry ) openWikiEntry( entry.id );
    };

    /**
     * Returns from a wiki entry's detail view back to the entry list.
     *
     * @author Claude
     */
    const backToWikiList = () =>
    {
        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedEntryId: null } } ) );
    };

    /**
     * Jumps to a related wiki entry, switching to its category and selecting it
     * in the list so the back action returns to a coherent view.
     *
     * @param id - The id of the related entry to open.
     * @author Claude
     */
    const openRelatedEntry = ( id: string ) =>
    {
        const entry = getEntry( id );
        if ( !entry ) return;

        const { wiki } = get( { subscribe } );
        const entries = filterEntries( entry.category, wiki.language, wiki.universe );
        const idx = entries.findIndex( ( e ) => e.id === id );

        update( ( s ) => ( {
            ...s,
            wiki: {
                ...s.wiki,
                category: entry.category,
                selectedIndex: idx >= 0 ? idx : s.wiki.selectedIndex,
                selectedEntryId: id
            }
        } ) );
    };

    return {
        subscribe,
        update,
        startMenu,
        setFilter,
        cycleGenre,
        cycleLanguage,
        clearFilters,
        selectStory,
        startStory,
        resumeStory,
        makeChoice,
        goBack,
        openWiki,
        closeWiki,
        setWikiCategory,
        cycleWikiCategory,
        setWikiLanguage,
        setWikiUniverse,
        navigateWiki,
        moveWikiSelection,
        openWikiEntry,
        selectWikiEntryAt,
        backToWikiList,
        openRelatedEntry
    };
};

export const terminal = createTerminalStore();
