import type { KnowledgeBase, KnowledgeCategory, KnowledgeEntry, CategoryMeta } from "$lib/types/knowledge";
import { storiesMeta } from "$lib/data";

// Eagerly scans every JSON file in ./knowledge so new knowledge bases are
// picked up automatically, without an import to add by hand for each one.
const knowledgeModules = import.meta.glob<KnowledgeBase>( "./knowledge/*.json", { eager: true, import: "default" } );

export const knowledgeBases: KnowledgeBase[] = Object.values( knowledgeModules );

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

/** Ordered list of category ids, precomputed to avoid recreating it on every cycle. */
export const categoryIds: KnowledgeCategory[] = categories.map( ( c ) => c.id );

/** Maps each category id to its icon for O(1) template lookups. */
export const categoryIconMap: Record<KnowledgeCategory, string> = Object.fromEntries(
    categories.map( ( c ) => [ c.id, c.icon ] )
) as Record<KnowledgeCategory, string>;

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
 * Counts entries for every category in a single pass over `knowledgeEntries`,
 * avoiding the N separate `filterEntries` scans that `countByCategory` would
 * trigger when called once per category tab.
 *
 * @param language - The language to keep, or `null` for any.
 * @param universe - The universe to keep, or `null` for any.
 * @returns A record mapping each category id to its entry count.
 * @author Claude
 */
export const countAllCategories = ( language: string | null, universe: string | null ): Record<KnowledgeCategory, number> =>
{
    const counts = Object.fromEntries( categoryIds.map( ( id ) => [ id, 0 ] ) ) as Record<KnowledgeCategory, number>;

    for ( const e of knowledgeEntries )
    {
        if ( language && universeLanguageMap.get( e.universe ) !== language ) continue;
        if ( universe && e.universe !== universe ) continue;

        counts[ e.category ]++;
    }

    return counts;
};
