import catalog from "virtual:catalog";
import { toStory } from "#lib/data/catalog.ts";
import type { Story, StoryFile, StoryMeta, StoryFilters } from "#lib/types/story.ts";

/**
 * One lazy loader per story JSON file: a story's scene graph is only
 * downloaded when the story is opened, in a chunk of its own.
 *
 * @author Claude
 */
const storyLoaders = import.meta.glob<StoryFile>( "./stories/*.json", { import: "default" } );

/** Stories already downloaded, by id. */
const loadedStories = new Map<string, Story>();

/**
 * Lightweight metadata used by the menu, the filters and the search, built at
 * compile time so no scene graph is walked (or downloaded) to render the menu.
 *
 * @author Claude
 */
export const storiesMeta: StoryMeta[] = catalog.stories;

/**
 * Returns whether an id designates a story bundled with the application.
 *
 * @param id - The story identifier.
 * @returns `true` when the catalog holds a story with this id.
 * @author Claude
 */
export const isCatalogStory = ( id: string ): boolean =>
{
    return Object.hasOwn( catalog.storyFiles, id );
};

/**
 * Downloads (once) and returns a bundled story with its full scene graph.
 *
 * @param id - The story identifier.
 * @returns The matching story, or `undefined` if none exists.
 * @author Claude
 */
export const loadStory = async ( id: string ): Promise<Story | undefined> =>
{
    const cached = loadedStories.get( id );
    if ( cached ) return cached;

    if ( !isCatalogStory( id ) ) return undefined;

    const loader = storyLoaders[ `./stories/${ catalog.storyFiles[ id ] }` ];
    if ( !loader ) return undefined;

    const story = toStory( await loader() );
    loadedStories.set( id, story );

    return story;
};

/**
 * Returns a bundled story already downloaded by {@link loadStory}, for the
 * synchronous paths that always run after it (starting or resuming the story
 * whose info screen is open).
 *
 * @param id - The story identifier.
 * @returns The downloaded story, or `undefined` if it was never loaded.
 * @author Claude
 */
export const getLoadedStory = ( id: string ): Story | undefined =>
{
    return loadedStories.get( id );
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
