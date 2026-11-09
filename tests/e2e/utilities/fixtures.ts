import type { Page } from "@playwright/test";

/**
 * Navigates to the app and clears any persisted state (saves, discovered
 * endings, AI settings) so each test starts from a clean slate.
 *
 * Reduced motion is emulated before the first navigation: the app reads
 * `prefers-reduced-motion` to skip the boot sequence delays and the
 * character-by-character typewriter effect, which keeps test runs fast.
 * `use.reducedMotion` in `playwright.config.ts` is not honored by the runner,
 * so `page.emulateMedia` applies it instead. The setting persists for the
 * page's lifetime, so later in-test navigations inherit it.
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
 * to whatever deep-linked view the current URL resolves to). The prompt reads
 * "Press ENTER" or "Tap the screen" by viewport; ENTER works on both.
 *
 * @param page - The Playwright page currently on the boot screen.
 * @author Claude
 */
export const skipBoot = async ( page: Page ): Promise<void> =>
{
    await page.getByText( /^(Press ENTER|Tap the screen) to begin\.$/ ).waitFor();
    await page.keyboard.press( "Enter" );
};

/**
 * Reports whether a path is a shared link (`?story=` or `?wiki=`), which the
 * app opens directly, without the boot screen.
 *
 * @param path - The path/query string loaded.
 * @returns True when the app skips its boot for this path.
 * @author Claude
 */
export const isSharedLink = ( path: string ): boolean =>
{
    return /[?&](story|wiki)=/.test( path );
};

/**
 * Loads the app, clears persisted state, and gets past the boot screen: the
 * common starting point for most feature tests. A shared link skips the boot
 * on its own, so the helper waits instead for its target view (or the menu
 * explaining a dead link); the regex allows the whitespace the status bar
 * renders around its view name.
 *
 * @param page - The Playwright page to prepare.
 * @param path - Optional path/query string to load instead of the root.
 * @author Claude
 */
export const gotoMenu = async ( page: Page, path = "/" ): Promise<void> =>
{
    await gotoFresh( page, path );

    if ( !isSharedLink( path ) )
    {
        await skipBoot( page );
        return;
    }

    await page.getByText( /^\s*(STORY INFO|ENCYCLOPEDIA|— INTERACTIVE STORIES SYSTEM —)\s*$/ ).first().waitFor();
};

/**
 * Reports whether the viewport is below Tailwind's `sm` breakpoint, where the
 * footer shows the compact page-navigation buttons rather than the full
 * keyboard-shortcut legend.
 *
 * @param page - The Playwright page to inspect.
 * @returns True when the viewport width is under 640px.
 * @author Claude
 */
const isNarrowViewport = ( page: Page ): boolean =>
{
    const size = page.viewportSize();

    return size !== null && size.width < 640;
};

/**
 * Clicks a footer/navigation control by the label it carries on the current
 * viewport: the compact button on narrow screens, the "[KEY] ..." legend entry
 * on wide ones. Lets specs drive navigation by button (not keyboard) while
 * staying correct on both the desktop and mobile projects.
 *
 * @param page - The Playwright page to drive.
 * @param wideLabel - The exact button label shown from the `sm` breakpoint up.
 * @param narrowLabel - The exact button label shown below the `sm` breakpoint.
 * @returns A promise that resolves once the control has been clicked.
 * @author Claude
 */
const clickNavControl = ( page: Page, wideLabel: string, narrowLabel: string ): Promise<void> =>
{
    const label = isNarrowViewport( page ) ? narrowLabel : wideLabel;

    return page.getByRole( "button", { name: label, exact: true } ).click();
};

/**
 * Opens the encyclopedia from the main menu by its navigation button.
 *
 * @param page - The Playwright page, currently on the main menu.
 * @returns A promise that resolves once the encyclopedia is opening.
 * @author Claude
 */
export const openEncyclopedia = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[W] Encyclopedia", "Encyclopedia" );

/**
 * Opens the achievements screen from the main menu by its navigation button.
 *
 * @param page - The Playwright page, currently on the main menu.
 * @returns A promise that resolves once the achievements screen is opening.
 * @author Claude
 */
export const openAchievements = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[A] Achievements", "Achievements" );

/**
 * Opens the AI story generator from the main menu by its navigation button.
 *
 * @param page - The Playwright page, currently on the main menu.
 * @returns A promise that resolves once the AI generator is opening.
 * @author Claude
 */
export const openAiGenerator = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[I] AI", "AI" );

/**
 * Opens the "my stories" screen from the main menu by its navigation button.
 *
 * @param page - The Playwright page, currently on the main menu.
 * @returns A promise that resolves once the "my stories" screen is opening.
 * @author Claude
 */
export const openMyStories = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[E] My stories", "My stories" );

/**
 * Returns to the main menu from any full-screen view by its back button.
 *
 * @param page - The Playwright page, currently on a view opened from the menu.
 * @returns A promise that resolves once the menu is being restored.
 * @author Claude
 */
export const leaveToMenu = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[ESC] Main menu", "Main menu" );

/**
 * Opens the share dialog of the story being read by its button. On wide
 * screens it sits on the action bar while a scene types or at an ending, and
 * in the footer legend ("[S] Share") while choices wait; on phones it is
 * behind the "More actions" menu.
 *
 * @param page - The Playwright page, currently reading a catalog story.
 * @returns A promise that resolves once the share button has been clicked.
 * @author Claude
 */
export const openStoryShare = async ( page: Page ): Promise<void> =>
{
    if ( isNarrowViewport( page ) ) await page.getByRole( "button", { name: "More actions", exact: true } ).click();

    await page.getByRole( "button", { name: /^(\[S\] )?Share$/ } ).click();
};

/**
 * Returns from an open wiki entry to the entry list by its back button.
 *
 * @param page - The Playwright page, currently on a wiki entry detail.
 * @returns A promise that resolves once the entry list is being restored.
 * @author Claude
 */
export const backToWikiList = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[ESC] Back to list", "Back to list" );

/**
 * Returns from the story editor to the "my stories" screen by its back button.
 *
 * @param page - The Playwright page, currently in the editor.
 * @returns A promise that resolves once the "my stories" screen is being restored.
 * @author Claude
 */
export const backToMyStories = ( page: Page ): Promise<void> =>
    clickNavControl( page, "[ESC] My stories", "Back to my stories" );
