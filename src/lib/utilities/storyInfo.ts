import { knowledgeBases } from "#lib/data/knowledge.ts";
import type { Story, StoryStats } from "#lib/types/story.ts";
import { loadDiscoveredEndings } from "#lib/utilities/saveService.ts";

/** A link to an encyclopedia entry: its id and display name. */
export interface EntryLink {
    id: string;
    name: string;
}

/** Extra facts shown on a story's info screen. */
export interface StoryInfoDetails {
    /** Distinct endings the reader has already found. */
    endingsFound: number;
    /** Total endings the story has. */
    endingsTotal: number;
    /** Estimated minutes for one playthrough. */
    readingMinutes: number;
    /** Estimated minutes to read every scene, across all branches. */
    fullMinutes: number;
    /** Main characters with an encyclopedia entry, most important first. */
    characters: EntryLink[];
    /** The story's universe entry in the encyclopedia, if any. */
    universe: EntryLink | null;
}

/** Character roles worth listing on the info screen, in display order. */
const MAIN_ROLES = [ "protagonist", "antagonist", "ally" ] as const;

/** Maximum number of characters listed on the info screen. */
const MAX_CHARACTERS = 4;

/**
 * Gathers what the info screen shows beyond the description: the reading
 * times (one playthrough and every branch), the endings already found, and the encyclopedia entries of the story's universe and
 * main characters (matched by name against the story's own cast, ranked by
 * role so the protagonist comes first).
 *
 * @param story - The story being previewed.
 * @param stats - The story's reading statistics.
 * @returns The details to render; empty links for stories without a knowledge base.
 * @author Claude
 */
export const buildStoryInfoDetails = ( story: Story, stats: StoryStats ): StoryInfoDetails =>
{
    const endingsTotal = Object.values( story.scenes ).filter( ( scene ) => scene.isEnding === true ).length;
    const endingsFound = loadDiscoveredEndings( story.id ).size;

    const base = knowledgeBases.find( ( kb ) => kb.storyId === story.id );
    const entries = base?.entries ?? [];

    const universeEntry = entries.find( ( entry ) => entry.category === "universe" );
    const characterEntries = entries.filter( ( entry ) => entry.category === "character" );

    const rankedCast = MAIN_ROLES.flatMap( ( role ) => story.characters.filter( ( c ) => c.role === role ) );

    const characters = rankedCast
        .map( ( character ) => characterEntries.find( ( entry ) => entry.name === character.name ) )
        .filter( ( entry ) => entry !== undefined )
        .slice( 0, MAX_CHARACTERS )
        .map( ( entry ): EntryLink => ( { id: entry.id, name: entry.name } ) );

    return {
        endingsFound,
        endingsTotal,
        readingMinutes: stats.minutes,
        fullMinutes: stats.fullMinutes,
        characters,
        universe: universeEntry ? { id: universeEntry.id, name: universeEntry.name } : null
    };
};
