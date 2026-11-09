import * as m from "#lib/locales/messages.js";
import { getLocale, locales } from "#lib/locales/runtime.js";

/** A locale the interface is translated into. */
export type StoryLocale = ( typeof locales )[ number ];

/**
 * Resolves the interface locale matching a story's language, so the strings
 * printed inside a story (the choice prompt, the path recap, the chosen and
 * discarded states, the story boot log) read in the story's own language
 * rather than in the interface's. Stories tag their language by its
 * self-name ("English", "Français"), matched against each locale's
 * {@link m.language_self_name}. Falls back to the interface locale when the
 * language has no translation.
 *
 * @param language - The story's language label.
 * @returns The locale to print the story's strings in.
 * @author Claude
 */
export const storyLocale = ( language: string ): StoryLocale =>
{
    const match = locales.find( ( locale ) => m.language_self_name( {}, { locale } ) === language );

    return match ?? getLocale();
};
