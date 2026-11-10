/** A color scheme the monitor is actually drawn in. */
export type ColorScheme = "dark" | "light";

/** The reader's theme choice: follow the browser, or force one scheme. */
export const THEME_PREFERENCES = [ "system", "light", "dark" ] as const;

/** A theme choice as stored in the display settings. */
export type ThemePreference = ( typeof THEME_PREFERENCES )[ number ];

/** Browser chrome color (`theme-color`) per scheme, matching each page background. */
const THEME_COLORS: Record<ColorScheme, string> = {
    dark: "#000000",
    light: "#e2d3b0"
};

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/**
 * Checks whether a stored value is a known theme preference.
 *
 * @param value - Any value read back from storage.
 * @returns True when the value is one of {@link THEME_PREFERENCES}.
 * @author Claude
 */
export const isThemePreference = ( value: unknown ): value is ThemePreference =>
{
    return THEME_PREFERENCES.includes( value as ThemePreference );
};

/**
 * Gives the preference that follows another one in the toggle cycle
 * (system, then light, then dark, then back to system).
 *
 * @param preference - The current preference.
 * @returns The next preference.
 * @author Claude
 */
export const nextThemePreference = ( preference: ThemePreference ): ThemePreference =>
{
    const nextIndex = ( THEME_PREFERENCES.indexOf( preference ) + 1 ) % THEME_PREFERENCES.length;

    return THEME_PREFERENCES[ nextIndex ];
};

/**
 * Resolves the scheme to draw from the reader's preference and the browser's.
 *
 * @param preference - The reader's stored preference.
 * @param prefersLight - Whether the browser asks for a light scheme.
 * @returns The scheme to apply.
 * @author Claude
 */
export const resolveColorScheme = ( preference: ThemePreference, prefersLight: boolean ): ColorScheme =>
{
    const followsBrowser = preference === "system";

    if ( followsBrowser ) return prefersLight ? "light" : "dark";

    return preference;
};

/**
 * Applies a scheme to the document: `data-theme` on `<html>` (read by the
 * color roles in `app.css`) and the browser chrome color.
 *
 * @param scheme - The scheme to apply.
 * @author Claude
 */
const applyColorScheme = ( scheme: ColorScheme ): void =>
{
    document.documentElement.dataset.theme = scheme;

    document.querySelector( "meta[name=\"theme-color\"]" )?.setAttribute( "content", THEME_COLORS[ scheme ] );
};

/**
 * Applies the scheme resolved from a preference, and keeps following the
 * browser's own setting while the preference is `system`.
 *
 * @param preference - The reader's stored preference.
 * @returns A cleanup that stops listening to the browser's setting.
 * @author Claude
 */
export const watchColorScheme = ( preference: ThemePreference ): ( () => void ) =>
{
    const query = window.matchMedia( LIGHT_QUERY );

    const update = (): void =>
    {
        applyColorScheme( resolveColorScheme( preference, query.matches ) );
    };

    update();
    query.addEventListener( "change", update );

    return () => query.removeEventListener( "change", update );
};
