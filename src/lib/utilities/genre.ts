import * as m from "#lib/locales/messages.js";

/**
 * Paraglide label resolvers for each known genre code. Genres are stored in
 * story data as language-neutral codes (e.g. `"sci-fi"`); an unknown code (e.g. a free-text genre from an AI story) can
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
 * Every genre code the UI knows how to label, offered as the
 * preset choices of the story editor's genre picker.
 */
export const KNOWN_GENRES: string[] = Object.keys( genreLabels );

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
