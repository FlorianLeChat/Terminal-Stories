import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

/** Background of the green monitor in the light scheme (`--color-terminal-bg`). */
const LIGHT_MONITOR_BG = "rgb(246, 238, 219)";

/** Background of the green monitor in the dark scheme. */
const DARK_MONITOR_BG = "rgb(5, 14, 5)";

/**
 * Reads the scheme the document is drawn in (`data-theme` on `<html>`).
 *
 * @param page - The Playwright page.
 * @returns The applied scheme, or null when none is set.
 * @author Claude
 */
const appliedScheme = async ( page: Page ): Promise<string | null> =>
{
    return page.evaluate( () => document.documentElement.dataset.theme ?? null );
};

/**
 * Reads the monitor's computed background color.
 *
 * @param page - The Playwright page.
 * @returns The `background-color` of the `<main>` monitor.
 * @author Claude
 */
const monitorBackground = async ( page: Page ): Promise<string> =>
{
    return page.locator( "main" ).evaluate( ( element ) => getComputedStyle( element ).backgroundColor );
};

test.describe( "theme", () =>
{
    test( "follows the browser's color scheme until the reader picks one", async ( { page } ) =>
    {
        await page.emulateMedia( { colorScheme: "light" } );
        await gotoMenu( page );

        await expect( page.getByRole( "button", { name: "Theme: auto" } ) ).toBeVisible();
        expect( await appliedScheme( page ) ).toBe( "light" );
        expect( await monitorBackground( page ) ).toBe( LIGHT_MONITOR_BG );

        await page.emulateMedia( { colorScheme: "dark" } );

        await expect.poll( () => appliedScheme( page ) ).toBe( "dark" );
        expect( await monitorBackground( page ) ).toBe( DARK_MONITOR_BG );
    } );

    test( "the toggle cycles auto, light and dark, and the choice survives a reload", async ( { page } ) =>
    {
        await page.emulateMedia( { colorScheme: "dark" } );
        await gotoMenu( page );

        await page.getByRole( "button", { name: "Theme: auto" } ).click();
        await expect( page.getByRole( "button", { name: "Theme: light" } ) ).toBeVisible();
        expect( await appliedScheme( page ) ).toBe( "light" );

        // A forced scheme ignores the browser's own setting, before and after a reload.
        await page.reload();
        await expect( page.getByRole( "button", { name: "Theme: light" } ) ).toBeVisible();
        expect( await appliedScheme( page ) ).toBe( "light" );

        await page.getByRole( "button", { name: "Theme: light" } ).click();
        await expect( page.getByRole( "button", { name: "Theme: dark" } ) ).toBeVisible();
        expect( await appliedScheme( page ) ).toBe( "dark" );

        await page.getByRole( "button", { name: "Theme: dark" } ).click();
        await expect( page.getByRole( "button", { name: "Theme: auto" } ) ).toBeVisible();
    } );

    test( "the T shortcut switches the theme and is listed in the help", async ( { page } ) =>
    {
        await page.emulateMedia( { colorScheme: "dark" } );
        await gotoMenu( page );

        await page.keyboard.press( "t" );
        await expect( page.getByRole( "button", { name: "Theme: light" } ) ).toBeVisible();
        expect( await appliedScheme( page ) ).toBe( "light" );

        await page.keyboard.press( "?" );
        await expect( page.getByText( "[T] Switch theme (auto, light, dark)" ) ).toBeVisible();
    } );
} );
