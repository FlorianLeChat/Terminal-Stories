import { test, expect } from "@playwright/test";
import { findPathToEnding } from "./utilities/storyPath";
import { choiceButton, playPath, skipTypewriter } from "./utilities/story";
import { gotoMenu, leaveToMenu, openStoryShare } from "./utilities/fixtures";

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

        // A fantasy story keeps the system green; investigations get their own phosphor.
        await expect( page.locator( "main" ) ).toHaveAttribute( "data-phosphor", "green" );

        // The info screen tallies the endings and links to the encyclopedia.
        await expect( page.getByText( /^0 \/ \d+ found$/ ) ).toBeVisible();
        await expect( page.getByRole( "link", { name: "The Traveler" } ) ).toBeVisible();

        await page.getByRole( "link", { name: "Kingdom of Elarion, in the encyclopedia" } ).click();
        await expect( page.getByText( "ENCYCLOPEDIA", { exact: true } ) ).toBeVisible();
        await expect( page ).toHaveURL( /\?wiki=[^&]+$/ );

        await gotoMenu( page, "/?story=last-call" );
        await expect( page.locator( "main" ) ).toHaveAttribute( "data-phosphor", "amber" );
    } );

    test( "starts the story and renders the opening scene with choices", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        await skipTypewriter( page );
        await expect( page.getByText( "> What will you do?" ) ).toBeVisible();
        await expect( choiceButton( page, 1 ) ).toBeVisible();

        // A number key picks, focuses the next first choice, and marks the pick as chosen.
        await page.keyboard.press( "1" );
        await expect( choiceButton( page, 1 ) ).toBeFocused();
        await expect( page.getByRole( "button", { name: /\(chosen\)$/ } ) ).toHaveCount( 1 );
    } );

    test( "shares the story through a QR overlay, opened and closed either way", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        await page.keyboard.press( "s" );

        const dialog = page.getByRole( "dialog" );
        await expect( dialog ).toBeVisible();
        await expect( dialog.getByRole( "heading", { name: "Share this story" } ) ).toBeVisible();

        // The QR image and the raw deep link both point at this story.
        await expect( dialog.getByRole( "img", { name: "QR code linking to this story" } ) ).toBeVisible();
        await expect( dialog.getByText( new RegExp( `\\?story=${ STORY_ID }` ) ) ).toBeVisible();

        await expect( dialog.getByText( /saved on this device only/ ) ).toBeVisible();

        // ESC dismisses the overlay only: the story is still on screen.
        await page.keyboard.press( "Escape" );
        await expect( dialog ).not.toBeVisible();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // The share button reopens it, and the dialog's own close control works.
        await openStoryShare( page );
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

        // Played choices stay in the log, mark the pick, and are disabled.
        const output = page.getByRole( "log", { name: "Terminal output" } );
        await expect( output.getByRole( "listitem" ).first() ).toBeVisible();
        await expect( output.getByRole( "button", { disabled: false } ) ).toHaveCount( 0 );
        await expect( output.getByRole( "button", { name: /\(chosen\)$/ } ) ).toHaveCount( path.length );

        // The ending recaps the path taken: one entry per choice made.
        const recap = output.getByRole( "region", { name: /PATH TAKEN/ } );
        await expect( recap ).toBeVisible();
        await expect( recap.getByText( /^Choice \d+:$/ ) ).toHaveCount( path.length );

        // The discovery notice is a toast (status region), not inline text.
        const toast = page.getByRole( "status" ).filter( { hasText: /(New ending|Every ending) found/ } );
        await expect( toast ).toBeVisible();
    } );

    test( "restarting from an ending replays the story from the start", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        // playPath blurs at the end, so the last pick is clicked by hand to watch focus.
        await playPath( page, path.slice( 0, -1 ) );
        await choiceButton( page, path[ path.length - 1 ] ).click();

        // The next move is to restart: the focus waits there.
        const restart = page.getByRole( "button", { name: "Restart", exact: true } );
        await expect( restart ).toBeFocused();
        await restart.click();

        await skipTypewriter( page );
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "an ending is recorded the moment it is reached, and closes the save", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await playPath( page, path );
        await expect( page.getByRole( "button", { name: "Restart", exact: true } ) ).toBeVisible();

        // A reload at the ending keeps it and offers Start, not Resume.
        await page.reload();
        await expect( page.getByText( /^1 \/ \d+ found$/ ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Start", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Resume", exact: true } ) ).toHaveCount( 0 );
    } );

    test( "every automatic save is confirmed in the status bar", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await skipTypewriter( page );
        await choiceButton( page, 1 ).click();

        await expect( page.getByRole( "status" ).filter( { hasText: "SAVED" } ) ).toBeAttached();
    } );

    test( "a story's own strings follow its language, not the interface's", async ( { page } ) =>
    {
        await gotoMenu( page, "/?story=l-affaire-du-raton-laveur" );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await skipTypewriter( page );

        await expect( page.getByText( "> Que fais-tu ?" ) ).toBeVisible();
        await expect( page.getByRole( "log", { name: "Terminal output" } ) ).toHaveAttribute( "lang", "fr" );
    } );

    test( "the slash key does not leave a story being read", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await skipTypewriter( page );

        await page.keyboard.press( "/" );
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
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

        await expect( page.getByText( "SAVE FOUND" ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Resume", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "New game", exact: true } ) ).toBeVisible();

        // Resuming recaps the last scene played before the current one.
        await page.getByRole( "button", { name: "Resume", exact: true } ).click();
        await expect( page.getByText( "Last scene played:" ) ).toBeVisible();
        await skipTypewriter( page );
        await expect( choiceButton( page, 1 ) ).toBeVisible();
    } );

    test( "starting a new game over a save asks first, then discards it", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await skipTypewriter( page );
        await choiceButton( page, 1 ).click();
        await leaveToMenu( page );

        await page.goto( `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "New game", exact: true } ).click();

        // Backing out of the confirmation keeps the save and the info screen.
        const dialog = page.getByRole( "dialog", { name: "Start over from the beginning?" } );
        await expect( dialog ).toBeVisible();
        await dialog.getByRole( "button", { name: "Keep my save" } ).click();
        await expect( dialog ).not.toBeVisible();
        await expect( page.getByText( "SAVE FOUND" ) ).toBeVisible();

        await page.getByRole( "button", { name: "New game", exact: true } ).click();
        await dialog.getByRole( "button", { name: "Erase and start over" } ).click();

        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
        await leaveToMenu( page );

        await page.goto( `/?story=${ STORY_ID }` );
        await expect( page.getByText( "SAVE FOUND" ) ).not.toBeVisible();
    } );
} );
