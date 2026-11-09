import type { PhosphorTheme, Story } from "#lib/types/story.ts";

/**
 * Phosphor picked from a story's genre when the story sets none: warm amber
 * for investigations, cyan for space. Other genres keep the system green.
 */
const GENRE_PHOSPHOR: Record<string, PhosphorTheme> = {
    "detective": "amber",
    "thriller": "amber",
    "sci-fi": "cyan"
};

/** The monitor's own phosphor, used by every view outside a story. */
export const DEFAULT_PHOSPHOR: PhosphorTheme = "green";

/**
 * Resolves the phosphor a story is shown in: its own `phosphor` when set,
 * otherwise the theme of its genre, otherwise the default green.
 *
 * @param story - The story (only its genre and phosphor are read).
 * @returns The phosphor theme to apply.
 * @author Claude
 */
export const resolvePhosphor = ( story: Pick<Story, "genre" | "phosphor"> ): PhosphorTheme =>
{
    return story.phosphor ?? GENRE_PHOSPHOR[ story.genre ] ?? DEFAULT_PHOSPHOR;
};
