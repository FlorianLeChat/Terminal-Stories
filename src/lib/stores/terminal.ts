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
    playAchievement,
    playEnding,
    playError,
    playSceneEffect,
    startMusic,
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
    getCustomStoryAsStory,
    getEntry,
    getLanguageForUniverse,
    getStory,
    hasSave,
    isCustomStoryId,
    listCustomStories,
    loadAiSettings,
    loadDiscoveredEndings,
    loadSave,
    loadUnlockedAchievements,
    resetAchievements as resetAchievementsStorage,
    saveDiscoveredEnding,
    saveProgress,
    searchWikiEntries,
    storiesMeta,
    totalStoriesCount } from "$lib";

export type TerminalView
    = | "boot"
      | "menu"
      | "story-info"
      | "story"
      | "wiki"
      | "ai-setup"
      | "achievements"
      | "custom-stories"
      | "editor";

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
    /**
     * Achievement/ending toast data computed for the ending just reached, held
     * back until the typewriter finishes displaying its dialogue. Null once
     * revealed (or when the current scene isn't an ending).
     */
    pendingEndingReveal: PendingEndingReveal | null;
    /** Index of the custom story highlighted in the "my stories" list. */
    customSelectedIndex: number;
    /** Id of the custom story open in the editor, or null when none is. */
    editingStoryId: string | null;
    /**
     * Counter bumped whenever the custom-story storage changes (save, import,
     * delete), so views listing custom stories recompute their data.
     */
    customStoriesVersion: number;
}

export interface PendingEndingReveal {
    /** Ids just unlocked, to surface once revealed. */
    achievementToast: AchievementId[];
    /** Ending discovery tally to surface once revealed, or null. */
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
    /**
     * Id of the scene this choice line belongs to, for lines of type
     * "choice". Lets {@link makeChoice} ignore clicks on choices left over
     * from a scene the player has already moved past.
     */
    choiceSceneId?: string;
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
            choiceIndex: i + 1,
            choiceSceneId: scene.id
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
 * Resolves a playable story by id from every source: the bundled catalog
 * first, then the user's private custom stories.
 *
 * @param id - The story identifier.
 * @returns The matching story, or `undefined` if none exists.
 * @author Claude
 */
const findStoryById = ( id: string ): Story | undefined =>
{
    return getStory( id ) ?? getCustomStoryAsStory( id );
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
        endingToast: null,
        pendingEndingReveal: null,
        customSelectedIndex: 0,
        editingStoryId: null,
        customStoriesVersion: 0
    };

    const { subscribe, update } = writable<TerminalStore>( initial );

