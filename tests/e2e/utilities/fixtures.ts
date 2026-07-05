import type { Page } from "@playwright/test";

/**
 * Navigates to the app and clears any persisted state (saves, discovered
 * endings, AI settings) so each test starts from a clean slate.
 *
 * @param page - The Playwright page to prepare.
 * @param path - Optional path/query string to load instead of the root.
 * @author Claude
 */
export const gotoFresh = async ( page: Page, path = "/" ): Promise<void> =>
{
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
