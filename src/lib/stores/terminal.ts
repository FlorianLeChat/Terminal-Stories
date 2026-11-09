import { writable, get } from "svelte/store";
import * as m from "#lib/locales/messages.js";
import type { AchievementContext,
    AchievementId,
    AiGenerationParams,
    AiStatus,
    DeepLinkErrorCode,
    Choice,
    EndingPathStep,
    GameState,
    KnowledgeCategory,
    SaveData,
    Scene,
    SceneTextEntry,
    Story,
    StoryFilters,
    StoryInfoDetails,
    StoryStats,
    WikiState } from "#lib";
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
    buildEndingPath,
    buildStoryInfoDetails,
    storyBootLog,
    storyLocale,
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
    saveCompletion,
    saveProgress,
    searchWikiEntries,
    storiesMeta,
    totalStoriesCount } from "#lib";

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
    /** True while the editor's draft differs from the stored story. */
    editorDirty: boolean;
    /** True while the "leave without saving?" confirmation is shown. */
    editorLeavePending: boolean;
    /** True when the story open in the editor was just created (focus its title). */
    editorIsNew: boolean;
    /**
     * Counter bumped whenever the custom-story storage changes (save, import,
     * delete), so views listing custom stories recompute their data.
     */
    customStoriesVersion: number;
    /**
     * Why the menu was shown instead of a deep-linked target (unknown story or
     * entry id), or null. Cleared whenever the menu is (re)opened.
     */
    menuNotice: DeepLinkErrorCode | null;
    /**
     * Epoch ms of the last automatic save of the current playthrough, or null
     * when nothing was saved yet. Drives the "saved" status in the header.
     */
    lastSavedAt: number | null;
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
    /** Tone of the ending just reached, so the message matches the story. */
    endingType: "good" | "bad" | "neutral";
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
      | "save"
      | "path"
      | "info";
    /** Name of the speaker, for lines of type "speaker". */
    speaker?: string;
    /**
     * Index of the choice this line represents, for lines of type "choice",
     * or of the choice picked, for the "action" line echoing that pick.
     */
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
    /** Branching points leading to the ending, for lines of type "path". */
    path?: EndingPathStep[];
    /**
     * True for the dimmed recap of the last scene played, printed instantly
     * (never typed) when a save is resumed.
     */
    isRecap?: boolean;
    /** Endings found, main characters and universe, for lines of type "info". */
    info?: StoryInfoDetails;
}

/** Delay (ms) between the ending toast and the achievement toast that follows it. */
const ACHIEVEMENT_TOAST_DELAY = 1500;

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
 * and anticipating the save done at the end of `renderScene`.
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
 * @param endingType - Tone of the ending scene (neutral when unset).
 * @returns The toast payload, or null when nothing new was discovered.
 * @author Claude
 */
const buildEndingDiscoveryToast = (
    isNewEnding: boolean,
    endingsFound: number,
    endingsTotal: number,
    endingType: Scene[ "endingType" ]
): EndingDiscoveryToast | null =>
{
    if ( !isNewEnding ) return null;

    return {
        allDiscovered: endingsFound >= endingsTotal,
        found: endingsFound,
        total: endingsTotal,
        endingType: endingType ?? "neutral"
    };
};

/**
 * Builds the short boot log printed at the top of a playthrough (the story's
 * archive being mounted), closed by a separator before the first scene.
 *
 * @param story - The story starting.
 * @returns The boot log lines.
 * @author Claude
 */
const buildStoryBootLines = ( story: Story ): Omit<TerminalLine, "id">[] =>
{
    const logLines = storyBootLog( story ).map( ( text ): Omit<TerminalLine, "id"> => ( { text, type: "system" } ) );

    return [ ...logLines, { text: "─".repeat( 60 ), type: "separator" } ];
};

/**
 * Builds the recap printed when a save is resumed: the last scene played
 * before leaving, and the choice that led to the current scene, so the reader
 * picks the thread back up. Empty when the save is still on the opening scene.
 *
 * @param story - The story being resumed.
 * @param save - The save being resumed.
 * @returns The recap lines, all flagged `isRecap`.
 * @author Claude
 */