    /**
     * Reads the current store state synchronously. Wraps the `get`/`subscribe`
     * dance in one place so actions can grab a snapshot without re-allocating
     * the `{ subscribe }` wrapper at every call site.
     *
     * @returns The current terminal state.
     * @author Claude
     */
    const snapshot = (): TerminalStore =>
    {
        return get( { subscribe } );
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
        // Switch to the shell ambiance: leaving a story swaps its theme for the
        // menu loop; arriving from boot keeps the same theme playing seamlessly.
        startMusic( "menu" );

        // Single update: reset the whole menu state, drop any loaded story, and
        // clear the output (bumping storyKey to force the story view to remount).
        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: 0, awaitingInput: true, searchQuery: "", searchActive: false, currentStory: null, gameState: null, currentStoryIsGenerated: false, generatedEndings: [], aiStatus: "idle", aiError: null, shareOpen: false, achievementToast: [], endingToast: null, pendingEndingReveal: null, customSelectedIndex: 0, editingStoryId: null, lines: [], storyKey: s.storyKey + 1 } ) );
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
        const story = findStoryById( id );
        if ( !story ) return;

        // Reuse the reading stats precomputed at module load rather than walking
        // the whole scene graph again; fall back to a live compute only if the
        // story somehow isn't in the catalog metadata.
        const meta = storiesMeta.find( ( m ) => m.id === id );
        const stats = meta ? meta.stats : computeStoryStats( story );
        const saveExists = hasSave( id );
        const save = saveExists ? loadSave( id ) : null;
        const infoLines = buildStoryInfoLines( story, stats, saveExists, save );

        // Single update: switch view, load the story, reset search/share, clear
        // the output (bumping storyKey to remount), and render the info lines.
        update( ( s ) => ( {
            ...s,
            view: "story-info",
            currentStory: story,
            awaitingInput: true,
            searchQuery: "",
            searchActive: false,
            shareOpen: false,
            lines: infoLines.map( ( l ) => ( { ...l, id: nextId() } ) ),
            storyKey: s.storyKey + 1
        } ) );
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
        const story = findStoryById( storyId );
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
            endingToast: null,
            pendingEndingReveal: null
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
        const story = findStoryById( storyId );
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
            endingToast: null,
            pendingEndingReveal: null
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

        // Drive the background ambiance from the scene being entered: a scene's
        // own `music` is a localized "moment" override, otherwise the story's
        // default theme plays. startMusic is a no-op when the theme is unchanged,
        // so calling it on every scene is cheap and reverts cleanly after a moment.
        const sceneTheme = scene.music ?? story.music ?? "default";
        startMusic( sceneTheme );

        // Optional one-shot effect layered over the music to punctuate a moment.
        if ( scene.sound ) playSceneEffect( scene.sound );

        const { currentStoryIsGenerated, generatedEndings, storyStartedAt } = snapshot();

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
        let nextAchievementToast: AchievementId[] = [];
        // The ending discovery toast to surface, if this ending is new. Only
        // read inside the `scene.isEnding` branch below, which always assigns
        // it first.
        let nextEndingToast: EndingDiscoveryToast | null;
        // Holds the toast data above until the typewriter finishes displaying
        // this scene's dialogue; stays null for non-ending scenes.
        let nextPendingEndingReveal: PendingEndingReveal | null = null;

        if ( scene.isEnding )
        {
            // Ending sting, tuned to the outcome (good/bad/neutral).
            playEnding( scene.endingType ?? "neutral" );

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

                // Only catalog stories award achievements: generated stories are
                // ephemeral, and custom stories could be tailored to farm unlocks.
                const isCustomStory = isCustomStoryId( state.storyId );
                const unlocked = isCustomStory
                    ? null
                    : evaluateEndingAchievements( story, sceneId, state.storyId, data, storyStartedAt );

                if ( unlocked )
                {
                    nextUnlockedAchievements = unlocked.all;
                    nextAchievementToast = unlocked.newly;
                }
            }

            // The toast (and its jingle) are held back until the typewriter has
            // finished displaying the ending's dialogue; see revealEndingToasts.
            nextPendingEndingReveal = { achievementToast: nextAchievementToast, endingToast: nextEndingToast };
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
            pendingEndingReveal: nextPendingEndingReveal ?? s.pendingEndingReveal,
            lines: [ ...s.lines, ...lines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
        } ) );
    };

    /**
     * Reveals the achievement/ending toast held back by {@link renderScene} for
     * the ending just reached, once the typewriter has finished displaying its
     * dialogue. Plays the achievement jingle in sync with the toast. No-op when
     * nothing is pending (non-ending scenes, or an already-revealed ending).
     *
     * @author Claude
     */
    const revealEndingToasts = () =>
    {
        const pending = snapshot().pendingEndingReveal;
        if ( !pending ) return;

        update( ( s ) => ( {
            ...s,
            achievementToast: pending.achievementToast,
            endingToast: pending.endingToast,
            pendingEndingReveal: null
        } ) );

        // Celebrate a freshly unlocked achievement with its own jingle, timed to
        // the toast's appearance rather than to the ending being reached.
        const hasNewAchievement = pending.achievementToast.length > 0;
        if ( hasNewAchievement ) playAchievement();
    };

    /**
     * Applies the player's choice: echoes the action and consequence, sets any
     * resulting flag, advances the game state, and renders the next scene.
     *
     * @param choiceIndex - The 1-based index of the chosen option as displayed.
     * @param choiceSceneId - Id of the scene the clicked choice line belongs
     * to. When provided and it no longer matches the current scene, the
     * click is ignored — this happens when the player clicks a choice left
     * over from a scene they already moved past.
     * @author Claude
     */
    const makeChoice = ( choiceIndex: number, choiceSceneId?: string ) =>
    {
        const state = snapshot();
        if ( !state.gameState || !state.currentStory ) return;

        const isStaleChoice = choiceSceneId !== undefined && choiceSceneId !== state.gameState.currentScene;
        if ( isStaleChoice ) return;

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

        const freshState = snapshot();

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
        const state = snapshot();
        const currentSceneId = state.gameState?.currentScene ?? "";
        const currentScene = state.currentStory?.scenes[ currentSceneId ];
        const isLeavingFromEnding = currentScene?.isEnding === true;

        // Generated stories are ephemeral: skip ending tracking and save deletion.
        if ( isLeavingFromEnding && state.gameState && !state.currentStoryIsGenerated )
        {
            saveDiscoveredEnding( state.gameState.storyId, currentSceneId );
            deleteSave( state.gameState.storyId );
        }

        // startMenu already clears the loaded story and game state.
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
        const { wiki, searchActive, searchQuery } = snapshot();

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
        const state = snapshot();

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

        const { wiki } = snapshot();
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
     * Opens the "my stories" screen listing the user's private custom stories,
     * clearing any prior playthrough and resetting the selection.
     *
     * @author Claude
     */
    const openCustomStories = () =>
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "custom-stories",
            currentStory: null,
            gameState: null,
            currentStoryIsGenerated: false,
            awaitingInput: true,
            searchQuery: "",
            searchActive: false,
            customSelectedIndex: 0,
            editingStoryId: null
        } ) );
    };

    /**
     * Moves the custom-story highlight up or down, wrapping around the list
     * (bound to the ↑/↓ keys).
     *
     * @param direction - `1` to move down, `-1` to move up.
     * @author Claude
     */
    const moveCustomSelection = ( direction: 1 | -1 ) =>
    {
        const count = listCustomStories().length;
        if ( count === 0 ) return;

        update( ( s ) => ( {
            ...s,
            customSelectedIndex: ( s.customSelectedIndex + direction + count ) % count
        } ) );
    };

    /**
     * Sets the highlighted custom story by index (e.g. on hover).
     *
     * @param index - The index of the custom story to highlight.
     * @author Claude
     */
    const navigateCustom = ( index: number ) =>
    {
        update( ( s ) => ( { ...s, customSelectedIndex: index } ) );
    };

    /**
     * Opens the info screen of the custom story at the given position in the
     * list (used when confirming the highlighted story with ENTER).
     *
     * @param index - The index of the story within the list.
     * @author Claude
     */
    const selectCustomStoryAt = ( index: number ) =>
    {
        const records = listCustomStories();
        const record = records[ index ];

        if ( record ) selectStory( record.story.id );
    };

    /**
     * Opens the story editor on the given custom story.
     *
     * @param id - The id of the custom story to edit.
     * @author Claude
     */
    const openEditor = ( id: string ) =>
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "editor",
            editingStoryId: id,
            currentStory: null,
            gameState: null,
            currentStoryIsGenerated: false,
            awaitingInput: true,
            searchQuery: "",
            searchActive: false
        } ) );
    };

    /**
     * Closes the editor and returns to the "my stories" screen.
     *
     * @author Claude
     */
    const closeEditor = () =>
    {
        openCustomStories();
    };

    /**
     * Signals that the custom-story storage changed (save, import, delete) so
     * views listing custom stories recompute their data.
     *
     * @author Claude
     */
    const bumpCustomStories = () =>
    {
        update( ( s ) => ( { ...s, customStoriesVersion: s.customStoriesVersion + 1 } ) );
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
            const wasCancelled = snapshot().aiStatus !== "generating";
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
            const stillGenerating = snapshot().aiStatus === "generating";
            if ( !stillGenerating ) return;

            // Audible cue that the generation failed.
            playError();

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
        const state = snapshot();

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
        const state = snapshot();

        const isShareableView = state.view === "story" || state.view === "story-info";
        // Custom stories are private and have no shareable URL, just like
        // generated ones; only bundled catalog stories can be linked to.
        const isPrivateStory = state.currentStoryIsGenerated
          || ( state.currentStory !== null && isCustomStoryId( state.currentStory.id ) );
        const canShare = isShareableView && state.currentStory !== null && !isPrivateStory;
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
        openCustomStories,
        moveCustomSelection,
        navigateCustom,
        selectCustomStoryAt,
        openEditor,
        closeEditor,
        bumpCustomStories,
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
        revealEndingToasts,
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
