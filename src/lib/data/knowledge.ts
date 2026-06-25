import type { KnowledgeBase, KnowledgeCategory, KnowledgeEntry, CategoryMeta } from "$lib/types/knowledge";
import { storiesMeta } from "$lib/data";

import foretMaudite from "./knowledge/foret-maudite.json";
import stationTerminus from "./knowledge/station-terminus.json";
import dernierAppel from "./knowledge/dernier-appel.json";

export const knowledgeBases: KnowledgeBase[] = [
    foretMaudite as KnowledgeBase,
    stationTerminus as KnowledgeBase,
    dernierAppel as KnowledgeBase
];

// Flatten every base into a single list, defaulting each entry's universe and
// storyId to its base so individual entries don't have to repeat them.
export const knowledgeEntries: KnowledgeEntry[] = knowledgeBases.flatMap( ( base ) =>
    base.entries.map( ( entry ) => ( { ...entry, universe: entry.universe ?? base.universe, storyId: entry.storyId ?? base.storyId } ) )
);

export const categories: CategoryMeta[] = [
    { id: "universe", label: "Univers", icon: "✦" },
    { id: "character", label: "Personnages", icon: "☻" },
    { id: "location", label: "Lieux", icon: "⌖" },
    { id: "era", label: "Époques", icon: "⧗" },
    { id: "event", label: "Événements", icon: "✶" }
];

export const availableUniverses: string[] = [ ...new Set( knowledgeEntries.map( ( e ) => e.universe ) ) ];

// Maps each universe to the language of its story, so wiki entries can be
// filtered by language even though they only carry a universe.
const universeLanguageMap = new Map<string, string>(
    knowledgeBases.map( ( base ) => [
        base.universe,
        storiesMeta.find( ( s ) => s.id === base.storyId )?.language ?? "?"
    ] )
);

export const availableWikiLanguages: string[] = [ ...new Set( universeLanguageMap.values() ) ];

/**
 * Looks up a knowledge entry by its unique identifier.
 *
 * @param id - The entry identifier.
 * @returns The matching entry, or `undefined` if none exists.
 * @author Claude
 */
export const getEntry = ( id: string ): KnowledgeEntry | undefined =>
{
    return knowledgeEntries.find( ( e ) => e.id === id );
};

/**
 * Resolves the human-readable label of a knowledge category.
 *
 * @param category - The category identifier.
 * @returns The localized label, falling back to the raw id if unknown.
 * @author Claude
 */
export const categoryLabel = ( category: KnowledgeCategory ): string =>
{
    return categories.find( ( c ) => c.id === category )?.label ?? category;
};

/**
 * Returns the language associated with a universe, derived from the story it
 * belongs to.
 *
 * @param universe - The universe name.
 * @returns The language, or `null` if the universe is unknown.
 * @author Claude
 */
export const getLanguageForUniverse = ( universe: string ): string | null =>
{
    return universeLanguageMap.get( universe ) ?? null;
};

/**
 * Filters the knowledge entries by category and, optionally, by language and
 * universe.
 *
 * @param category - The category to keep.
 * @param language - The language to keep, or `null` for any.
 * @param universe - The universe to keep, or `null` for any.
 * @returns The entries matching all the provided criteria.
 * @author Claude
 */
export const filterEntries = ( category: KnowledgeCategory, language: string | null, universe: string | null ): KnowledgeEntry[] =>
{
    return knowledgeEntries.filter( ( e ) =>
    {
        if ( e.category !== category ) return false;
        if ( language && universeLanguageMap.get( e.universe ) !== language ) return false;
        if ( universe && e.universe !== universe ) return false;

        return true;
    } );
};

/**
 * Counts the entries in a category for the given language/universe filter.
 * Used to display badge counts in the wiki browser.
 *
 * @param category - The category to count.
 * @param language - The language to keep, or `null` for any.
 * @param universe - The universe to keep, or `null` for any.
 * @returns The number of matching entries.
 * @author Claude
 */
export const countByCategory = ( category: KnowledgeCategory, language: string | null, universe: string | null ): number =>
{
    return filterEntries( category, language, universe ).length;
};
