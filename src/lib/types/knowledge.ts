export type KnowledgeCategory = "universe" | "character" | "location" | "era" | "event";

export interface KnowledgeEntry {
    id: string;
    category: KnowledgeCategory;
    name: string;
    summary: string;
    description: string | string[];
    universe: string;
    storyId?: string;
    aliases?: string[];
    tags?: string[];
    related?: string[];
}

export interface KnowledgeBase {
    universe: string;
    storyId: string;
    entries: KnowledgeEntry[];
}

export interface CategoryMeta {
    id: KnowledgeCategory;
    label: string;
    icon: string;
}

export interface WikiState {
    category: KnowledgeCategory;
    language: string | null;
    universe: string | null;
    selectedIndex: number;
    selectedEntryId: string | null;
}
