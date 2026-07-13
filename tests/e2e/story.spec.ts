import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu, skipBoot } from "./utilities/fixtures";
import { findPathToEnding } from "./utilities/storyPath";

const STORY_ID = "cursed-forest";
const STORY_TITLE = "The Cursed Forest";

/**
 * Locates the button for a numbered choice (e.g. `[1] ...`). The terminal
 * keeps its whole scrollback on screen, so earlier scenes may still show a
 * button with the same index — `.last()` always targets the current scene's.
 *
 * @param page - The page currently on the story view.
 * @param choiceIndex - The 1-based choice index as displayed.
 * @returns A locator for the matching, currently-active choice button.
 * @author Claude
 */
const choiceButton = ( page: Page, choiceIndex: number ) =>
    page.getByRole( "button", { name: new RegExp( `^\\s*\\[${ choiceIndex }\\]` ) } ).last();

test.describe( "Story playback", () =>
{
    test( "shows the story-info screen with a start prompt for a fresh story", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
        await expect( page.getByText( STORY_TITLE ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[ENTER] Start" } ) ).toBeVisible();
    } );

    test( "starts the story and renders the opening scene with choices", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // Flush the typewriter so the choice buttons are all present immediately.
        await page.keyboard.press( " " );
        await expect( page.getByText( "> What will you do?" ) ).toBeVisible();
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "sharing is available from the story-info screen before the story starts", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();

        await page.getByRole( "button", { name: "[S] Share" } ).click();

        const dialog = page.getByRole( "dialog" );
        await expect( dialog ).toBeVisible();
        await expect( dialog.getByRole( "img", { name: "QR code linking to this story" } ) ).toBeVisible();
        await expect( dialog.getByText( new RegExp( `\\?story=${ STORY_ID }` ) ) ).toBeVisible();
    } );

    test( "sharing a story shows a QR overlay with the link and a device-local note", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        await page.getByRole( "button", { name: "[S] Share" } ).click();

        const dialog = page.getByRole( "dialog" );
        await expect( dialog ).toBeVisible();
        await expect( dialog.getByRole( "heading", { name: "Share this story" } ) ).toBeVisible();

        // The QR image and the raw deep link both point at this story.
        await expect( dialog.getByRole( "img", { name: "QR code linking to this story" } ) ).toBeVisible();
        await expect( dialog.getByText( new RegExp( `\\?story=${ STORY_ID }` ) ) ).toBeVisible();

        // The progress-is-local warning is present.
        await expect( dialog.getByText( /saved on this device only/ ) ).toBeVisible();

        await dialog.getByRole( "button", { name: "[ESC] Close" } ).click();
        await expect( dialog ).not.toBeVisible();
    } );

    test( "the S key opens the share overlay and ESC closes it without leaving the story", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        await page.keyboard.press( "s" );
        await expect( page.getByRole( "dialog" ) ).toBeVisible();

        await page.keyboard.press( "Escape" );
        await expect( page.getByRole( "dialog" ) ).not.toBeVisible();

        // ESC dismissed the overlay only — the story is still on screen.
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
    } );

    test( "advances scenes as choices are made and reaches an ending", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );

        for ( const choiceIndex of path )
        {
            // Skip the typewriter before looking for the next choice so the test
            // doesn't depend on animation timing.
            await page.keyboard.press( " " );
            await choiceButton( page, choiceIndex ).click();
        }

        await page.keyboard.press( " " );
        await expect( page.getByRole( "button", { name: "[ENTER] Restart" } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[ESC] Main menu" } ) ).toBeVisible();

        // The discovery congratulation is a toast (status region), not inline text.
        const toast = page.getByRole( "status" ).filter( { hasText: /Congratulations, (all \d+ endings|ending \d+) discovered/ } );
        await expect( toast ).toBeVisible();
    } );

    test( "restarting from an ending replays the story from the start", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );

        for ( const choiceIndex of path )
        {
            await page.keyboard.press( " " );
            await choiceButton( page, choiceIndex ).click();
        }

        await page.keyboard.press( " " );
        await page.getByRole( "button", { name: "[ENTER] Restart" } ).click();

        await page.keyboard.press( " " );
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "returning to the menu mid-story creates a resumable save", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );

        await page.keyboard.press( " " );
        await choiceButton( page, 1 ).click();

        await page.keyboard.press( "Escape" );
        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );

        await expect( page.getByText( "SAVE FOUND" ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[ENTER] Resume" } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[N] New game" } ) ).toBeVisible();
    } );

    test( "starting a new game from the info screen discards the previous save", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );
        await page.keyboard.press( " " );
        await choiceButton( page, 1 ).click();
        await page.keyboard.press( "Escape" );

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );
        await page.getByRole( "button", { name: "[N] New game" } ).click();

        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
        await page.keyboard.press( "Escape" );

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );
        await expect( page.getByText( "SAVE FOUND" ) ).not.toBeVisible();
    } );
} );
