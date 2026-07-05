import type { Character, CharacterRole, Choice, Scene, Story } from "$lib/types/story";
import { AiError } from "$lib/utilities/aiError";

// The model is asked to return scenes as an array (easier to produce reliably
// than a keyed map), which we normalize into the Record the engine expects.
interface RawChoice {
    id?: string;
    text?: string;
    action?: string;
    consequence?: string;
    nextScene?: string;
    requiresFlag?: string;
    setsFlag?: string;
}

interface RawScene {
    id?: string;
    text?: string | string[];
    speaker?: string;
    choices?: RawChoice[];
    isEnding?: boolean;
    endingType?: "good" | "bad" | "neutral";
}

interface RawStory {
    title?: string;
    genre?: string;
    language?: string;
    universe?: string;
    description?: string;
    tags?: string[];
    characters?: Partial<Character>[];
    startScene?: string;
    scenes?: RawScene[] | Record<string, RawScene>;
}

/** Roles the engine recognizes; anything else is coerced to "npc". */
const KNOWN_ROLES: CharacterRole[] = [ "protagonist", "antagonist", "ally", "npc", "narrator" ];

/**
 * Coerces a character's role to a value the engine understands.
 *
 * @param role - The raw role string from the model.
 * @returns A valid {@link CharacterRole}.
 * @author Claude
 */
const coerceRole = ( role: unknown ): CharacterRole =>
{
    const isKnown = typeof role === "string" && ( KNOWN_ROLES as string[] ).includes( role );

    return isKnown ? ( role as CharacterRole ) : "npc";
};

/**
 * Turns the model's `scenes` (array or map) into an array of raw scenes, each
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
 * sensible fallbacks for optional narration fields.
 *
 * @param raw - The raw choice from the model.
 * @param index - The choice position, used to synthesize a stable id.
 * @returns A normalized choice, or `null` when it lacks a target scene.
 * @author Claude
 */
const normalizeChoice = ( raw: RawChoice, index: number ): Choice | null =>
{
    const nextScene = typeof raw.nextScene === "string" ? raw.nextScene.trim() : "";
    if ( nextScene === "" ) return null;

    const text = typeof raw.text === "string" && raw.text.trim() !== "" ? raw.text : `Option ${ index + 1 }`;

    const choice: Choice = {
        id: typeof raw.id === "string" && raw.id !== "" ? raw.id : `choice-${ index }`,
        text,
        action: typeof raw.action === "string" ? raw.action : "",
        consequence: typeof raw.consequence === "string" ? raw.consequence : "",
        nextScene
    };

    if ( typeof raw.requiresFlag === "string" ) choice.requiresFlag = raw.requiresFlag;
    if ( typeof raw.setsFlag === "string" ) choice.setsFlag = raw.setsFlag;

    return choice;
};

/**
 * Normalizes one raw scene into a {@link Scene}. Choices are normalized but not
 * yet validated against the scene map (that happens in a later pass).
 *
 * @param raw - The raw scene from the model.
 * @returns A normalized scene.
 * @author Claude
 */
const normalizeScene = ( raw: RawScene ): Scene =>
{
    const id = ( raw.id ?? "" ).trim();
    const text = Array.isArray( raw.text ) ? raw.text : [ typeof raw.text === "string" ? raw.text : "" ];

    const rawChoices = Array.isArray( raw.choices ) ? raw.choices : [];
    const choices = rawChoices
        .map( ( choice, index ) => normalizeChoice( choice, index ) )
        .filter( ( choice ): choice is Choice => choice !== null );

    const scene: Scene = { id, text, choices };

    if ( typeof raw.speaker === "string" ) scene.speaker = raw.speaker;
    if ( raw.isEnding === true ) scene.isEnding = true;
    if ( raw.endingType === "good" || raw.endingType === "bad" || raw.endingType === "neutral" )
    {
        scene.endingType = raw.endingType;
    }

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
const hasReachableEnding = ( scenes: Record<string, Scene>, startScene: string ): boolean =>
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
 * Validates and normalizes a raw, model-generated payload into a playable
 * {@link Story}. Prunes dangling choices, turns choice-less non-ending scenes
 * into endings, and guarantees a coherent, reachable graph — throwing an
 * {@link AiError} when the payload cannot be salvaged.
 *
 * @param raw - The parsed JSON returned by the model.
 * @returns A fully-formed, ephemeral story (id prefixed with `ai-`).
 * @throws {AiError} With an error code when the payload is unusable.
 * @author Claude
 */
export const normalizeGeneratedStory = ( raw: unknown ): Story =>
{
    const isObject = raw !== null && typeof raw === "object";
    if ( !isObject ) throw new AiError( "not_object" );

    const data = raw as RawStory;

    const rawScenes = collectRawScenes( data.scenes );
    if ( rawScenes.length === 0 ) throw new AiError( "no_scenes" );

    // Build the scene map, dropping any scene that lost its id during generation.
    const scenes: Record<string, Scene> = {};
    for ( const rawScene of rawScenes )
    {
        const scene = normalizeScene( rawScene );
        if ( scene.id !== "" ) scenes[ scene.id ] = scene;
    }

    const sceneIds = Object.keys( scenes );
    if ( sceneIds.length === 0 ) throw new AiError( "no_scene_ids" );

    // Resolve the entry point, falling back to the first scene when the declared
    // one is missing or unknown.
    const declaredStart = typeof data.startScene === "string" ? data.startScene : "";
    const startScene = scenes[ declaredStart ] ? declaredStart : sceneIds[ 0 ];

    // Prune choices that point to non-existent scenes, then promote any non-ending
    // scene that ends up choice-less into a neutral ending so playback never stalls.
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

    if ( !hasReachableEnding( scenes, startScene ) )
    {
        throw new AiError( "no_ending" );
    }

    const characters: Character[] = Array.isArray( data.characters )
        ? data.characters.map( ( character, index ) => ( {
            id: typeof character.id === "string" && character.id !== "" ? character.id : `character-${ index }`,
            name: typeof character.name === "string" ? character.name : `Personnage ${ index + 1 }`,
            role: coerceRole( character.role )
        } ) )
        : [];

    const tags = Array.isArray( data.tags ) ? data.tags.filter( ( tag ): tag is string => typeof tag === "string" ) : [];

    return {
        id: `ai-${ Date.now() }`,
        title: typeof data.title === "string" && data.title.trim() !== "" ? data.title : "Histoire générée",
        genre: typeof data.genre === "string" && data.genre.trim() !== "" ? data.genre : "Indéterminé",
        language: typeof data.language === "string" && data.language.trim() !== "" ? data.language : "Français",
        universe: typeof data.universe === "string" && data.universe.trim() !== "" ? data.universe : "Univers généré",
        description: typeof data.description === "string" ? data.description : "",
        tags,
        author: "IA",
        characters,
        startScene,
        scenes
    };
};
