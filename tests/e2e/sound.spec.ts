import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

const STORAGE_KEY = "terminal-stories:sound-settings";

/**
 * Reads the persisted sound settings straight from localStorage.
 *
 * @param page - The Playwright page.
 * @returns The parsed settings, or null when nothing is stored yet.
 * @author Claude
 */
const readSoundSettings = async ( page: Page ): Promise<{ enabled: boolean; volume: number } | null> =>
{
    const raw = await page.evaluate( ( key ) => localStorage.getItem( key ), STORAGE_KEY );
    if ( !raw ) return null;

    return JSON.parse( raw );
};

test.describe( "sound controls", () =>
{
    test( "sound is muted by default, with a disabled volume slider", async ( { page } ) =>
    {
        await gotoMenu( page );

        // The action label reads "Enable sound" while muted.
        const toggle = page.getByRole( "button", { name: "Enable sound" } );
        await expect( toggle ).toBeVisible();
        await expect( toggle ).toHaveAttribute( "aria-pressed", "false" );

        const volume = page.getByRole( "slider", { name: "Sound volume" } );
        await expect( volume ).toBeDisabled();
    } );

    test( "clicking the toggle enables sound and persists the choice", async ( { page } ) =>
    {
        await gotoMenu( page );

        await page.getByRole( "button", { name: "Enable sound" } ).click();

        // Once enabled, the button offers the opposite action and the slider unlocks.
        const toggle = page.getByRole( "button", { name: "Mute sound" } );
        await expect( toggle ).toHaveAttribute( "aria-pressed", "true" );
        await expect( page.getByRole( "slider", { name: "Sound volume" } ) ).toBeEnabled();

        const settings = await readSoundSettings( page );
        expect( settings?.enabled ).toBe( true );
    } );

    test( "the enabled state survives a reload", async ( { page } ) =>
    {
        await gotoMenu( page );
        await page.getByRole( "button", { name: "Enable sound" } ).click();

        await page.reload();

        // After reload the store rehydrates from localStorage, so sound stays on.
        await expect( page.getByRole( "button", { name: "Mute sound" } ) ).toBeVisible();
    } );

    test( "the M shortcut toggles sound on and off", async ( { page } ) =>
    {
        await gotoMenu( page );

        await page.keyboard.press( "m" );
        await expect( page.getByRole( "button", { name: "Mute sound" } ) ).toBeVisible();

        await page.keyboard.press( "m" );
        await expect( page.getByRole( "button", { name: "Enable sound" } ) ).toBeVisible();
    } );
} );
