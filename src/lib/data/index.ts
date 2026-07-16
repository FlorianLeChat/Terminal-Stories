import type { Scene, Story, StoryFile, StoryMeta, StoryFilters } from "$lib/types/story";
import { computeStoryStats } from "$lib/utilities/readingTime";

// Eagerly scans every JSON file in ./stories so new stories are picked up
// automatically, without an import to add by hand for each one.
const storyModules = import.meta.glob<StoryFile>( "./stories/*.json", { eager: true, import: "default" } );

/**
 * Turns a story file's flat `scenes` array into the keyed map the engine
 * looks up scenes by id with.
 *
 * @param file - The raw story as authored in JSON.
 * @returns The story with its scene array converted to a `Record`.
 * @author Claude
 */
const toStory = ( file: StoryFile ): Story =>
{
    const scenes: Record<string, Scene> = {};
    for ( const scene of file.scenes ) scenes[ scene.id ] = scene;

    return { ...file, scenes };
};

/** All stories bundled with the application. */
export const stories: Story[] = Object.values( storyModules ).map( toStory );

// Lightweight metadata used by the menu and filters, with precomputed reading
// stats so the full scene graph never has to be walked during rendering.
export const storiesMeta: StoryMeta[] = stories.map( ( story ) =>
{
    const { id, title, genre, language, universe, description } = story;

    const endingIds = Object.entries( story.scenes )
        .filter( ( [ , s ] ) => s.isEnding )
        .map( ( [ id ] ) => id );

    return {
        id,
        title,
        genre,
        language,
        universe,
        description,
        stats: computeStoryStats( story ),
        endingIds
    };
} );

/**
 * Looks up a full story (including its scene graph) by id.
 *
 * @param id - The story identifier.
 * @returns The matching story, or `undefined` if none exists.
 * @author Claude
 */
export const getStory = ( id: string ): Story | undefined =>
{
    return stories.find( ( s ) => s.id === id );
};

/** Distinct genres across all stories, for the genre filter. */
export const availableGenres: string[] = [ ...new Set( storiesMeta.map( ( s ) => s.genre ) ) ];

/** Distinct languages across all stories, for the language filter. */
export const availableLanguages: string[] = [ ...new Set( storiesMeta.map( ( s ) => s.language ) ) ];

/**
 * Filters story metadata by the active genre and language filters. A `null`
 * filter matches any value.
 *
 * @param meta - The story metadata to filter.
 * @param filters - The active genre/language selection.
 * @returns The stories matching every active filter.
 * @author Claude
 */
export const filterStories = ( meta: StoryMeta[], filters: StoryFilters ): StoryMeta[] =>
{
    return meta.filter( ( s ) =>
    {
        if ( filters.genre && s.genre !== filters.genre ) return false;
        if ( filters.language && s.language !== filters.language ) return false;

        return true;
    } );
};
