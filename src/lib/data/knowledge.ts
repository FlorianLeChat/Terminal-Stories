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

const universeLanguageMap = new Map<string, string>(
    knowledgeBases.map( ( base ) => [
        base.universe,
        storiesMeta.find( ( s ) => s.id === base.storyId )?.language ?? "?"
    ] )
);

export const availableWikiLanguages: string[] = [ ...new Set( universeLanguageMap.values() ) ];

export function getEntry( id: string ): KnowledgeEntry | undefined
{
    return knowledgeEntries.find( ( e ) => e.id === id );
}

export function categoryLabel( category: KnowledgeCategory ): string
{
    return categories.find( ( c ) => c.id === category )?.label ?? category;
}

export function getLanguageForUniverse( universe: string ): string | null
{
    return universeLanguageMap.get( universe ) ?? null;
}

export function filterEntries( category: KnowledgeCategory, language: string | null, universe: string | null ): KnowledgeEntry[]
{
    return knowledgeEntries.filter( ( e ) =>
    {
        if ( e.category !== category ) return false;
        if ( language && universeLanguageMap.get( e.universe ) !== language ) return false;
        if ( universe && e.universe !== universe ) return false;

        return true;
    } );
}

export function countByCategory( category: KnowledgeCategory, language: string | null, universe: string | null ): number
{
    return filterEntries( category, language, universe ).length;
}
