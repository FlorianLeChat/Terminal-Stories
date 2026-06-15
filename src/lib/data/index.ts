import type { Story, StoryMeta, StoryFilters } from "$lib/types/story";

import foretMaudite from "./stories/foret-maudite.json";
import stationTerminus from "./stories/station-terminus.json";
import dernierAppel from "./stories/dernier-appel.json";

export const stories: Story[] = [ foretMaudite as Story, stationTerminus as Story, dernierAppel as Story ];

export const storiesMeta: StoryMeta[] = stories.map( ( { id, title, genre, language, universe, description, tags } ) => ( {
    id,
    title,
    genre,
    language,
    universe,
    description,
    tags
} ) );

export function getStory( id: string ): Story | undefined
{
    return stories.find( ( s ) => s.id === id );
}

export const availableGenres: string[] = [ ...new Set( storiesMeta.map( ( s ) => s.genre ) ) ];

export const availableLanguages: string[] = [ ...new Set( storiesMeta.map( ( s ) => s.language ) ) ];

export function filterStories( meta: StoryMeta[], filters: StoryFilters ): StoryMeta[]
{
    return meta.filter( ( s ) =>
    {
        if ( filters.genre && s.genre !== filters.genre ) return false;
        if ( filters.language && s.language !== filters.language ) return false;

        return true;
    } );
}
