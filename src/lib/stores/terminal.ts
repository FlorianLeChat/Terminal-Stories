import * as m from "$lib/locales/messages";
import { writable, get } from "svelte/store";
import type { AchievementContext,
    AchievementId,
    AiGenerationParams,
    AiStatus,
    Choice,
    GameState,
    KnowledgeCategory,
    SaveData,
    Scene,
    SceneTextEntry,
    Story,
    StoryFilters,
    StoryStats,
    WikiState } from "$lib";
import { aiErrorMessage,
    availableGenres,
    availableLanguages,
    availableWikiLanguages,
    categoryIds,
    computeStoryStats,
    countCompletedStories,
    countFullyCompletedStories,
    deleteSave,
    evaluateAchievements,
    filterEntries,
    generateStory,
    genreLabel,
    getEntry,
    getLanguageForUniverse,
    getStory,
    hasSave,
    loadAiSettings,
    loadDiscoveredEndings,
    loadSave,
    loadUnlockedAchievements,
    resetAchievements as resetAchievementsStorage,
    saveDiscoveredEnding,
    saveProgress,
    searchWikiEntries,
    totalStoriesCount } from "$lib";

export type TerminalView = "boot" | "menu" | "story-info" | "story" | "wiki" | "ai-setup" | "achievements";

interface TerminalStore {
    /** View currently rendered by the terminal. */
    view: TerminalView;
    /** Index of the story highlighted in the menu list. */
    selectedStoryIndex: number;
    /** Active genre/language filters applied to the menu's catalog. */
    filters: StoryFilters;
    /** Current playthrough state, or null when no story is loaded. */
    gameState: GameState | null;
    /** Story currently loaded for playback, or null when none is active. */
    currentStory: Story | null;
    /** Terminal lines rendered so far, in display order. */
    lines: TerminalLine[];
    /** Whether the terminal is waiting for the player's next input. */
    awaitingInput: boolean;
    /** Wiki browser's current category/filter/selection state. */
    wiki: WikiState;
    /** Current text typed into the active search box. */
    searchQuery: string;
    /** Whether search mode (menu or wiki) is currently active. */
    searchActive: boolean;
    /** Whether the current story is an ephemeral, AI-generated one. */
    currentStoryIsGenerated: boolean;
    /** Ending ids already discovered during this AI-generated playthrough (not persisted). */
    generatedEndings: string[];
    /** Number of distinct endings discovered so far in the current story. */
    endingsFound: number;
    /** Total number of endings the current story has. */
    endingsTotal: number;
    /** Counter bumped to force the story view to remount (e.g. on restart). */
    storyKey: number;
    /** Status of the current AI story generation request. */
    aiStatus: AiStatus;
    /** Translated error message from the last failed AI generation, or null. */
    aiError: string | null;
    /** Whether the share dialog is currently open. */
    shareOpen: boolean;
    /** Epoch ms when the current playthrough started, or null. */
    storyStartedAt: number | null;
    /** Ids of achievements unlocked so far, persisted across sessions. */
    unlockedAchievements: AchievementId[];
    /** Ids just unlocked, awaiting display in the unlock notification (toast). */
    achievementToast: AchievementId[];
    /** Newly discovered ending tally awaiting display in a toast, or null. */
    endingToast: EndingDiscoveryToast | null;
}

export interface EndingDiscoveryToast {
    /** Whether this was the last remaining ending for the story. */
    allDiscovered: boolean;
    /** Total endings discovered so far, including this one. */
    found: number;
    /** Total endings the story has. */
    total: number;
}