const buildResumeRecapLines = ( story: Story, save: SaveData ): Omit<TerminalLine, "id">[] =>
{
    const previousSceneId = save.history[ save.history.length - 1 ];
    const previousScene = previousSceneId ? story.scenes[ previousSceneId ] : undefined;
    if ( !previousScene ) return [];

    const lines: Omit<TerminalLine, "id">[] = [
        { text: m.resume_recap_title( {}, { locale: storyLocale( story.language ) } ), type: "system" },
        { text: "", type: "narrator" },
        ...buildBaseSceneLines( previousScene, story, true )
    ];

    const choiceTaken = previousScene.choices.find( ( c ) => c.nextScene === save.currentScene );
    if ( choiceTaken ) lines.push( { text: "", type: "narrator" }, { text: `> ${ choiceTaken.text }`, type: "action" } );

    return lines.map( ( line ) => ( { ...line, isRecap: true } ) );
};

/**
 * Builds the "path taken" recap shown under an ending: every branching point
 * the reader went through, with the choices left behind. Returns null when
 * the ending was reached without a single choice. On a first ending every
 * other branch leads somewhere unfound, so the unfound-ending marker is
 * cleared to keep that recap plain.
 *
 * @param story - The story being played.
 * @param sceneId - The id of the ending scene just reached.
 * @param state - The current game state (its history lists the visited scenes).
 * @param generatedEndings - Endings found in this AI playthrough (including
 * this one), or null for a catalog or custom story, whose endings persist.
 * @returns The recap line, or null when there is no choice to recap.
 * @author Claude
 */
const buildEndingPathLine = (
    story: Story,
    sceneId: string,
    state: GameState,
    generatedEndings: string[] | null
): Omit<TerminalLine, "id"> | null =>
{
    const hasNoChoice = state.history.length === 0;
    if ( hasNoChoice ) return null;

    const discovered = generatedEndings ? new Set( generatedEndings ) : loadDiscoveredEndings( state.storyId );
    discovered.add( sceneId );

    const builtPath = buildEndingPath( story, state.history, sceneId, discovered );

    const hasFoundAnotherEnding = [ ...discovered ].some( ( id ) => id !== sceneId );
    const path = hasFoundAnotherEnding
        ? builtPath
        : builtPath.map( ( step ) => ( { ...step, choices: step.choices.map( ( choice ) => ( { ...choice, leadsToUnfoundEnding: false } ) ) } ) );

    return { text: m.ending_path_title( {}, { locale: storyLocale( story.language ) } ), type: "path", path };
};

/**
 * Evaluates and persists the achievements unlocked by reaching a catalog
 * ending. Builds the evaluation context from the just reached ending (folded
 * into the discovered sets and ending types so counts are current before the
 * ending is persisted at the end of `renderScene`).
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

    return { all: loadUnlockedAchievements().map( ( a ) => a.id ), newly: newlyUnlocked };
};

/**
 * Builds the choice prompt block: the "what will you do?" header, in the
 * story's own language, then the indexed available choices.
 *
 * @param scene - The scene whose choices are rendered.
 * @param state - The current game state (used to filter locked choices).
 * @param story - The story being played (its language sets the prompt's).
 * @returns Lines for the interactive choice prompt.
 * @author Claude
 */
