import * as m from "$lib/locales/messages";
import { writable, get } from "svelte/store";
import type { AiGenerationParams,
    AiStatus,
    Choice,
    GameState,
    KnowledgeCategory,
    SaveData,
    Scene,
    Story,
    StoryFilters,
    StoryStats,
    WikiState } from "$lib";
import { aiErrorMessage,
    availableGenres,
    availableLanguages,
    categoryIds,
    clearActiveSession,
    computeStoryStats,
    deleteSave,
    filterEntries,
    generateStory,
    getEntry,
    getLanguageForUniverse,
    getStory,
    hasSave,
    loadAiSettings,
    loadDiscoveredEndings,
    loadSave,
    saveActiveSession,
    saveDiscoveredEnding,
    saveProgress,
    searchWikiEntries } from "$lib";

export type TerminalView = "boot" | "menu" | "story-info" | "story" | "wiki" | "ai-setup";

interface TerminalStore {
    view: TerminalView;
    selectedStoryIndex: number;
    filters: StoryFilters;
    gameState: GameState | null;
    currentStory: Story | null;
    lines: TerminalLine[];
    awaitingInput: boolean;
    wiki: WikiState;
    searchQuery: string;
    searchActive: boolean;
    currentStoryIsGenerated: boolean;
    generatedEndings: string[];
    endingsFound: number;
    endingsTotal: number;
    storyKey: number;
    aiStatus: AiStatus;
    aiError: string | null;
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
    imageAlt?: string;
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
 * Builds the opening lines for a scene: separator (unless first scene), optional image and speaker,
 * then the narration text (one line per paragraph, or one blank for empty ones).
 *
 * @param scene - The scene to render.
 * @param story - The story the scene belongs to (used to resolve speaker names).
 * @param isFirst - When true, omits the leading separator (nothing precedes the scene yet).
 * @returns The base terminal lines before choices or ending messages.
 * @author Claude
 */
const buildBaseSceneLines = ( scene: Scene, story: Story, isFirst = false ): Omit<TerminalLine, "id">[] =>
{
    const texts = Array.isArray( scene.text ) ? scene.text : [ scene.text ];
    const lines: Omit<TerminalLine, "id">[] = [];

    if ( !isFirst )
    {
        lines.push( { text: "─".repeat( 60 ), type: "separator" } );
    }

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

    return lines;
};

/**
 * Computes ending counts and records a newly reached ending for an in-memory
 * generated story (deduped against already-discovered ids).
 *
 * @param sceneId - The id of the ending scene just reached.
 * @param story - The generated story.
 * @param generatedEndings - Previously discovered ending ids from the store.
 * @returns Updated ending tracking data.
 * @author Claude
 */
const resolveGeneratedEndingData = (
    sceneId: string,
    story: Story,
    generatedEndings: string[]
): { nextEndings: string[]; endingsFound: number; endingsTotal: number; isNewEnding: boolean } =>
{
    const isNewEnding = !generatedEndings.includes( sceneId );
    const nextEndings = isNewEnding ? [ ...generatedEndings, sceneId ] : generatedEndings;
    const endingsTotal = Object.values( story.scenes ).filter( ( s ) => s.isEnding === true ).length;
    const endingsFound = nextEndings.length;

    return { nextEndings, endingsFound, endingsTotal, isNewEnding };
};

/**
 * Computes ending counts for a catalog story, loading persisted discoveries
 * and anticipating the save that will happen in {@link goBack}.
 *
 * @param sceneId - The id of the ending scene just reached.
 * @param story - The catalog story.
 * @param state - The current game state (used to load persisted endings by story id).
 * @returns Ending tracking data for display.
 * @author Claude
 */
const resolveCatalogEndingData = (
    sceneId: string,
    story: Story,
    state: GameState
): { endingsFound: number; endingsTotal: number; isNewEnding: boolean } =>
{
    const existingEndings = loadDiscoveredEndings( state.storyId );
    const isNewEnding = !existingEndings.has( sceneId );
    const endingsTotal = Object.values( story.scenes ).filter( ( s ) => s.isEnding === true ).length;
    // +1 anticipates the save that will happen in goBack(); not yet persisted.
    const endingsFound = existingEndings.size + ( isNewEnding ? 1 : 0 );

    return { endingsFound, endingsTotal, isNewEnding };
};

/**
 * Builds the discovery congratulation lines shown below an ending's text.
 * Returns an empty array when the ending was already known.
 *
 * @param isNewEnding - Whether this ending has not been seen before.
 * @param endingsFound - Total endings discovered including this one.
 * @param endingsTotal - Total endings in the story.
 * @returns Lines to append after the ending narration, if any.
 * @author Claude
 */
const buildEndingDiscoveryLines = (
    isNewEnding: boolean,
    endingsFound: number,
    endingsTotal: number
): Omit<TerminalLine, "id">[] =>
{
    if ( !isNewEnding ) return [];

    const allDiscovered = endingsFound >= endingsTotal;
    const message = allDiscovered
        ? m.ending_all_discovered( { total: endingsTotal } )
        : m.ending_new_discovered( { found: endingsFound, total: endingsTotal } );

    return [
        { text: "", type: "narrator" },
        { text: message, type: "system" }
    ];
};

/**
 * Builds the choice prompt block: the "que faites-vous" header, the indexed
 * available choices, and the escape hint.
 *
 * @param scene - The scene whose choices are rendered.
 * @param state - The current game state (used to filter locked choices).
 * @returns Lines for the interactive choice prompt.
 * @author Claude
 */
const buildChoiceLines = ( scene: Scene, state: GameState ): Omit<TerminalLine, "id">[] =>
{
    const available = getAvailableChoices( scene, state );
    const lines: Omit<TerminalLine, "id">[] = [
        { text: "", type: "narrator" },
        { text: m.controls_story_choice_prompt(), type: "system" },
        { text: "", type: "narrator" }
    ];

    available.forEach( ( choice, i ) =>
    {
        lines.push( {
            text: `  [${ i + 1 }] ${ choice.text }`,
            type: "choice",
            choiceIndex: i + 1
        } );
    } );

    lines.push( { text: "", type: "narrator" } );

    return lines;
};

/**
 * Builds all lines for the story info screen: header, title, description, an
 * optional save indicator, and the action prompt.
 *
 * @param story - The story being previewed.
 * @param stats - Pre-computed story statistics.
 * @param saveExists - Whether a saved playthrough exists for this story.
 * @param save - The save data, used to compute the completion percentage bar.
 * @returns The complete set of story-info lines.
 * @author Claude
 */
const buildStoryInfoLines = (
    story: Story,
    stats: StoryStats,
    saveExists: boolean,
    save: SaveData | null
): Omit<TerminalLine, "id">[] =>
{
    const lines: Omit<TerminalLine, "id">[] = [
        { text: story.title, type: "title" },
        { text: `${ story.genre } — ${ story.universe }`, type: "system" },
        { text: "─".repeat( 60 ), type: "separator" },
        { text: story.description, type: "narrator" }
    ];

    if ( saveExists )
    {
        const savePercent = save
            ? Math.min( 100, Math.round( ( save.history.length + 1 ) / stats.scenes * 100 ) )
            : 0;

        lines.push( { text: m.terminal_save_label(), type: "save", savePercent } );
    }

    return lines;
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
        wiki: { category: "universe", language: null, universe: null, selectedIndex: 0, selectedEntryId: null },
        searchQuery: "",
        searchActive: false,
        currentStoryIsGenerated: false,
        generatedEndings: [],
        endingsFound: 0,
        endingsTotal: 0,
        storyKey: 0,
        aiStatus: "idle",
        aiError: null
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
        update( ( s ) => ( { ...s, lines: [], storyKey: s.storyKey + 1 } ) );
    };

