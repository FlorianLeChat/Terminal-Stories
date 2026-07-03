import * as m from "$lib/locales/messages";

/**
 * Tailwind text-color class for each known genre code. Genres are stored in
 * story data as language-neutral codes (e.g. `"sci-fi"`), so a single map
 * colors them regardless of the active UI locale.
 */
const genreColors: Record<string, string> = {
    "drama": "text-orange-400",
    "fantasy": "text-emerald-400",
    "sci-fi": "text-blue-400",
    "thriller": "text-red-400",
    "horror": "text-purple-400",
    "detective": "text-yellow-400"
};

/**
 * Paraglide label resolvers for each known genre code. Kept separate from the
 * color map so an unknown code (e.g. a free-text genre from an AI story) can
 * fall through to its raw value in {@link genreLabel}.
 */
const genreLabels: Record<string, () => string> = {
    "drama": m.genre_drama,
    "fantasy": m.genre_fantasy,
    "sci-fi": m.genre_sci_fi,
    "thriller": m.genre_thriller,
    "horror": m.genre_horror,
    "detective": m.genre_detective
};

/**
 * Returns the Tailwind text-color class for a genre code, falling back to the
 * dim terminal color for unknown genres.
 *
 * @param genre - The genre code (or free-text genre) to color.
 * @returns The CSS class to color the genre label.
 * @author Claude
 */
export const genreColor = ( genre: string ): string =>
{
    return genreColors[ genre ] ?? "text-terminal-dim";
};

/**
 * Resolves a genre code to its localized label for the active UI locale.
 * Unknown values (e.g. free-text genres from AI-generated stories) are
 * returned unchanged so they still display something meaningful.
 *
 * @param genre - The genre code (or free-text genre) to label.
 * @returns The localized label, or the raw value when no message exists.
 * @author Claude
 */
export const genreLabel = ( genre: string ): string =>
{
    const resolve = genreLabels[ genre ];

    return resolve ? resolve() : genre;
};
