/**
 * Splits a percentage into filled / empty block counts for a progress bar.
 * Both parts use the same `█` glyph so every block is identical width.
 *
 * @param percent - Value between 0 and 100.
 * @param total - Total number of blocks.
 * @returns An object with the two repeated strings.
 * @author Claude
 */
export const buildProgressBar = ( percent: number, total = 10 ): { filled: string; empty: string } =>
{
    const filledCount = Math.round( ( percent / 100 ) * total );

    return {
        filled: "█".repeat( filledCount ),
        empty: "█".repeat( total - filledCount )
    };
};
