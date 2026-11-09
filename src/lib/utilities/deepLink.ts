import { getEntry, getStory } from "#lib";
import type { ReadonlyURLSearchParams } from "$app/state";

/**
 * A shareable location within the app that maps to a URL: either a story
 * (its info/playback screen) or a single wiki entry.
 */
export type DeepLinkTarget = { type: "story"; id: string } | { type: "wiki"; id: string };

const STORY_PARAM = "story";
const WIKI_PARAM = "wiki";

/**
 * Reads a deep-link target from a URL's query string, validating the id against
 * the available catalog. Returns `null` when no valid target is present; see
 * {@link deepLinkError} to tell an absent link from an unknown id.
 *
 * @param params - The URL search params to inspect.
 * @returns The referenced story or wiki target, or `null` when none is valid.
 * @author Claude
 */
export const parseDeepLink = ( params: ReadonlyURLSearchParams ): DeepLinkTarget | null =>
{
    const storyId = params.get( STORY_PARAM );

    if ( storyId && getStory( storyId ) )
    {
        return { type: "story", id: storyId };
    }

    const wikiId = params.get( WIKI_PARAM );

    if ( wikiId && getEntry( wikiId ) )
    {
        return { type: "wiki", id: wikiId };
    }

    return null;
};

/**
 * Machine-readable reasons a deep link could not be honoured. The UI maps
 * them to translated messages.
 */
export type DeepLinkErrorCode = "unknown_story" | "unknown_wiki";

/**
 * Tells why a URL carrying a deep-link parameter could not be resolved, so
 * the UI can explain the fallback instead of silently showing the menu.
 *
 * @param params - The URL search params to inspect.
 * @returns The failure code, or `null` when the link is valid or absent.
 * @author Claude
 */
export const deepLinkError = ( params: ReadonlyURLSearchParams ): DeepLinkErrorCode | null =>
{
    const hasValidTarget = parseDeepLink( params ) !== null;
    if ( hasValidTarget ) return null;

    if ( params.has( STORY_PARAM ) ) return "unknown_story";
    if ( params.has( WIKI_PARAM ) ) return "unknown_wiki";

    return null;
};

/**
 * Serializes a deep-link target into a query string suitable for the address
 * bar (e.g. `?story=the-golden-woman`). An empty string is returned for `null`,
 * matching `URL.search` when no query is present.
 *
 * @param target - The target to encode, or `null` for the default view.
 * @returns The query string (with leading `?`), or an empty string.
 * @author Claude
 */
export const deepLinkSearch = ( target: DeepLinkTarget | null ): "" | `?${ string }` =>
{
    if ( !target ) return "";

    const key = target.type === "story" ? STORY_PARAM : WIKI_PARAM;
    const params = new URLSearchParams();
    params.set( key, target.id );

    return `?${ params.toString() }`;
};
