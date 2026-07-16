import type { Character, CharacterRole, Choice, Scene, SceneTextEntry, Story, StoryFile } from "$lib/types/story";
import type { MusicTheme, SceneSoundEffect } from "$lib/types/audio";
import { MUSIC_THEMES, SCENE_SOUND_EFFECTS } from "$lib/types/audio";
import { AiError } from "$lib/utilities/aiError";
import { CustomStoryError } from "$lib/utilities/customStoryError";

// The payload is expected to carry scenes as an array (easier to produce
// reliably than a keyed map), which we normalize into the Record the engine
// expects. The same raw shapes cover AI-generated payloads and user-imported
// or user-edited stories, so every entry point shares one sanitization path.
interface RawChoice {
    id?: string;
    text?: string;
    action?: string;
    consequence?: string;
    nextScene?: string;
    requiresFlag?: string;
    setsFlag?: string;
}

interface RawDialogueLine {
    speaker?: string;
    text?: string;
}

interface RawScene {
    id?: string;
    speaker?: string;
    text?: ( string | RawDialogueLine )[];
    image?: string;
    choices?: RawChoice[];
    isEnding?: boolean;
    endingType?: "good" | "bad" | "neutral";
    music?: string;
    sound?: string;
}

interface RawStory {
    title?: string;
    genre?: string;
    language?: string;
    universe?: string;
    description?: string;
    author?: string;
    music?: string;
    characters?: Partial<Character>[];
    startScene?: string;
    scenes?: RawScene[] | Record<string, RawScene>;
}

/**
 * Graph-level failure codes shared by every story normalization entry point.
 * Wrappers translate them into their own error type ({@link AiError} for
 * generated stories, {@link CustomStoryError} for imported/edited ones).
 */
type StoryGraphErrorCode = "not_object" | "no_scenes" | "no_scene_ids" | "no_ending";

/**
 * Internal error thrown by {@link normalizeStoryPayload} when a payload cannot
 * be salvaged into a coherent story graph.
 *
 * @author Claude
 */
class StoryGraphError extends Error
{
    readonly code: StoryGraphErrorCode;

    constructor( code: StoryGraphErrorCode )
    {
        super( code );
        this.name = "StoryGraphError";
        this.code = code;
    }
}

// Hard caps applied to every normalized story. User-generated content is
// clamped (never rejected) so a slightly oversized story still imports, while
// a hostile payload cannot blow up localStorage or the rendering pipeline.
const MAX_SCENES = 300;
const MAX_CHOICES_PER_SCENE = 12;
const MAX_TEXT_ENTRIES_PER_SCENE = 80;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_ID_LENGTH = 64;
const MAX_CHARACTERS = 40;

// Own-property names that would collide with Object.prototype internals when
// used as scene-map keys; refused outright as scene ids.
const UNSAFE_KEYS = [ "__proto__", "constructor", "prototype" ];

/** Roles the engine recognizes; anything else is coerced to "npc". */
const KNOWN_ROLES: CharacterRole[] = [ "protagonist", "antagonist", "ally", "npc", "narrator" ];

// Scene images must point to an asset bundled with the app: a relative path
// under assets/, no scheme, no host, no traversal. External URLs (http, data,
// javascript...) are dropped so imported stories can never load remote or
// script-bearing content on the reader's device.
const LOCAL_ASSET_PATTERN = /^\/?assets\/[a-z0-9_/-]+\.(?:svg|png|jpe?g|webp|gif)$/i;

/**
 * Clamps an arbitrary value to a trimmed string of at most `max` characters.
 * Non-string values collapse to the empty string.
 *
 * @param value - The raw value to sanitize.
 * @param max - The maximum allowed length.
 * @returns The clamped string (possibly empty).
 * @author Claude
 */
const clampText = ( value: unknown, max: number ): string =>
{
    if ( typeof value !== "string" ) return "";

    return value.trim().slice( 0, max );
};

/**
 * Coerces a character's role to a value the engine understands.
 *
 * @param role - The raw role string from the payload.
 * @returns A valid {@link CharacterRole}.
 * @author Claude
 */
