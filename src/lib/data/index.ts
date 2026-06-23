import type { Story, StoryMeta, StoryFilters } from "$lib/types/story";
import { computeStoryStats } from "$lib/utilities/readingTime";

import foretMaudite from "./stories/foret-maudite.json";
import stationTerminus from "./stories/station-terminus.json";
import dernierAppel from "./stories/dernier-appel.json";

/** All stories bundled with the application. */
export const stories: Story[] = [ foretMaudite as Story, stationTerminus as Story, dernierAppel as Story ];

// Lightweight metadata used by the menu and filters, with precomputed reading
// stats so the full scene graph never has to be walked during rendering.
export const storiesMeta: StoryMeta[] = stories.map( ( story ) =>
{
    const { id, title, genre, language, universe, description, tags } = story;

    return {
        id,
        title,
        genre,
        language,
        universe,
        description,
        tags,
        stats: computeStoryStats( story )
    };
} );

/**
 * Looks up a full story (including its scene graph) by id.
 *
 * @param id - The story identifier.
 * @returns The matching story, or `undefined` if none exists.
 * @author Claude
 */
export function getStory( id: string ): Story | undefined
{
    return stories.find( ( s ) => s.id === id );
}

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
export function filterStories( meta: StoryMeta[], filters: StoryFilters ): StoryMeta[]
{
    return meta.filter( ( s ) =>
    {
        if ( filters.genre && s.genre !== filters.genre ) return false;
        if ( filters.language && s.language !== filters.language ) return false;

        return true;
    } );
}