const buildChoiceLines = ( scene: Scene, state: GameState, story: Story ): Omit<TerminalLine, "id">[] =>
{
    const available = getAvailableChoices( scene, state );
    const lines: Omit<TerminalLine, "id">[] = [
        { text: "", type: "narrator" },
        { text: m.controls_story_choice_prompt( {}, { locale: storyLocale( story.language ) } ), type: "system" },
        { text: "", type: "narrator" }
    ];

    available.forEach( ( choice, i ) =>
    {
        lines.push( {
            text: choice.text,
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
        { text: story.description, type: "narrator" },
        { text: "", type: "info", info: buildStoryInfoDetails( story, stats ) }
    ];

    if ( saveExists )
    {
        const savePercent = save ? saveCompletion( save, stats.scenes ) : 0;

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
 * Index the menu highlight starts from. Touch screens use a two-tap pattern
 * where the highlighted card is expanded, so nothing is highlighted until the
 * first tap; pointer devices start on the first story.
 *
 * @returns 0, or -1 (no highlight) on devices without hover.
 * @author Claude
 */
const menuStartIndex = (): number =>
{
    const hasNoHover = globalThis.window !== undefined && window.matchMedia( "(hover: none)" ).matches;

    return hasNoHover ? -1 : 0;
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
 * The catalog starts unfiltered, the wiki starts on the reader's locale.
 *
 * @returns The store's `subscribe` plus its action API.
 * @author Claude
 */
const createTerminalStore = () =>
{
    const initial: TerminalStore = {
        view: "boot",
        selectedStoryIndex: menuStartIndex(),
        filters: { genre: null, language: null },
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
        editorDirty: false,
        editorLeavePending: false,
        editorIsNew: false,
        customStoriesVersion: 0,
        menuNotice: null,
        lastSavedAt: null
    };

    const { subscribe, update } = writable<TerminalStore>( initial );

    let generationAbort: AbortController | null = null;

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
     * Also switches to the menu ambiance (seamless when coming from boot) and
     * aborts any AI generation still in flight.
     *
     * @author Claude
     */
    const startMenu = () =>
    {
        startMusic( "menu" );

        generationAbort?.abort();

        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: menuStartIndex(), awaitingInput: true, searchQuery: "", searchActive: false, currentStory: null, gameState: null, currentStoryIsGenerated: false, generatedEndings: [], aiStatus: "idle", aiError: null, shareOpen: false, achievementToast: [], endingToast: null, pendingEndingReveal: null, customSelectedIndex: 0, editingStoryId: null, menuNotice: null, lastSavedAt: null, lines: [], storyKey: s.storyKey + 1 } ) );
    };

    /**
     * Explains on the menu why a deep link fell back to it.
     *
     * @param code - The reason the link could not be opened.
     * @author Claude
     */
    const showMenuNotice = ( code: DeepLinkErrorCode ) =>
    {
        update( ( s ) => ( { ...s, menuNotice: code } ) );
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

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: menuStartIndex() };
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

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: menuStartIndex() };
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
        update( ( s ) => ( { ...s, filters: { genre: null, language: null }, selectedStoryIndex: menuStartIndex() } ) );
    };

    /**
     * Opens the info screen for a story, rendering its summary, characters,
     * and reading statistics before the player commits to playing it.
     * When a save exists for the story, shows resume and new-game options
     * instead of the default start prompt. Reuses the reading stats
     * precomputed in the catalog metadata, computing them live only for a
     * story missing from it.
     *
     * @param id - The id of the story to present.
     * @author Claude
     */
    const selectStory = ( id: string ) =>
    {
        const story = findStoryById( id );
        if ( !story ) return;

        const meta = storiesMeta.find( ( m ) => m.id === id );
        const stats = meta ? meta.stats : computeStoryStats( story );
        const saveExists = hasSave( id );
        const save = saveExists ? loadSave( id ) : null;
        const infoLines = buildStoryInfoLines( story, stats, saveExists, save );

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
            pendingEndingReveal: null,
            lastSavedAt: null
        } ) );

        printStoryBoot( story );
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

        const recapLines = buildResumeRecapLines( story, save );

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
            pendingEndingReveal: null,
            lastSavedAt: null,
            lines: [ ...buildStoryBootLines( story ), ...recapLines ].map( ( l ) => ( { ...l, id: nextId() } ) )
        } ) );

        const hasRecap = recapLines.length > 0;
        renderScene( story, save.currentScene, gameState, !hasRecap );
    };

    /**
     * Appends the story's boot log to the terminal, before its opening scene.
     *
     * @param story - The story starting.
     * @author Claude
     */
    const printStoryBoot = ( story: Story ) =>
    {
        const bootLines = buildStoryBootLines( story ).map( ( l ) => ( { ...l, id: nextId() } ) );

        update( ( s ) => ( { ...s, lines: [ ...s.lines, ...bootLines ] } ) );
    };

    /**
     * Renders a scene into terminal lines: optional image and speaker, the
     * narration, then either the ending prompt or the list of available
     * choices.
     *
     * The scene's own `music` overrides the story theme for that moment
     * (`startMusic` is a no-op when the theme is unchanged). Ending counts stay
     * at 0 mid-story so the footer hides the counter. On an ending, only
     * catalog stories award achievements (generated stories are ephemeral,
     * custom ones could be tailored to farm unlocks), the toasts are held back
     * until the typewriter has finished the dialogue (see
     * `revealEndingToasts`), and a catalog or custom ending is recorded at
     * once while its save is closed, so a reload never loses it nor resumes on
     * an ending.
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

        const sceneTheme = scene.music ?? story.music ?? "default";
        startMusic( sceneTheme );

        if ( scene.sound ) playSceneEffect( scene.sound );

        const { currentStoryIsGenerated, generatedEndings, storyStartedAt } = snapshot();

        const lines: Omit<TerminalLine, "id">[] = buildBaseSceneLines( scene, story, isFirst );

        let nextEndings = generatedEndings;
        let endingsFound = 0;
        let endingsTotal = 0;

        let nextUnlockedAchievements: AchievementId[] | null = null;
        let nextAchievementToast: AchievementId[] = [];
        let nextEndingToast: EndingDiscoveryToast | null;
        let nextPendingEndingReveal: PendingEndingReveal | null = null;

        if ( scene.isEnding )
        {
            playEnding( scene.endingType ?? "neutral" );

            if ( currentStoryIsGenerated )
            {
                const data = resolveGeneratedEndingData( sceneId, story, generatedEndings );
                nextEndings = data.nextEndings;
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                nextEndingToast = buildEndingDiscoveryToast( data.isNewEnding, endingsFound, endingsTotal, scene.endingType );
            }
            else
            {
                const data = resolveCatalogEndingData( sceneId, story, state );
                endingsFound = data.endingsFound;
                endingsTotal = data.endingsTotal;
                nextEndingToast = buildEndingDiscoveryToast( data.isNewEnding, endingsFound, endingsTotal, scene.endingType );

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

            nextPendingEndingReveal = { achievementToast: nextAchievementToast, endingToast: nextEndingToast };

            const pathLine = buildEndingPathLine( story, sceneId, state, currentStoryIsGenerated ? nextEndings : null );
            if ( pathLine ) lines.push( pathLine );

            // Must stay last: the tallies above read the endings found before this one.
            if ( !currentStoryIsGenerated )
            {
                saveDiscoveredEnding( state.storyId, sceneId );
                deleteSave( state.storyId );
            }
        }
        else if ( scene.choices.length > 0 )
        {
            lines.push( ...buildChoiceLines( scene, state, story ) );
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
     * Shows the achievement toast and plays its jingle, unless the player has
     * left the playthrough it belongs to in the meantime.
     *
     * @param achievementIds - The ids just unlocked.
     * @param storyKey - The story key at reveal time; a later key means the
     * view was reset (menu, restart) and the toast is dropped.
     * @author Claude
     */
    const showAchievementToast = ( achievementIds: AchievementId[], storyKey: number ) =>
    {
        const hasLeftPlaythrough = snapshot().storyKey !== storyKey;
        if ( hasLeftPlaythrough ) return;

        update( ( s ) => ( { ...s, achievementToast: achievementIds } ) );
        playAchievement();
    };

    /**
     * Reveals the ending/achievement toasts held back by {@link renderScene}
     * for the ending just reached, once the typewriter has finished displaying
     * its dialogue. The ending toast comes first; an achievement toast follows
     * after {@link ACHIEVEMENT_TOAST_DELAY} so the two read one after the
     * other instead of landing together. No-op when nothing is pending.
     *
     * @author Claude
     */
    const revealEndingToasts = () =>
    {
        const { pendingEndingReveal: pending, storyKey } = snapshot();
        if ( !pending ) return;

        update( ( s ) => ( {
            ...s,
            achievementToast: [],
            endingToast: pending.endingToast,
            pendingEndingReveal: null
        } ) );

        const hasNewAchievement = pending.achievementToast.length > 0;
        if ( !hasNewAchievement ) return;

        const hasEndingToast = pending.endingToast !== null;
        const delay = hasEndingToast ? ACHIEVEMENT_TOAST_DELAY : 0;

        setTimeout( () => showAchievementToast( pending.achievementToast, storyKey ), delay );
    };

    /**
     * Applies the player's choice: echoes the action and consequence, sets any
     * resulting flag, advances the game state, and renders the next scene.
     * Progress is auto-saved after every transition, except for AI-generated
     * stories, which stay ephemeral.
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
            { text: `> ${ choice.text }`, type: "action", choiceIndex },
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
            if ( !freshState.currentStoryIsGenerated )
            {
                saveProgress( freshState.gameState );
                update( ( s ) => ( { ...s, lastSavedAt: Date.now() } ) );
            }

            renderScene( freshState.currentStory, choice.nextScene, freshState.gameState );
        }
    };

    /**
     * Leaves the current story and returns to the main menu. Progress is saved
     * after every choice and an ending is recorded as soon as it is reached,
     * so nothing is lost.
     *
     * @author Claude
     */
    const goBack = () =>
    {
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
     * Restarts a catalog story from its opening scene. An ending reached just
     * before is already recorded (see `renderScene`).
     *
     * @author Claude
     */
    const restartStory = () =>
    {
        const state = snapshot();

        const canRestart = state.currentStory !== null && !state.currentStoryIsGenerated;
        if ( !canRestart || !state.currentStory ) return;

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
            selectedStoryIndex: menuStartIndex(),
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
            selectedStoryIndex: menuStartIndex(),
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
            selectedStoryIndex: menuStartIndex(),
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
            editingStoryId: null,
            editorDirty: false,
            editorLeavePending: false
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
     * @param isNew - True for a story just created, whose title gets the focus.
     * @author Claude
     */
    const openEditor = ( id: string, isNew = false ) =>
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "editor",
            editingStoryId: id,
            editorIsNew: isNew,
            editorDirty: false,
            editorLeavePending: false,
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
     * Leaves the editor, or asks for confirmation first when the draft holds
     * unsaved changes (shared by ESC and the footer's back buttons).
     *
     * @author Claude
     */
    const requestCloseEditor = () =>
    {
        const hasUnsavedChanges = snapshot().editorDirty;

        if ( hasUnsavedChanges )
        {
            update( ( s ) => ( { ...s, editorLeavePending: true } ) );
            return;
        }

        closeEditor();
    };

    /**
     * Dismisses the "leave without saving?" confirmation and stays in the editor.
     *
     * @author Claude
     */
    const cancelEditorLeave = () =>
    {
        update( ( s ) => ( { ...s, editorLeavePending: false } ) );
    };

    /**
     * Records whether the editor's draft differs from the stored story, so a
     * request to leave can warn before discarding the changes.
     *
     * @param dirty - True when the draft has unsaved changes.
     * @author Claude
     */
    const setEditorDirty = ( dirty: boolean ) =>
    {
        update( ( s ) => ( s.editorDirty === dirty ? s : { ...s, editorDirty: dirty } ) );
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
     * the save slots or the active-session record. A result or error arriving
     * after the player left the generation screen is dropped.
     *
     * @param params - The player's generation parameters.
     * @author Claude
     */
    const generateAndPlay = async ( params: AiGenerationParams ) =>
    {
        update( ( s ) => ( { ...s, aiStatus: "generating", aiError: null } ) );

        const abort = new AbortController();
        generationAbort = abort;

        try
        {
            const settings = loadAiSettings();
            const story = await generateStory( params, settings, abort.signal );

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

            printStoryBoot( story );
            renderScene( story, story.startScene, gameState, true );
        }
        catch ( error )
        {
            const stillGenerating = snapshot().aiStatus === "generating";
            if ( !stillGenerating ) return;

            playError();

            update( ( s ) => ( { ...s, aiStatus: "error", aiError: aiErrorMessage( error ) } ) );
        }
        finally
        {
            if ( generationAbort === abort ) generationAbort = null;
        }
    };

    /**
     * Cancels the AI generation in flight: the request is aborted and the
     * setup form comes back as it was, ready to try again.
     *
     * @author Claude
     */
    const cancelGeneration = () =>
    {
        generationAbort?.abort();
        update( ( s ) => ( { ...s, aiStatus: "idle", aiError: null } ) );
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

        printStoryBoot( story );
        renderScene( story, story.startScene, gameState, true );
    };

    /**
     * Opens the share overlay for the currently selected catalog story, whether
     * it is being previewed (story-info) or read (story). Generated stories are
     * ephemeral and custom stories private: neither has a shareable URL.
     *
     * @author Claude
     */
    const openShare = () =>
    {
        const state = snapshot();

        const isShareableView = state.view === "story" || state.view === "story-info";
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
        showMenuNotice,
        openAiSetup,
        openCustomStories,
        moveCustomSelection,
        navigateCustom,
        selectCustomStoryAt,
        openEditor,
        closeEditor,
        requestCloseEditor,
        cancelEditorLeave,
        setEditorDirty,
        bumpCustomStories,
        generateAndPlay,
        cancelGeneration,
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