export interface TerminalLine {
    /** Stable, unique key assigned by {@link nextId}. */
    id: number;
    /** Rendered text content of the line. */
    text: string;
    /** Kind of line, driving how it is styled and rendered. */
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
    /** Name of the speaker, for lines of type "speaker". */
    speaker?: string;
    /** Index of the choice this line represents, for lines of type "choice". */
    choiceIndex?: number;
    /** Path of the image asset, for lines of type "image". */
    imageSrc?: string;
    /** Accessible alt text of the image, for lines of type "image". */
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

/** Sentinel speaker id meaning "narration", as opposed to a character speaking. */
const NARRATOR_SPEAKER = "narrator";

/**
 * Resolves the text and speaker of a single scene text entry, falling back to
 * the scene's own speaker (or the narrator sentinel) when unspecified.
 *
 * @param entry - The scene text entry (a plain string or a dialogue line).
 * @param scene - The scene the entry belongs to.
 * @returns The entry's text, resolved speaker, and whether the text is blank.
 * @author Claude
 */
const resolveSceneTextEntry = (
    entry: SceneTextEntry,
    scene: Scene
): { text: string; speaker: string; isBlank: boolean } =>
{
    const isDialogueLine = typeof entry !== "string";
    const text = isDialogueLine ? entry.text : entry;
    const speaker = ( isDialogueLine ? entry.speaker : undefined ) ?? scene.speaker ?? NARRATOR_SPEAKER;

    return { text, speaker, isBlank: text === "" };
};

/**
 * Builds the `[ Name ]` header line introducing a new speaker, resolving the
 * displayed name from the story's character list when possible.
 *
 * @param speaker - The speaker id starting to talk.
 * @param story - The story the speaker belongs to.
 * @returns The header terminal line.
 * @author Claude
 */
const buildSpeakerHeaderLine = ( speaker: string, story: Story ): Omit<TerminalLine, "id"> =>
{
    const char = story.characters.find( ( c ) => c.id === speaker );
    const name = char ? char.name : speaker;

    return { text: `[ ${ name } ]`, type: "speaker", speaker: name };
};

/**
 * Builds the opening lines for a scene: separator (unless first scene), optional image,
 * then the dialogue lines, each preceded by a `[ Name ]` header whenever the speaker changes
 * from the previous line, and each followed by an automatic blank line. Authors never need
 * to write a blank line into a scene's `text`; the choice prompt and other system messages
 * built downstream manage their own spacing separately and are unaffected by this.
 *
 * @param scene - The scene to render.
 * @param story - The story the scene belongs to (used to resolve speaker names).
 * @param isFirst - When true, omits the leading separator (nothing precedes the scene yet).
 * @returns The base terminal lines before choices or ending messages.
 * @author Claude
 */
const buildBaseSceneLines = ( scene: Scene, story: Story, isFirst = false ): Omit<TerminalLine, "id">[] =>
{
    const lines: Omit<TerminalLine, "id">[] = [];

    if ( !isFirst )
    {
        lines.push( { text: "─".repeat( 60 ), type: "separator" } );
    }

    if ( scene.image )
    {
        lines.push( { text: "", type: "image", imageSrc: scene.image } );
    }

    let lastSpeaker: string | null = null;

    scene.text.forEach( ( entry, index ) =>
    {
        const { text, speaker, isBlank } = resolveSceneTextEntry( entry, scene );
        const isNewSpeaker = !isBlank && speaker !== NARRATOR_SPEAKER && speaker !== lastSpeaker;

        if ( isNewSpeaker ) lines.push( buildSpeakerHeaderLine( speaker, story ) );
        if ( !isBlank ) lastSpeaker = speaker;

        lines.push( { text, type: scene.isEnding ? "ending" : "narrator" } );

        const isLastEntry = index === scene.text.length - 1;
        if ( !isLastEntry ) lines.push( { text: "", type: "narrator" } );
    } );

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
 * Builds the discovery toast payload shown for a newly reached ending.
 * Returns null when the ending was already known.
 *
 * @param isNewEnding - Whether this ending has not been seen before.
 * @param endingsFound - Total endings discovered including this one.
 * @param endingsTotal - Total endings in the story.
 * @returns The toast payload, or null when nothing new was discovered.
 * @author Claude
 */
const buildEndingDiscoveryToast = (
    isNewEnding: boolean,
    endingsFound: number,
    endingsTotal: number
): EndingDiscoveryToast | null =>
{
    if ( !isNewEnding ) return null;

    return {
        allDiscovered: endingsFound >= endingsTotal,
        found: endingsFound,
        total: endingsTotal
    };
};

/**
 * Evaluates and persists the achievements unlocked by reaching a catalog
 * ending. Builds the evaluation context from the just reached ending (folded
 * into the discovered sets and ending types so counts are current before the
 * ending is persisted later in {@link goBack}/{@link restartStory}).
 *
 * @param story - The catalog story being played.
 * @param sceneId - The id of the ending scene just reached.
 * @param storyId - The id of the story (from the game state).
 * @param endingData - The freshly computed ending tally for this story.
 * @param storyStartedAt - Epoch ms when this playthrough began, or null.
 * @returns The refreshed full list plus the just-unlocked ids when something
 *          new was unlocked, or `null` when nothing changed.
 * @author Claude
 */
const evaluateEndingAchievements = (
    story: Story,
    sceneId: string,
    storyId: string,
    endingData: { endingsFound: number; endingsTotal: number; isNewEnding: boolean },
    storyStartedAt: number | null
): { all: AchievementId[]; newly: AchievementId[] } | null =>
{
    // Fold the just reached ending into the persisted set so its type counts.
    const discoveredIds = loadDiscoveredEndings( storyId );
    discoveredIds.add( sceneId );

    const discoveredEndingTypes = new Set<"good" | "bad" | "neutral">();

    for ( const id of discoveredIds )
    {
        const endingType = story.scenes[ id ]?.endingType;
        if ( endingType ) discoveredEndingTypes.add( endingType );
    }

    const elapsedMs = storyStartedAt === null ? 0 : Date.now() - storyStartedAt;

    const context: AchievementContext = {
        storyId,
        isNewEnding: endingData.isNewEnding,
        endingsFound: endingData.endingsFound,
        endingsTotal: endingData.endingsTotal,
        elapsedMs,
        completedStoriesCount: countCompletedStories( storyId ),
        fullyCompletedStoriesCount: countFullyCompletedStories( storyId, sceneId ),
        totalStoriesCount,
        discoveredEndingTypes
    };

    const newlyUnlocked = evaluateAchievements( context );
    if ( newlyUnlocked.length === 0 ) return null;

    // Re-read the persisted list so the store holds the full, current set.
    return { all: loadUnlockedAchievements().map( ( a ) => a.id ), newly: newlyUnlocked };
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
        { text: `${ genreLabel( story.genre ) } — ${ story.universe }`, type: "system" },
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
 * Resolves the default language filter from the user's current locale. The
 * story/wiki data tags languages by their human-readable label ("English",
 * "Français"), so the locale is mapped to that label through the translatable
 * {@link m.language_self_name} message. Returns `null` when no shipped content
 * matches the locale's language, so an unsupported locale simply shows
 * everything rather than an empty list.
 *
 * @param available - The language labels present in the target dataset.
 * @returns The matching language label, or `null` when none is available.
 * @author Claude
 */
const defaultLanguageFilter = ( available: string[] ): string | null =>
{
    const localeLanguage = m.language_self_name();
    const isAvailable = available.includes( localeLanguage );

    return isAvailable ? localeLanguage : null;
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
        // Default to the reader's locale so the catalog and wiki open on the
        // language they can actually read; they stay free to switch or clear it.
        filters: { genre: null, language: defaultLanguageFilter( availableLanguages ) },
        gameState: null,
        currentStory: null,
        lines: [],
        awaitingInput: false,
        wiki: { category: "universe", language: defaultLanguageFilter( availableWikiLanguages ), universe: null, selectedIndex: 0, selectedEntryId: null },
        searchQuery: "",
        searchActive: false,
        currentStoryIsGenerated: false,
        generatedEndings: [],
        endingsFound: 0,
        endingsTotal: 0,
        storyKey: 0,
        aiStatus: "idle",
        aiError: null,
        shareOpen: false,
        storyStartedAt: null,
        unlockedAchievements: [],
        achievementToast: [],
        endingToast: null
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
        clearLines();
        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: 0, awaitingInput: true, searchQuery: "", searchActive: false, currentStoryIsGenerated: false, generatedEndings: [], aiStatus: "idle", aiError: null, shareOpen: false, achievementToast: [], endingToast: null } ) );
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
            searchActive: false,
            shareOpen: false
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
            awaitingInput: true,
            shareOpen: false,
            storyStartedAt: Date.now(),
            achievementToast: [],
            endingToast: null
        } ) );

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
            awaitingInput: true,
            shareOpen: false,
            storyStartedAt: Date.now(),
            achievementToast: [],
            endingToast: null
        } ) );

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

        const { currentStoryIsGenerated, generatedEndings, storyStartedAt } = get( { subscribe } );

        const lines: Omit<TerminalLine, "id">[] = buildBaseSceneLines( scene, story, isFirst );

        // Ending counts written here; kept as 0 for non-ending scenes so the
        // footer hides the counter when the player is mid-story.
        let nextEndings = generatedEndings;
        let endingsFound = 0;
        let endingsTotal = 0;

        // Stays null unless reaching a catalog ending unlocks new achievements,
        // in which case it carries the refreshed list to fold into the state.
        let nextUnlockedAchievements: AchievementId[] | null = null;
        // The just-unlocked ids to surface in the notification (toast), if any.
        let nextAchievementToast: AchievementId[] | null = null;
        // The ending discovery toast to surface, if this ending is new.
        let nextEndingToast: EndingDiscoveryToast | null = null;

        if ( scene.isEnding )
        {
            if ( currentStoryIsGenerated )
            {
                // The restart/menu key hints live in the footer (TerminalControls);
                // the discovery congratulation is surfaced as a toast instead.
                const data = resolveGeneratedEndingData( sceneId, story, generatedEndings );
                nextEndings = data.nextEndings;
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                nextEndingToast = buildEndingDiscoveryToast( data.isNewEnding, endingsFound, endingsTotal );
            }
            else
            {
                // The menu key hint lives in the footer (TerminalControls).
                const data = resolveCatalogEndingData( sceneId, story, state );
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                nextEndingToast = buildEndingDiscoveryToast( data.isNewEnding, endingsFound, endingsTotal );

                // Generated stories are ephemeral and never award achievements.
                const unlocked = evaluateEndingAchievements( story, sceneId, state.storyId, data, storyStartedAt );

                if ( unlocked )
                {
                    nextUnlockedAchievements = unlocked.all;
                    nextAchievementToast = unlocked.newly;
                }
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
            unlockedAchievements: nextUnlockedAchievements ?? s.unlockedAchievements,
            achievementToast: nextAchievementToast ?? s.achievementToast,
            endingToast: nextEndingToast ?? s.endingToast,
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
     * Opens the achievements screen, refreshing the unlocked list from storage
     * so it reflects anything earned earlier (including in another tab).
     *
     * @author Claude
     */
    const openAchievements = () =>
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "achievements",
            awaitingInput: true,
            searchQuery: "",
            searchActive: false,
            unlockedAchievements: loadUnlockedAchievements().map( ( a ) => a.id )
        } ) );
    };

    /**
     * Closes the achievements screen and returns to the main menu.
     *
     * @author Claude
     */
    const closeAchievements = () =>
    {
        update( ( s ) => ( { ...s, view: "menu" } ) );
        startMenu();
    };

    /**
     * Erases every unlocked achievement, letting the player start over from
     * zero. The achievements screen re-renders every card as locked.
     *
     * @author Claude
     */
    const resetAchievements = () =>
    {
        resetAchievementsStorage();
        update( ( s ) => ( { ...s, unlockedAchievements: [] } ) );
    };

    /**
     * Dismisses the achievement unlock notification (toast), clearing the queue
     * of just-unlocked ids so it disappears.
     *
     * @author Claude
     */
    const dismissAchievementToast = () =>
    {
        update( ( s ) => ( { ...s, achievementToast: [] } ) );
    };

    /**
     * Dismisses the ending discovery notification (toast), clearing it so it
     * disappears.
     *
     * @author Claude
     */
    const dismissEndingToast = () =>
    {
        update( ( s ) => ( { ...s, endingToast: null } ) );
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
                aiError: null,
                shareOpen: false
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

    /**
     * Opens the share overlay for the currently selected catalog story, whether
     * it is being previewed (story-info) or read (story). Generated stories are
     * ephemeral and have no shareable URL, so there is nothing to link to.
     *
     * @author Claude
     */
    const openShare = () =>
    {
        const state = get( { subscribe } );

        const isShareableView = state.view === "story" || state.view === "story-info";
        const canShare = isShareableView && state.currentStory !== null && !state.currentStoryIsGenerated;
        if ( !canShare ) return;

        update( ( s ) => ( { ...s, shareOpen: true } ) );
    };

    /**
     * Closes the share overlay.
     *
     * @author Claude
     */
    const closeShare = () =>
    {
        update( ( s ) => ( { ...s, shareOpen: false } ) );
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
        openShare,
        closeShare,
        openAchievements,
        closeAchievements,
        resetAchievements,
        dismissAchievementToast,
        dismissEndingToast,
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
