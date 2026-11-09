import * as m from "#lib/locales/messages.js";
import type { Story } from "#lib/types/story.ts";
import { storyLocale, type StoryLocale } from "#lib/utilities/storyLocale.ts";

/** A parameterless message, printable in a given locale. */
type LocalizedLine = ( inputs: Record<string, never>, options: { locale: StoryLocale } ) => string;

/**
 * Universe-specific log lines printed when a catalog story starts, after the
 * generic "mounting archive" line. Stories without an entry only get the
 * generic line.
 */
const STORY_BOOT_LINES: Record<string, LocalizedLine[]> = {
    "cursed-forest": [ m.story_boot_cursed_forest_1, m.story_boot_cursed_forest_2 ],
    "l-affaire-du-raton-laveur": [ m.story_boot_raton_laveur_1, m.story_boot_raton_laveur_2 ],
    "la-femme-aux-cheveux-en-or": [ m.story_boot_cheveux_en_or_1, m.story_boot_cheveux_en_or_2 ],
    "last-call": [ m.story_boot_last_call_1, m.story_boot_last_call_2 ],
    "le-dernier-espoir": [ m.story_boot_dernier_espoir_1, m.story_boot_dernier_espoir_2 ],
    "terminus-station": [ m.story_boot_terminus_station_1, m.story_boot_terminus_station_2 ]
};

/**
 * Returns the short boot log printed at the top of a playthrough: the
 * archive being mounted (the story's universe), then its own log lines, in
 * the story's own language.
 *
 * @param story - The story starting.
 * @returns The log lines, in order.
 * @author Claude
 */
export const storyBootLog = ( story: Pick<Story, "id" | "universe" | "language"> ): string[] =>
{
    const ownLines = STORY_BOOT_LINES[ story.id ] ?? [];
    const locale = storyLocale( story.language );

    return [ m.story_boot_mount( { universe: story.universe }, { locale } ), ...ownLines.map( ( line ) => line( {}, { locale } ) ) ];
};