const coerceRole = ( role: unknown ): CharacterRole =>
{
    const isKnown = typeof role === "string" && ( KNOWN_ROLES as string[] ).includes( role );

    return isKnown ? ( role as CharacterRole ) : "npc";
};

/**
 * Validates a raw music value against the known theme list.
 *
 * @param value - The raw `music` value from the payload.
 * @returns The theme when valid, `undefined` otherwise.
 * @author Claude
 */
const coerceMusicTheme = ( value: unknown ): MusicTheme | undefined =>
{
    const isKnown = typeof value === "string" && ( MUSIC_THEMES as readonly string[] ).includes( value );

    return isKnown ? ( value as MusicTheme ) : undefined;
};

/**
 * Validates a raw sound value against the known scene-effect list.
 *
 * @param value - The raw `sound` value from the payload.
 * @returns The effect when valid, `undefined` otherwise.
 * @author Claude
 */
const coerceSoundEffect = ( value: unknown ): SceneSoundEffect | undefined =>
{
    const isKnown = typeof value === "string" && ( SCENE_SOUND_EFFECTS as readonly string[] ).includes( value );

    return isKnown ? ( value as SceneSoundEffect ) : undefined;
};

/**
 * Validates a raw scene image path: only relative paths to bundled assets are
 * kept, so a story can never reference remote content or non-image schemes.
 *
 * @param value - The raw `image` value from the payload.
 * @returns The path when it targets a local asset, `undefined` otherwise.
 * @author Claude
 */
const coerceImagePath = ( value: unknown ): string | undefined =>
{
    const isLocalAsset = typeof value === "string" && LOCAL_ASSET_PATTERN.test( value ) && !value.includes( ".." );

    return isLocalAsset ? value : undefined;
};

/**
 * Turns the payload's `scenes` (array or map) into an array of raw scenes, each
 * guaranteed to carry an `id` (falling back to its map key).
 *
 * @param scenes - The raw `scenes` value from the payload.
 * @returns A flat list of raw scenes.
 * @author Claude
 */
const collectRawScenes = ( scenes: RawStory[ "scenes" ] ): RawScene[] =>
{
    if ( Array.isArray( scenes ) ) return scenes;

    if ( scenes && typeof scenes === "object" )
    {
        return Object.entries( scenes ).map( ( [ key, scene ] ) => ( { ...scene, id: scene.id ?? key } ) );
    }

    return [];
};

/**
 * Normalizes a single raw choice into a fully-formed {@link Choice}, filling in
 * sensible fallbacks for optional narration fields and clamping every string.
 *
 * @param raw - The raw choice from the payload.
 * @param index - The choice position, used to synthesize a stable id.
 * @returns A normalized choice, or `null` when it lacks a target scene.
 * @author Claude
 */
const normalizeChoice = ( raw: RawChoice, index: number ): Choice | null =>
{
    const nextScene = clampText( raw.nextScene, MAX_ID_LENGTH );
    if ( nextScene === "" ) return null;

    const rawText = clampText( raw.text, MAX_SHORT_TEXT_LENGTH );
    const text = rawText !== "" ? rawText : `Option ${ index + 1 }`;

    const id = clampText( raw.id, MAX_ID_LENGTH );

    const choice: Choice = {
        id: id !== "" ? id : `choice-${ index }`,
        text,
        action: clampText( raw.action, MAX_SHORT_TEXT_LENGTH ),
        consequence: clampText( raw.consequence, MAX_SHORT_TEXT_LENGTH ),
        nextScene
    };

    const requiresFlag = clampText( raw.requiresFlag, MAX_ID_LENGTH );
    const setsFlag = clampText( raw.setsFlag, MAX_ID_LENGTH );

    if ( requiresFlag !== "" ) choice.requiresFlag = requiresFlag;
    if ( setsFlag !== "" ) choice.setsFlag = setsFlag;

    return choice;
};

