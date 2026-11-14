import { resolvePhosphor } from "#lib/utilities/phosphor.ts";
import type { KnowledgeBase } from "#lib/types/knowledge.ts";
import type { Catalog, EntryLink } from "#lib/types/catalog.ts";
import { computeStoryStats } from "#lib/utilities/readingTime.ts";
import type { Scene, Story, StoryFile, StoryMeta } from "#lib/types/story.ts";

/** A story JSON file read from disk: its file name and parsed content. */
export interface StorySource {
    file: string;
    story: StoryFile;
}

/**
 * Turns a story file's flat `scenes` array into the keyed map the engine
 * looks up scenes by id with.
 *
 * @param file - The raw story as authored in JSON.
 * @returns The story with its scene array converted to a `Record`.
 * @author Claude
 */
export const toStory = ( file: StoryFile ): Story =>
{
    const scenes: Record<string, Scene> = {};
    for ( const scene of file.scenes ) scenes[ scene.id ] = scene;

    return { ...file, scenes };
};

/**
 * Builds the menu metadata of a story, walking its scene graph once for the
 * reading stats and the ending ids.
 *
 * @param story - The full story.
 * @returns The story's menu metadata.
 * @author Claude
 */
const toStoryMeta = ( story: Story ): StoryMeta =>
{
    const { id, title, genre, language, universe, description } = story;

    const endingIds = Object.entries( story.scenes )
        .filter( ( [ , scene ] ) => scene.isEnding )
        .map( ( [ sceneId ] ) => sceneId );

    return {
        id,
        title,
        genre,
        language,
        universe,
        description,
        stats: computeStoryStats( story ),
        endingIds,
        characterNames: story.characters.map( ( character ) => character.name ),
        phosphor: resolvePhosphor( story )
    };
};

/**
 * Builds the lightweight catalog from every story and knowledge base. Runs at
 * build time (see the catalog plugin in `vite.config.ts`), so the browser
 * never walks a scene graph to show the menu.
 *
 * @param sources - Every story JSON file, with its file name.
 * @param bases - Every knowledge base JSON file.
 * @returns The catalog served as the `virtual:catalog` module.
 * @author Claude
 */
export const buildCatalog = ( sources: StorySource[], bases: KnowledgeBase[] ): Catalog =>
{
    const stories = sources.map( ( source ) => toStoryMeta( toStory( source.story ) ) );
    const storyFiles = Object.fromEntries( sources.map( ( source ) => [ source.story.id, source.file ] ) );

    const entries = bases.flatMap( ( base ) => base.entries.map( ( entry ) => ( { ...entry, universe: entry.universe ?? base.universe } ) ) );
    const universes = [ ...new Set( entries.map( ( entry ) => entry.universe ) ) ];

    const universeLanguages = bases.map( ( base ): [ string, string ] =>
    {
        const language = stories.find( ( story ) => story.id === base.storyId )?.language ?? "?";

        return [ base.universe, language ];
    } );

    const toLink = ( entry: { id: string; name: string } ): EntryLink => ( { id: entry.id, name: entry.name } );

    const wikiLinks = Object.fromEntries( bases.map( ( base ) =>
    {
        const universeEntry = base.entries.find( ( entry ) => entry.category === "universe" );
        const characters = base.entries.filter( ( entry ) => entry.category === "character" ).map( toLink );

        return [ base.storyId, { universe: universeEntry ? toLink( universeEntry ) : null, characters } ];
    } ) );

    return {
        stories,
        storyFiles,
        wikiEntryIds: entries.map( ( entry ) => entry.id ),
        universes,
        universeLanguages,
        wikiLinks
    };
};
