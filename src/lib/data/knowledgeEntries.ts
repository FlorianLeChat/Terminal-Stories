import type { KnowledgeBase, KnowledgeEntry } from "#lib/types/knowledge.ts";

const knowledgeModules = import.meta.glob<KnowledgeBase>( "./knowledge/*.json", { eager: true, import: "default" } );

/**
 * Every wiki entry across all knowledge bases (each JSON file in ./knowledge),
 * with `universe` and `storyId` defaulting to the base's own values. Only
 * reached through the dynamic import in `loadKnowledge`, so the entries ship
 * in a chunk of their own.
 *
 * @author Claude
 */
export const knowledgeEntries: KnowledgeEntry[] = Object.values( knowledgeModules ).flatMap( ( base ) =>
    base.entries.map( ( entry ) => ( { ...entry, universe: entry.universe ?? base.universe, storyId: entry.storyId ?? base.storyId } ) )
);