/**
 * Normalizes a single raw text entry against the scene's default speaker.
 * Collapses to a plain string whenever the entry's speaker matches that
 * default, keeping the `{ speaker, text }` form only for actual overrides.
 *
 * @param raw - The raw text entry from the payload (a string or a dialogue line).
 * @param defaultSpeaker - The scene's own speaker, or the narrator sentinel.
 * @returns A normalized {@link SceneTextEntry}.
 * @author Claude
 */
const normalizeTextEntry = ( raw: unknown, defaultSpeaker: string ): SceneTextEntry =>
{
    if ( typeof raw === "string" ) return raw.slice( 0, MAX_TEXT_LENGTH );

    const isObject = raw !== null && typeof raw === "object";
    if ( !isObject ) return "";

    const rawLine = raw as RawDialogueLine;
    const text = typeof rawLine.text === "string" ? rawLine.text.slice( 0, MAX_TEXT_LENGTH ) : "";
    const rawSpeaker = clampText( rawLine.speaker, MAX_ID_LENGTH );
    const speaker = rawSpeaker !== "" ? rawSpeaker : defaultSpeaker;

    return speaker === defaultSpeaker ? text : { speaker, text };
};

/**
 * Normalizes one raw scene into a {@link Scene}. Choices are normalized but not
 * yet validated against the scene map (that happens in a later pass); music,
 * sound, and image are dropped unless they match a known safe value.
 *
 * @param raw - The raw scene from the payload.
 * @returns A normalized scene.
 * @author Claude
 */
const normalizeScene = ( raw: RawScene ): Scene =>
{
    const id = clampText( raw.id, MAX_ID_LENGTH );
    const rawSpeaker = clampText( raw.speaker, MAX_ID_LENGTH );
    const speaker = rawSpeaker !== "" ? rawSpeaker : undefined;
    const defaultSpeaker = speaker ?? "narrator";

    const rawEntries = Array.isArray( raw.text ) ? raw.text.slice( 0, MAX_TEXT_ENTRIES_PER_SCENE ) : [];
    const text = rawEntries.map( ( entry ) => normalizeTextEntry( entry, defaultSpeaker ) );

    const rawChoices = Array.isArray( raw.choices ) ? raw.choices.slice( 0, MAX_CHOICES_PER_SCENE ) : [];
    const choices = rawChoices
        .map( ( choice, index ) => normalizeChoice( choice, index ) )
        .filter( ( choice ): choice is Choice => choice !== null );

    const scene: Scene = { id, text, choices };

    if ( speaker !== undefined ) scene.speaker = speaker;
    if ( raw.isEnding === true ) scene.isEnding = true;
    if ( raw.endingType === "good" || raw.endingType === "bad" || raw.endingType === "neutral" )
    {
        scene.endingType = raw.endingType;
    }

    const music = coerceMusicTheme( raw.music );
    const sound = coerceSoundEffect( raw.sound );
    const image = coerceImagePath( raw.image );

    if ( music !== undefined ) scene.music = music;
    if ( sound !== undefined ) scene.sound = sound;
    if ( image !== undefined ) scene.image = image;

    return scene;
};

/**
 * Walks the scene graph from `startScene` and returns whether at least one
 * ending (a scene flagged as such or with no remaining choices) is reachable.
 *
 * @param scenes - The validated scene map.
 * @param startScene - The id of the opening scene.
 * @returns `true` when an ending can be reached, `false` otherwise.
 * @author Claude
 */
export const hasReachableEnding = ( scenes: Record<string, Scene>, startScene: string ): boolean =>
{
    const visited = new Set<string>();
    const queue: string[] = [ startScene ];

    while ( queue.length > 0 )
    {
        const sceneId = queue.shift() as string;
        if ( visited.has( sceneId ) ) continue;
        visited.add( sceneId );

        const scene = scenes[ sceneId ];
        if ( !scene ) continue;

        const isEnding = scene.isEnding === true || scene.choices.length === 0;
        if ( isEnding ) return true;

        for ( const choice of scene.choices )
        {
            queue.push( choice.nextScene );
        }
    }

    return false;
};

