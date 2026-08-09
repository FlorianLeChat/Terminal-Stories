import { test, expect } from "@playwright/test";
import { gotoMenu, skipBoot, leaveToMenu } from "./utilities/fixtures";
import { findPathToEnding } from "./utilities/storyPath";
import { choiceButton, playPath, skipTypewriter } from "./utilities/story";

const STORY_ID = "cursed-forest";
const STORY_TITLE = "The Cursed Forest";

test.describe( "Story playback", () =>
{
    test( "shows the story-info screen with a start prompt for a fresh story", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
        await expect( page.getByText( STORY_TITLE ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Start", exact: true } ) ).toBeVisible();
    } );

    test( "starts the story and renders the opening scene with choices", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // Flush the typewriter so the choice buttons are all present immediately.
        await skipTypewriter( page );
        await expect( page.getByText( "> What will you do?" ) ).toBeVisible();
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "shares the story through a QR overlay, opened and closed either way", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // [S] opens the overlay.
        await page.keyboard.press( "s" );

        const dialog = page.getByRole( "dialog" );
        await expect( dialog ).toBeVisible();
        await expect( dialog.getByRole( "heading", { name: "Share this story" } ) ).toBeVisible();

        // The QR image and the raw deep link both point at this story.
        await expect( dialog.getByRole( "img", { name: "QR code linking to this story" } ) ).toBeVisible();
        await expect( dialog.getByText( new RegExp( `\\?story=${ STORY_ID }` ) ) ).toBeVisible();

        // The progress-is-local warning is present.
        await expect( dialog.getByText( /saved on this device only/ ) ).toBeVisible();

        // ESC dismisses the overlay only — the story is still on screen.
        await page.keyboard.press( "Escape" );
        await expect( dialog ).not.toBeVisible();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // The action-bar button opens it again, and its own close control works.
        await page.getByRole( "button", { name: "Share", exact: true } ).click();
        await expect( dialog ).toBeVisible();

        await dialog.getByRole( "button", { name: "[ESC] Close" } ).click();
        await expect( dialog ).not.toBeVisible();
    } );

    test( "advances scenes as choices are made and reaches an ending", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await playPath( page, path );

        await expect( page.getByRole( "button", { name: "Restart", exact: true } ) ).toBeVisible();

        // The discovery congratulation is a toast (status region), not inline text.
        const toast = page.getByRole( "status" ).filter( { hasText: /Congratulations, (all \d+ endings|ending \d+) discovered/ } );
        await expect( toast ).toBeVisible();
    } );

    test( "restarting from an ending replays the story from the start", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await playPath( page, path );

        await page.getByRole( "button", { name: "Restart", exact: true } ).click();

        await skipTypewriter( page );
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "returning to the menu mid-story creates a resumable save", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();

        await skipTypewriter( page );
        await choiceButton( page, 1 ).click();

        await leaveToMenu( page );
        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );

        await expect( page.getByText( "SAVE FOUND" ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Resume", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "New game", exact: true } ) ).toBeVisible();
    } );

    test( "starting a new game from the info screen discards the previous save", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await skipTypewriter( page );
        await choiceButton( page, 1 ).click();
        await leaveToMenu( page );

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );
        await page.getByRole( "button", { name: "New game", exact: true } ).click();

        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
        await leaveToMenu( page );

        await page.goto( `/?story=${ STORY_ID }` );
        await skipBoot( page );
        await expect( page.getByText( "SAVE FOUND" ) ).not.toBeVisible();
    } );
} );
