import type { Story, StoryMeta } from "$lib/types/story";

import foretMaudite from "./stories/foret-maudite.json";
import stationTerminus from "./stories/station-terminus.json";
import dernierAppel from "./stories/dernier-appel.json";

export const stories: Story[] = [ foretMaudite as Story, stationTerminus as Story, dernierAppel as Story ];

export const storiesMeta: StoryMeta[] = stories.map( ( { id, title, genre, universe, description, tags } ) => ( {
    id,
    title,
    genre,
    universe,
    description,
    tags
} ) );

export function getStory( id: string ): Story | undefined
{
    return stories.find( ( s ) => s.id === id );
}