    /**
     * Switches to the main menu, resetting the selection and clearing output.
     *
     * @author Claude
     */
    const startMenu = () =>
    {
        clearActiveSession();
        clearLines();
        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: 0, awaitingInput: true, searchQuery: "", searchActive: false, currentStoryIsGenerated: false, generatedEndings: [], aiStatus: "idle", aiError: null } ) );
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
            awaitingInput: true,
            searchQuery: "",
            searchActive: false
        } ) );

        const stats = computeStoryStats( story );
        const saveExists = hasSave( id );
        const save = saveExists ? loadSave( id ) : null;

        addLines( buildStoryInfoLines( story, stats, saveExists, save ) );
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
            currentStoryIsGenerated: false,
            awaitingInput: true
        } ) );

        saveActiveSession( storyId );
        renderScene( story, story.startScene, gameState, true );
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
            currentStoryIsGenerated: false,
            awaitingInput: true
        } ) );

        saveActiveSession( storyId );
        renderScene( story, save.currentScene, gameState, true );
    };

    /**
     * Renders a scene into terminal lines: optional image and speaker, the
     * narration, then either the ending prompt or the list of available
     * choices.
     *
     * @param story - The story being played.
     * @param sceneId - The id of the scene to render.
     * @param state - The current game state (used to gate choices).
     * @param isFirst - When true, suppresses the leading separator (opening scene only).
     * @author Claude
     */
    const renderScene = ( story: Story, sceneId: string, state: GameState, isFirst = false ) =>
    {
        const scene = story.scenes[ sceneId ];
        if ( !scene ) return;

        const { currentStoryIsGenerated, generatedEndings } = get( { subscribe } );

        const lines: Omit<TerminalLine, "id">[] = buildBaseSceneLines( scene, story, isFirst );

        // Ending counts written here; kept as 0 for non-ending scenes so the
        // footer hides the counter when the player is mid-story.
        let nextEndings = generatedEndings;
        let endingsFound = 0;
        let endingsTotal = 0;

        if ( scene.isEnding )
        {
            if ( currentStoryIsGenerated )
            {
                // The restart/menu key hints live in the footer (TerminalControls);
                // only the discovery congratulation is shown inline.
                const data = resolveGeneratedEndingData( sceneId, story, generatedEndings );
                nextEndings = data.nextEndings;
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                lines.push( ...buildEndingDiscoveryLines( data.isNewEnding, endingsFound, endingsTotal ) );
            }
            else
            {
                // The menu key hint lives in the footer (TerminalControls).
                const data = resolveCatalogEndingData( sceneId, story, state );
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                lines.push( ...buildEndingDiscoveryLines( data.isNewEnding, endingsFound, endingsTotal ) );
            }
        }
        else if ( scene.choices.length > 0 )
        {
            lines.push( ...buildChoiceLines( scene, state ) );
        }

        update( ( s ) => ( {
            ...s,
            generatedEndings: nextEndings,
            endingsFound,
            endingsTotal,
            lines: [ ...s.lines, ...lines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
        } ) );
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
            // Auto-save after every transition so progress survives a page close —
            // but never for AI-generated stories, which are intentionally ephemeral.
            if ( !freshState.currentStoryIsGenerated )
            {
                saveProgress( freshState.gameState );
            }

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

        // Generated stories are ephemeral: skip ending tracking and save deletion.
        if ( isLeavingFromEnding && state.gameState && !state.currentStoryIsGenerated )
        {
            saveDiscoveredEnding( state.gameState.storyId, currentSceneId );
            deleteSave( state.gameState.storyId );
        }

        clearActiveSession();
        update( ( s ) => ( { ...s, view: "menu", currentStory: null, gameState: null } ) );
        startMenu();
    };

    /**
     * Returns wiki entries visible under the current filters, respecting the
     * active search query. When a query is set, searches across all categories
     * (ignoring the category tab) and keeps language/universe filters only.
     *
     * @returns The filtered and/or ranked list of knowledge entries.
     * @author Claude
     */
    const wikiVisibleEntries = () =>
    {
        const { wiki, searchActive, searchQuery } = get( { subscribe } );

        const hasQuery = searchActive && searchQuery !== "";

        if ( hasQuery )
        {
            return searchWikiEntries( searchQuery ).filter( ( e ) =>
            {
                if ( wiki.language && getLanguageForUniverse( e.universe ) !== wiki.language ) return false;
                if ( wiki.universe && e.universe !== wiki.universe ) return false;

                return true;
            } );
        }

        return filterEntries( wiki.category, wiki.language, wiki.universe );
    };

    /**
     * Restarts a catalog story from its opening scene. When called from an
     * ending scene the ending is persisted first so the discovery tally is
     * updated before the fresh playthrough begins.
     *
     * @author Claude
     */
    const restartStory = () =>
    {
        const state = get( { subscribe } );

        const canRestart = state.currentStory !== null && state.gameState !== null && !state.currentStoryIsGenerated;
        if ( !canRestart || !state.currentStory || !state.gameState ) return;

        const currentSceneId = state.gameState.currentScene;
        const currentScene = state.currentStory.scenes[ currentSceneId ];
        const isAtEnding = currentScene?.isEnding === true;

        // Persist the ending now so renderScene reads the updated tally on restart.
        // startStory will erase the mid-playthrough save; the endings record is separate.
        if ( isAtEnding )
        {
            saveDiscoveredEnding( state.gameState.storyId, currentSceneId );
        }

        startStory( state.currentStory.id );
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
            searchQuery: "",
            searchActive: false,
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
            const idx = categoryIds.indexOf( s.wiki.category );
            const next = categoryIds[ ( idx + direction + categoryIds.length ) % categoryIds.length ];

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

    /**
     * Activates the search mode: shows the search input and resets the
     * selection to the top. Any open wiki entry is closed so the list is
     * visible.
     *
     * @author Claude
     */
    const activateSearch = () =>
    {
        update( ( s ) => ( {
            ...s,
            searchActive: true,
            searchQuery: "",
            selectedStoryIndex: 0,
            wiki: { ...s.wiki, selectedIndex: 0, selectedEntryId: null }
        } ) );
    };

    /**
     * Updates the live search query and resets the item selection so the
     * highlight always starts at the top of the new results list.
     *
     * @param query - The current value of the search input.
     * @author Claude
     */
    const setSearchQuery = ( query: string ) =>
    {
        update( ( s ) => ( {
            ...s,
            searchQuery: query,
            selectedStoryIndex: 0,
            wiki: { ...s.wiki, selectedIndex: 0 }
        } ) );
    };

    /**
     * Deactivates search mode and clears the query, restoring normal
     * filter-based navigation.
     *
     * @author Claude
     */
    const deactivateSearch = () =>
    {
        update( ( s ) => ( {
            ...s,
            searchActive: false,
            searchQuery: "",
            selectedStoryIndex: 0,
            wiki: { ...s.wiki, selectedIndex: 0 }
        } ) );
    };

    /**
     * Opens the AI story setup screen, clearing any prior playthrough and
     * resetting the generation state.
     *
     * @author Claude
     */
    const openAiSetup = () =>
    {
        clearActiveSession();
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "ai-setup",
            currentStory: null,
            gameState: null,
            currentStoryIsGenerated: false,
            awaitingInput: true,
            aiStatus: "idle",
            aiError: null,
            searchQuery: "",
            searchActive: false
        } ) );
    };

    /**
     * Generates an ephemeral story from the given parameters and plays it through
     * the standard engine. Nothing is persisted: generated stories never touch
     * the save slots or the active-session record.
     *
     * @param params - The player's generation parameters.
     * @author Claude
     */
    const generateAndPlay = async ( params: AiGenerationParams ) =>
    {
        update( ( s ) => ( { ...s, aiStatus: "generating", aiError: null } ) );

        try
        {
            const settings = loadAiSettings();
            const story = await generateStory( params, settings );

            // If the user navigated away (e.g. ESC) while generating, don't hijack
            // the current view with the now-stale result.
            const wasCancelled = get( { subscribe } ).aiStatus !== "generating";
            if ( wasCancelled ) return;

            const gameState: GameState = {
                storyId: story.id,
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
                currentStoryIsGenerated: true,
                generatedEndings: [],
                awaitingInput: true,
                aiStatus: "idle",
                aiError: null
            } ) );

            renderScene( story, story.startScene, gameState, true );
        }
        catch ( error )
        {
            // Only surface the error if the user is still waiting on this request.
            const stillGenerating = get( { subscribe } ).aiStatus === "generating";
            if ( !stillGenerating ) return;

            update( ( s ) => ( { ...s, aiStatus: "error", aiError: aiErrorMessage( error ) } ) );
        }
    };

    /**
     * Replays the current generated story from its opening scene. Discovered
     * endings are kept so the running tally grows across restarts; nothing is
     * persisted.
     *
     * @author Claude
     */
    const restartGeneratedStory = () =>
    {
        const state = get( { subscribe } );

        const canRestart = state.currentStory !== null && state.currentStoryIsGenerated;
        if ( !canRestart || !state.currentStory ) return;

        const story = state.currentStory;

        const gameState: GameState = {
            storyId: story.id,
            currentScene: story.startScene,
            flags: new Set(),
            history: []
        };

        clearLines();
        update( ( s ) => ( { ...s, gameState, awaitingInput: true } ) );

        renderScene( story, story.startScene, gameState, true );
    };

    return {
        subscribe,
        update,
        startMenu,
        openAiSetup,
        generateAndPlay,
        restartGeneratedStory,
        restartStory,
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
        openRelatedEntry,
        activateSearch,
        setSearchQuery,
        deactivateSearch
    };
};

export const terminal = createTerminalStore();
