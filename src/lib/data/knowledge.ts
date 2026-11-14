import catalog from "virtual:catalog";
import type { StoryWikiLinks } from "#lib/types/catalog.ts";
import type { KnowledgeCategory, KnowledgeEntry, CategoryMeta } from "#lib/types/knowledge.ts";

/**
 * Every wiki entry, empty until {@link loadKnowledge} resolves. The entry
 * lookups below read it, so they only make sense in the views opened after
 * that load (the encyclopedia and its entries).
 *
 * @author Claude
 */
let knowledgeEntries: KnowledgeEntry[] = [];

let knowledgeLoad: Promise<void> | null = null;

/** Ids of every wiki entry, known without downloading the entries. */
const wikiEntryIds = new Set( catalog.wikiEntryIds );

/**
 * Downloads (once) every wiki entry, kept in a chunk of its own so the menu
 * never waits on it. A failed download is forgotten, so the next call retries.
 *
 * @returns A promise settled once the entries are available.
 * @author Claude
 */
export const loadKnowledge = (): Promise<void> =>
{
    knowledgeLoad ??= import( "#lib/data/knowledgeEntries.ts" )
        .then( ( module ) =>
        {
            knowledgeEntries = module.knowledgeEntries;
        } )
        .catch( ( error: unknown ) =>
        {
            knowledgeLoad = null;
            throw error;
        } );

    return knowledgeLoad;
};

/**
 * Returns the downloaded wiki entries (empty before {@link loadKnowledge}).
 *
 * @returns Every wiki entry, in source order.
 * @author Claude
 */
export const getKnowledgeEntries = (): KnowledgeEntry[] =>
{
    return knowledgeEntries;
};

/**
 * Returns whether an id designates an existing wiki entry, without needing the
 * entries to be downloaded (used to validate deep links).
 *
 * @param id - The entry identifier.
 * @returns `true` when the encyclopedia holds an entry with this id.
 * @author Claude
 */
export const isWikiEntryId = ( id: string ): boolean =>
{
    return wikiEntryIds.has( id );
};

/**
 * Returns the encyclopedia entries a catalog story links to from its info
 * screen, without needing the entries to be downloaded.
 *
 * @param storyId - The story identifier.
 * @returns The story's universe and character entries (none for other stories).
 * @author Claude
 */
export const getStoryWikiLinks = ( storyId: string ): StoryWikiLinks =>
{
    const hasLinks = Object.hasOwn( catalog.wikiLinks, storyId );

    return hasLinks ? catalog.wikiLinks[ storyId ] : { universe: null, characters: [] };
};

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

export const availableUniverses: string[] = catalog.universes;

/**
 * Maps each universe to the language of its story, so wiki entries can be
 * filtered by language even though they only carry a universe.
 *
 * @author Claude
 */
const universeLanguageMap = new Map<string, string>( catalog.universeLanguages );

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