/**
 * Builds the scene map from the raw scenes, dropping any scene without a
 * usable id. The map is created without a prototype and unsafe key names are
 * refused, so a hostile id (`__proto__`...) can never tamper with the map.
 *
 * @param rawScenes - The flat list of raw scenes to normalize.
 * @returns The normalized scene map, keyed by scene id.
 * @author Claude
 */
const buildSceneMap = ( rawScenes: RawScene[] ): Record<string, Scene> =>
{
    // Null prototype: scene ids are attacker-controlled property names.
    const scenes: Record<string, Scene> = Object.create( null );

    for ( const rawScene of rawScenes.slice( 0, MAX_SCENES ) )
    {
        const scene = normalizeScene( rawScene );

        const isUsableId = scene.id !== "" && !UNSAFE_KEYS.includes( scene.id );
        if ( isUsableId ) scenes[ scene.id ] = scene;
    }

    return scenes;
};

/**
 * Resolves the entry point of the story, falling back to the first scene
 * when the declared start scene is missing or unknown.
 *
 * @param data - The raw story payload.
 * @param scenes - The normalized scene map.
 * @param sceneIds - The ids present in `scenes`.
 * @returns The id of the scene playback should start from.
 * @author Claude
 */
const resolveStartScene = ( data: RawStory, scenes: Record<string, Scene>, sceneIds: string[] ): string =>
{
    const declaredStart = typeof data.startScene === "string" ? data.startScene : "";

    return scenes[ declaredStart ] ? declaredStart : sceneIds[ 0 ];
};

/**
 * Prunes choices that point to non-existent scenes, then promotes any
 * non-ending scene that ends up choice-less into a neutral ending so
 * playback never stalls. Mutates the given scenes in place.
 *
 * @param scenes - The normalized scene map.
 * @param sceneIds - The ids present in `scenes`.
 * @author Claude
 */
const pruneDeadEnds = ( scenes: Record<string, Scene>, sceneIds: string[] ): void =>
{
    for ( const sceneId of sceneIds )
    {
        const scene = scenes[ sceneId ];
        scene.choices = scene.choices.filter( ( choice ) => scenes[ choice.nextScene ] !== undefined );

        const isDeadEnd = scene.choices.length === 0 && scene.isEnding !== true;
        if ( isDeadEnd )
        {
            scene.isEnding = true;
            scene.endingType = scene.endingType ?? "neutral";
        }
    }
};

/**
 * Normalizes the raw `characters` payload into a fully-formed character list,
 * filling in sensible fallbacks for missing ids, names, and roles.
 *
 * @param rawCharacters - The raw `characters` value from the payload.
 * @returns A normalized character list.
 * @author Claude
 */
const normalizeCharacters = ( rawCharacters: RawStory[ "characters" ] ): Character[] =>
{
    if ( !Array.isArray( rawCharacters ) ) return [];

    return rawCharacters.slice( 0, MAX_CHARACTERS ).map( ( character, index ) =>
    {
        const id = clampText( character.id, MAX_ID_LENGTH );
        const name = clampText( character.name, MAX_SHORT_TEXT_LENGTH );

        return {
            id: id !== "" ? id : `character-${ index }`,
            name: name !== "" ? name : `Personnage ${ index + 1 }`,
            role: coerceRole( character.role )
        };
    } );
};

/**
 * Normalizes the story-level metadata (title, genre, language, universe,
 * description), filling in sensible fallbacks for missing or blank fields.
 *
 * @param data - The raw story payload.
 * @returns The normalized metadata fields.
 * @author Claude
 */
const normalizeStoryMetadata = (
    data: RawStory
): Pick<Story, "title" | "genre" | "language" | "universe" | "description"> =>
{
    const title = clampText( data.title, MAX_SHORT_TEXT_LENGTH );
    const genre = clampText( data.genre, MAX_ID_LENGTH );
    const language = clampText( data.language, MAX_ID_LENGTH );
    const universe = clampText( data.universe, MAX_SHORT_TEXT_LENGTH );

    return {
        title: title !== "" ? title : "Histoire générée",
        genre: genre !== "" ? genre : "Indéterminé",
        language: language !== "" ? language : "Français",
        universe: universe !== "" ? universe : "Univers généré",
        description: clampText( data.description, MAX_TEXT_LENGTH )
    };
};

