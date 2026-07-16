import type { Scene, Story, StoryFile } from "$lib/types/story";
import type { CustomStoryRecord } from "$lib/types/customStory";
import { CustomStoryError } from "$lib/utilities/customStoryError";
import { normalizeCustomStory, toStoryFile } from "$lib/utilities/storyValidation";
import { deleteDiscoveredEndings, deleteSave } from "$lib/utilities/saveService";

/** localStorage key holding every custom story record. */
const STORAGE_KEY = "terminal-stories:custom-stories";

/** Id prefix marking a story as custom (private, browser-local). */
const CUSTOM_ID_PREFIX = "custom-";

// Imported files above this size are refused before parsing, so a huge file
// can neither freeze the tab nor blow up the localStorage quota.
const MAX_IMPORT_SIZE = 1_000_000;

/**
 * Returns whether a story id designates a custom (browser-local) story.
 *
 * @param id - The story id to test.
 * @returns `true` when the id carries the custom prefix.
 * @author Claude
 */
export const isCustomStoryId = ( id: string ): boolean =>
{
    return id.startsWith( CUSTOM_ID_PREFIX );
};

/**
 * Generates a fresh, collision-resistant custom story id.
 *
 * @returns A new id carrying the custom prefix.
 * @author Claude
 */
const generateCustomStoryId = (): string =>
{
    const timePart = Date.now().toString( 36 );
    const randomPart = Math.random().toString( 36 ).slice( 2, 8 );

    return `${ CUSTOM_ID_PREFIX }${ timePart }-${ randomPart }`;
};

/**
 * Reads every persisted custom story record, silently dropping entries that
 * do not look like a record (corrupted or hand-tampered storage).
 *
 * @returns The stored records, in storage order.
 * @author Claude
 */
const readRecords = (): CustomStoryRecord[] =>
{
    if ( globalThis.window === undefined ) return [];

    const raw = localStorage.getItem( STORAGE_KEY );
    if ( !raw ) return [];

    try
    {
        const parsed = JSON.parse( raw ) as unknown;
        if ( !Array.isArray( parsed ) ) return [];

        return parsed.filter( ( entry ): entry is CustomStoryRecord =>
        {
            const record = entry as CustomStoryRecord | null;
            const hasStory = record !== null && typeof record === "object" && record.story !== null && typeof record.story === "object";

            return hasStory && typeof record.story.id === "string" && isCustomStoryId( record.story.id );
        } );
    }
    catch
    {
        return [];
    }
};

/**
 * Persists the full record list, translating a storage quota failure into a
 * machine-readable {@link CustomStoryError}.
 *
 * @param records - The complete record list to store.
 * @throws {CustomStoryError} With `quota_exceeded` when localStorage is full.
 * @author Claude
 */
const writeRecords = ( records: CustomStoryRecord[] ): void =>
{
    if ( globalThis.window === undefined ) return;

    try
    {
        localStorage.setItem( STORAGE_KEY, JSON.stringify( records ) );
    }
    catch
    {
        // Browsers throw slightly different DOMExceptions here; a write failure
        // on a healthy key means the quota was hit either way.
        throw new CustomStoryError( "quota_exceeded" );
    }
};

/**
 * Lists every custom story, most recently updated first.
 *
 * @returns The stored records, newest edit first.
 * @author Claude
 */
export const listCustomStories = (): CustomStoryRecord[] =>
{
    return readRecords().sort( ( a, b ) => b.updatedAt - a.updatedAt );
};

/**
 * Looks up a single custom story record by id.
 *
 * @param id - The custom story id.
 * @returns The matching record, or `null` when none exists.
 * @author Claude
 */
export const getCustomStory = ( id: string ): CustomStoryRecord | null =>
{
    return readRecords().find( ( record ) => record.story.id === id ) ?? null;
};

/**
 * Loads a custom story in the engine's playable shape (scenes keyed by id).
 *
 * @param id - The custom story id.
 * @returns The playable story, or `undefined` when none exists.
 * @author Claude
 */
export const getCustomStoryAsStory = ( id: string ): Story | undefined =>
{
    const record = getCustomStory( id );
    if ( !record ) return undefined;

    // Null prototype: scene ids are user-controlled property names.
    const scenes: Record<string, Scene> = Object.create( null );
    for ( const scene of record.story.scenes ) scenes[ scene.id ] = scene;

    return { ...record.story, scenes };
};

/**
 * Validates and persists a custom story draft (from the editor). The draft is
 * run through the full sanitization pipeline before being stored; an existing
 * record with the same id is updated in place, otherwise a new one is created.
 *
 * @param draft - The story draft in its file shape.
 * @param forkedFrom - Id of the bundled story this draft was forked from, if any.
 * @returns The persisted record.
 * @throws {CustomStoryError} When the draft is invalid or storage is full.
 * @author Claude
 */
