import type { Page } from "@playwright/test";

/**
 * Navigates to the app and clears any persisted state (saves, discovered
 * endings, AI settings) so each test starts from a clean slate.
 *
 * Reduced motion is emulated before the first navigation: the app reads
 * `prefers-reduced-motion` to skip the boot sequence delays and the
 * character-by-character typewriter effect, which keeps test runs fast.
 * This is done here (not via `use.reducedMotion` in `playwright.config.ts`)
 * because that config option is not honored by the current runner version —
 * only `page.emulateMedia` reliably applies the emulation. The setting
 * persists for the page's lifetime, so later in-test navigations inherit it.
 *
 * @param page - The Playwright page to prepare.
 * @param path - Optional path/query string to load instead of the root.
 * @author Claude
 */
export const gotoFresh = async ( page: Page, path = "/" ): Promise<void> =>
{
    await page.emulateMedia( { reducedMotion: "reduce" } );
    await page.goto( path );
    await page.evaluate( () => localStorage.clear() );
    await page.goto( path );
};

/**
 * Waits for the boot sequence to finish, then advances to the main menu (or
 * to whatever deep-linked view the current URL resolves to).
 *
 * @param page - The Playwright page currently on the boot screen.
 * @author Claude
 */
export const skipBoot = async ( page: Page ): Promise<void> =>
{
    await page.getByText( "Press ENTER to begin." ).waitFor();
    await page.keyboard.press( "Enter" );
};

/**
 * Loads the app, clears persisted state, and skips straight past the boot
 * screen — the common starting point for most feature tests.
 *
 * @param page - The Playwright page to prepare.
 * @param path - Optional path/query string to load instead of the root.
 * @author Claude
 */
export const gotoMenu = async ( page: Page, path = "/" ): Promise<void> =>
{
    await gotoFresh( page, path );
    await skipBoot( page );
};
