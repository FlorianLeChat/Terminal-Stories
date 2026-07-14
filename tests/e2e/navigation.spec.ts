import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

const STORY_ID = "cursed-forest";

interface AccessPoint {
    /** Human-readable name of the view, used in the generated test title. */
    name: string;
    /** Navigates from the main menu into the view under test. */
    open: ( page: Page ) => Promise<void>;
    /** Text unique to the opened view, asserted before pressing ESC. */
    openedText: string;
}

/**
 * Every full-screen view reachable from the main menu through a single
 * keyboard shortcut, and left the same way: a single ESC press lands back on
 * the main menu. Grouped here so the shared "open, then ESC back" behavior is
 * verified once per view instead of being duplicated across each view's own
 * spec file.
 */
const accessPoints: AccessPoint[] = [
    {
        name: "the encyclopedia with [W]",
        open: async ( page ) =>
        {
            await gotoMenu( page );
            await page.keyboard.press( "w" );
        },
        openedText: "KNOWLEDGE BASE"
    },
    {
        name: "the achievements screen with [A]",
        open: async ( page ) =>
        {
            await gotoMenu( page );
            await page.keyboard.press( "a" );
        },
        openedText: "ACHIEVEMENTS"
    },
    {
        name: "the AI story generator with [I]",
        open: async ( page ) =>
        {
            await gotoMenu( page );
            await page.keyboard.press( "i" );
        },
        openedText: "AI GENERATOR"
    },
    {
        name: "the custom stories screen with [E]",
        open: async ( page ) =>
        {
            await gotoMenu( page );
            await page.keyboard.press( "e" );
        },
        openedText: "MY STORIES"
    },
    {
        name: "a story with [ENTER]",
        open: async ( page ) =>
        {
            await gotoMenu( page, `/?story=${ STORY_ID }` );
            await page.keyboard.press( "Enter" );
        },
        openedText: "NOW READING"
    }
];

test.describe( "Returning to the main menu with ESC", () =>
{
    for ( const { name, open, openedText } of accessPoints )
    {
        test( `opens ${ name } and returns to the main menu with ESC`, async ( { page } ) =>
        {
            await open( page );
            await expect( page.getByText( openedText, { exact: true } ) ).toBeVisible();

            await page.keyboard.press( "Escape" );
            await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
        } );
    }
} );