/**
 * Validates and normalizes a raw story payload (AI-generated, imported, or
 * edited) into a playable story without an id. Every string is clamped, ids
 * and asset references are sanitized, dangling choices are pruned, choice-less
 * non-ending scenes become endings, and the graph is guaranteed to reach at
 * least one ending — throwing a {@link StoryGraphError} otherwise.
 *
 * @param raw - The parsed JSON payload to normalize.
 * @returns A fully-formed story, minus its id (assigned by the caller).
 * @throws {StoryGraphError} With a graph error code when the payload is unusable.
 * @author Claude
 */
const normalizeStoryPayload = ( raw: unknown ): Omit<Story, "id"> =>
{
    const isObject = raw !== null && typeof raw === "object";
    if ( !isObject ) throw new StoryGraphError( "not_object" );

    const data = raw as RawStory;

    const rawScenes = collectRawScenes( data.scenes );
    if ( rawScenes.length === 0 ) throw new StoryGraphError( "no_scenes" );

    const scenes = buildSceneMap( rawScenes );
    const sceneIds = Object.keys( scenes );
    if ( sceneIds.length === 0 ) throw new StoryGraphError( "no_scene_ids" );

    const startScene = resolveStartScene( data, scenes, sceneIds );
    pruneDeadEnds( scenes, sceneIds );

    if ( !hasReachableEnding( scenes, startScene ) )
    {
        throw new StoryGraphError( "no_ending" );
    }

    const story: Omit<Story, "id"> = {
        ...normalizeStoryMetadata( data ),
        characters: normalizeCharacters( data.characters ),
        startScene,
        scenes
    };

    const author = clampText( data.author, MAX_SHORT_TEXT_LENGTH );
    const music = coerceMusicTheme( data.music );

    if ( author !== "" ) story.author = author;
    if ( music !== undefined ) story.music = music;

    return story;
};

/**
 * Validates and normalizes a raw, model-generated payload into a playable
 * {@link Story}, throwing an {@link AiError} when the payload cannot be
 * salvaged.
 *
 * @param raw - The parsed JSON returned by the model.
 * @returns A fully-formed, ephemeral story (id prefixed with `ai-`).
 * @throws {AiError} With an error code when the payload is unusable.
 * @author Claude
 */
export const normalizeGeneratedStory = ( raw: unknown ): Story =>
{
    try
    {
        return {
            id: `ai-${ Date.now() }`,
            ...normalizeStoryPayload( raw ),
            author: "IA"
        };
    }
    catch ( error )
    {
        if ( error instanceof StoryGraphError ) throw new AiError( error.code );

        throw error;
    }
};

/**
 * Validates and normalizes a user-provided payload (imported file or editor
 * draft) into a playable story without an id, throwing a
 * {@link CustomStoryError} when the payload cannot be salvaged.
 *
 * @param raw - The parsed JSON payload to validate.
 * @returns A fully-formed story, minus its id (assigned by the caller).
 * @throws {CustomStoryError} With an error code when the payload is unusable.
 * @author Claude
 */
export const normalizeCustomStory = ( raw: unknown ): Omit<Story, "id"> =>
{
    try
    {
        return normalizeStoryPayload( raw );
    }
    catch ( error )
    {
        if ( error instanceof StoryGraphError ) throw new CustomStoryError( error.code );

        throw error;
    }
};

/**
 * Converts a normalized story back to the on-disk {@link StoryFile} shape
 * (scenes as a flat array), used when persisting or exporting custom stories.
 *
 * @param story - The normalized story to flatten.
 * @param id - The id to stamp on the file.
 * @returns The story in its file shape.
 * @author Claude
 */
export const toStoryFile = ( story: Omit<Story, "id">, id: string ): StoryFile =>
{
    const { scenes, ...rest } = story;

    return { ...rest, id, scenes: Object.values( scenes ) };
};
