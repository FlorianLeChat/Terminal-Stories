import type { StoryMeta } from "#lib/types/story.ts";

/** A link to an encyclopedia entry: its id and display name. */
export interface EntryLink {
    id: string;
    name: string;
}

/** Encyclopedia entries a catalog story links to from its info screen. */
export interface StoryWikiLinks {
    /** The story's universe entry, if its knowledge base has one. */
    universe: EntryLink | null;
    /** Every character entry of the story's knowledge base. */
    characters: EntryLink[];
}

/**
 * Lightweight catalog generated at build time from the story and knowledge
 * JSON files, so the menu, the filters, the search and the deep links work
 * without downloading any scene graph or wiki entry.
 */
export interface Catalog {
    /** Menu metadata of every catalog story. */
    stories: StoryMeta[];
    /** Story id to the name of the JSON file holding its scenes. */
    storyFiles: Record<string, string>;
    /** Ids of every encyclopedia entry. */
    wikiEntryIds: string[];
    /** Every universe with encyclopedia entries, in source order. */
    universes: string[];
    /** Universe to the language of its story, as `[universe, language]` pairs. */
    universeLanguages: [ string, string ][];
    /** Story id to the encyclopedia entries its info screen links to. */
    wikiLinks: Record<string, StoryWikiLinks>;
}