export const saveCustomStory = ( draft: StoryFile, forkedFrom?: string ): CustomStoryRecord =>
{
    // Full sanitization pass: the editor UI constrains inputs already, but the
    // stored payload must never depend on the UI being well-behaved.
    const normalized = normalizeCustomStory( draft );
    const id = isCustomStoryId( draft.id ) ? draft.id : generateCustomStoryId();
    const story = toStoryFile( normalized, id );

    const records = readRecords();
    const existing = records.find( ( record ) => record.story.id === id );
    const now = Date.now();

    if ( existing )
    {
        existing.story = story;
        existing.updatedAt = now;
    }
    else
    {
        const record: CustomStoryRecord = { story, createdAt: now, updatedAt: now };
        if ( forkedFrom !== undefined ) record.forkedFrom = forkedFrom;

        records.push( record );
    }

    writeRecords( records );

    return getCustomStory( id ) as CustomStoryRecord;
};

/**
 * Creates and persists a minimal blank story the editor can start from: a
 * single opening scene that is also a (neutral) ending, so the draft is valid
 * and playable from the very first save.
 *
 * @param seed - Localized starter content (the service itself stays locale-free).
 * @param seed.title - Initial story title.
 * @param seed.language - Initial story language label.
 * @param seed.universe - Initial universe name.
 * @param seed.sceneText - Text of the starter scene.
 * @returns The persisted record.
 * @throws {CustomStoryError} When storage is full.
 * @author Claude
 */
export const createBlankStory = ( seed: { title: string; language: string; universe: string; sceneText: string } ): CustomStoryRecord =>
{
    const draft: StoryFile = {
        id: generateCustomStoryId(),
        title: seed.title,
        genre: "fantasy",
        language: seed.language,
        universe: seed.universe,
        description: "",
        characters: [],
        startScene: "start",
        scenes: [
            {
                id: "start",
                text: [ seed.sceneText ],
                choices: [],
                isEnding: true,
                endingType: "neutral"
            }
        ]
    };

    return saveCustomStory( draft );
};

/**
 * Forks a bundled story into a new private custom story the user can edit.
 * The content is deep-copied; the original story is never touched.
 *
 * @param source - The bundled story to fork.
 * @returns The persisted forked record.
 * @throws {CustomStoryError} When storage is full.
 * @author Claude
 */
export const forkStory = ( source: Story ): CustomStoryRecord =>
{
    // structuredClone guarantees the fork shares no reference with the catalog
    // story, so editing the copy can never mutate the original.
    const copy = structuredClone( source );
    const draft = toStoryFile( copy, generateCustomStoryId() );

    return saveCustomStory( draft, source.id );
};

/**
 * Deletes a custom story along with its save slot and endings record, so no
 * orphaned data lingers in localStorage.
 *
 * @param id - The custom story id to delete.
 * @author Claude
 */
export const deleteCustomStory = ( id: string ): void =>
{
    const records = readRecords().filter( ( record ) => record.story.id !== id );

    writeRecords( records );
    deleteSave( id );
    deleteDiscoveredEndings( id );
};

/**
 * Serializes a custom story for file export, with a filesystem-friendly
 * filename derived from its title.
 *
 * @param id - The custom story id to export.
 * @returns The pretty-printed JSON and its suggested filename.
 * @throws {CustomStoryError} With `not_found` when the id is unknown.
 * @author Claude
 */
export const exportCustomStory = ( id: string ): { filename: string; json: string } =>
{
    const record = getCustomStory( id );
    if ( !record ) throw new CustomStoryError( "not_found" );

    const slug = record.story.title
        .toLowerCase()
        .normalize( "NFD" )
        // Strip the combining diacritics detached by NFD so "éclat" → "eclat".
        .replaceAll( /[\u0300-\u036f]/g, "" )
        .replaceAll( /[^a-z0-9]+/g, "-" )
        .replaceAll( /^-+|-+$/g, "" );

    return {
        filename: `${ slug !== "" ? slug : "story" }.json`,
        json: JSON.stringify( record.story, null, 4 )
    };
};

/**
 * Imports a story from raw JSON text (an exported or hand-written file). The
 * payload is size-checked, parsed, then run through the full validation and
 * sanitization pipeline before being stored under a fresh id — an imported
 * file can therefore never carry executable or oversized content into the app.
 *
 * @param rawText - The raw text content of the imported file.
 * @returns The persisted record.
 * @throws {CustomStoryError} When the file is too large, unparsable, invalid, or storage is full.
 * @author Claude
 */
export const importCustomStory = ( rawText: string ): CustomStoryRecord =>
{
    if ( rawText.length > MAX_IMPORT_SIZE ) throw new CustomStoryError( "too_large" );

    let parsed: unknown;

    try
    {
        parsed = JSON.parse( rawText );
    }
    catch
    {
        throw new CustomStoryError( "invalid_json" );
    }

    const normalized = normalizeCustomStory( parsed );
    const story = toStoryFile( normalized, generateCustomStoryId() );

    return saveCustomStory( story );
};
