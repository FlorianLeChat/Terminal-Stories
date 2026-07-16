const MAX_DISPLAY_QUERY_LENGTH = 40;

/**
 * Truncates a search query for display, so an arbitrarily long input
 * (e.g. a user pasting or mashing the keyboard) can't overflow the
 * result-count and empty-state messages that echo it back.
 *
 * @param query - The raw search query typed by the user.
 * @returns The query, cut down to {@link MAX_DISPLAY_QUERY_LENGTH} characters with a trailing ellipsis when it was longer.
 * @author Claude
 */
export const truncateQueryForDisplay = ( query: string ): string =>
{
    const isTooLong = query.length > MAX_DISPLAY_QUERY_LENGTH;

    return isTooLong ? `${ query.slice( 0, MAX_DISPLAY_QUERY_LENGTH ) }...` : query;
};
