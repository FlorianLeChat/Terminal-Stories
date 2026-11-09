import { writable } from "svelte/store";

/** User display preferences, persisted across sessions. */
export interface DisplaySettings {
    /** Whether the CRT scanline overlay is drawn over the monitor. */
    scanlines: boolean;
    /** Whether the reader closed the first-launch tip on the menu. */
    welcomeDismissed: boolean;
}

const SETTINGS_KEY = "terminal-stories:display-settings";

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = { scanlines: true, welcomeDismissed: false };

/**
 * Reads the persisted display settings, falling back to the defaults when
 * nothing (or something unreadable) is stored, or during SSR.
 *
 * @returns The current display settings.
 * @author Claude
 */
const loadDisplaySettings = (): DisplaySettings =>
{
    if ( globalThis.window === undefined ) return { ...DEFAULT_DISPLAY_SETTINGS };

    const raw = localStorage.getItem( SETTINGS_KEY );
    if ( !raw ) return { ...DEFAULT_DISPLAY_SETTINGS };

    try
    {
        const parsed = JSON.parse( raw ) as Partial<DisplaySettings>;
        const hasScanlinesFlag = typeof parsed.scanlines === "boolean";
        const hasWelcomeFlag = typeof parsed.welcomeDismissed === "boolean";

        return {
            scanlines: hasScanlinesFlag ? parsed.scanlines as boolean : DEFAULT_DISPLAY_SETTINGS.scanlines,
            welcomeDismissed: hasWelcomeFlag ? parsed.welcomeDismissed as boolean : DEFAULT_DISPLAY_SETTINGS.welcomeDismissed
        };
    }
    catch
    {
        return { ...DEFAULT_DISPLAY_SETTINGS };
    }
};

/**
 * Builds the display store, seeded from the persisted preferences.
 *
 * @returns The display store: a readable of {@link DisplaySettings} plus actions.
 * @author Claude
 */
const createDisplayStore = () =>
{
    const { subscribe, update } = writable<DisplaySettings>( loadDisplaySettings() );

    /**
     * Applies a change to the settings and persists the result.
     *
     * @param change - Builds the next settings from the current ones.
     * @author Claude
     */
    const persist = ( change: ( s: DisplaySettings ) => DisplaySettings ): void =>
    {
        update( ( s ) =>
        {
            const next = change( s );

            if ( globalThis.window !== undefined ) localStorage.setItem( SETTINGS_KEY, JSON.stringify( next ) );

            return next;
        } );
    };

    /**
     * Toggles the scanline overlay and persists the choice.
     *
     * @author Claude
     */
    const toggleScanlines = (): void =>
    {
        persist( ( s ) => ( { ...s, scanlines: !s.scanlines } ) );
    };

    /**
     * Closes the first-launch tip of the menu for good.
     *
     * @author Claude
     */
    const dismissWelcome = (): void =>
    {
        persist( ( s ) => ( { ...s, welcomeDismissed: true } ) );
    };

    return { subscribe, toggleScanlines, dismissWelcome };
};

export const display = createDisplayStore();
