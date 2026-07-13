import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";
import { findPathToEnding, findAllEndingPaths } from "./utilities/storyPath";

const STORY_ID = "cursed-forest";

const MODELS_URL = "https://api.anthropic.com/v1/models*";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MOCK_MODEL = { id: "claude-mock-1", display_name: "Claude Mock 1", created_at: "2026-01-01T00:00:00Z" };
const MOCK_STORY = {
    title: "The Mocked Path",
    genre: "mystery",
    language: "English",
    universe: "Test Universe",
    description: "A story generated for testing.",
    tags: [ "test" ],
    characters: [],
    startScene: "start",
    scenes: [
        {
            id: "start",
            text: [ "You wake up in a mocked room." ],
            choices: [ { id: "c1", text: "Open the door", action: "You open it.", consequence: "Light floods in.", nextScene: "end" } ]
        },
        { id: "end", text: [ "The story ends here." ], isEnding: true, choices: [] }
    ]
};

/**
 * Locates the currently-active button for a numbered choice (`[1] ...`). The
 * terminal keeps its whole scrollback, so `.last()` targets the live scene.
 *
 * @param page - The page currently on the story view.
 * @param choiceIndex - The 1-based choice index as displayed.
 * @returns A locator for the matching choice button.
 * @author Claude
 */
const choiceButton = ( page: Page, choiceIndex: number ) =>
    page.getByRole( "button", { name: new RegExp( `^\\s*\\[${ choiceIndex }\\]` ) } ).last();

/**
 * Locates the achievement card carrying the given heading, so its status badge
 * can be asserted independently of the other cards.
 *
 * @param page - The page currently on the achievements view.
 * @param name - The achievement's displayed name.
 * @returns A locator for the matching card article.
 * @author Claude
 */
const achievementCard = ( page: Page, name: string ) =>
    page.locator( "article" ).filter( { has: page.getByRole( "heading", { name } ) } );

/**
 * Plays a full choice path to its ending, flushing the typewriter before each
 * click so the test never races the animation.
 *
 * @param page - The page currently on the story view.
 * @param path - The ordered 1-based choice indices to take.
 * @author Claude
 */
const playPath = async ( page: Page, path: number[] ): Promise<void> =>
{
    for ( const choiceIndex of path )
    {
        await page.keyboard.press( " " );
        await choiceButton( page, choiceIndex ).click();
    }

    await page.keyboard.press( " " );
};

test.describe( "Achievements", () =>
{
    test( "opens from the menu button and lists locked and secret achievements", async ( { page } ) =>
    {
        await gotoMenu( page );
        await page.getByRole( "button", { name: "✦ [A] Achievements" } ).click();

        await expect( page.getByText( "ACHIEVEMENTS" ) ).toBeVisible();
        await expect( page.getByText( "0 / 7 unlocked" ) ).toBeVisible();

        // A regular achievement shows its real name and a Locked badge.
        await expect( achievementCard( page, "First Steps" ).getByText( "Locked", { exact: true } ) ).toBeVisible();

        // Secret achievements stay masked until unlocked.
        await expect( page.getByRole( "heading", { name: "? ? ?" } ).first() ).toBeVisible();
        await expect( page.getByRole( "heading", { name: "Great Explorer" } ) ).toHaveCount( 0 );
    } );

    test( "opens with the A key and returns to the menu with ESC", async ( { page } ) =>
    {
        await gotoMenu( page );

        await page.keyboard.press( "a" );
        await expect( page.getByText( "ACHIEVEMENTS" ) ).toBeVisible();

        await page.keyboard.press( "Escape" );
        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
    } );

    test( "completing a story for the first time unlocks First Steps", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );
        await playPath( page, path );

        // Leave to the menu, then open the achievements screen.
        await page.keyboard.press( "Escape" );
        await page.keyboard.press( "a" );

        await expect( achievementCard( page, "First Steps" ).getByText( "Unlocked", { exact: true } ) ).toBeVisible();
    } );

    test( "shows an unlock notification when reaching an ending", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );
        await playPath( page, path );

        // The toast is a status region naming the achievement just unlocked; it
        // sits on the story view before the player leaves to the menu.
        const toast = page.getByRole( "status" );
        await expect( toast ).toBeVisible();
        await expect( toast.getByText( /Achievements? unlocked/ ) ).toBeVisible();
        await expect( toast.getByText( "First Steps" ) ).toBeVisible();
    } );

    test( "discovering every ending of a story unlocks No Stone Unturned", async ( { page } ) =>
    {
        const paths = findAllEndingPaths( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.keyboard.press( "Enter" );

        for ( let i = 0; i < paths.length; i++ )
        {
            await playPath( page, paths[ i ] );

            const isLastPath = i === paths.length - 1;

            // Restart from the ending to hunt the next one; the last ending stays
            // on screen so we can leave to the menu afterwards.
            if ( !isLastPath )
            {
                await page.getByRole( "button", { name: "[ENTER] Restart" } ).click();
            }
        }

        await page.keyboard.press( "Escape" );
        await page.keyboard.press( "a" );

        await expect( achievementCard( page, "No Stone Unturned" ).getByText( "Unlocked", { exact: true } ) ).toBeVisible();
    } );

    test( "AI-generated stories never award achievements", async ( { page } ) =>
    {
        await page.route( MODELS_URL, ( route ) =>
            route.fulfill( { status: 200, contentType: "application/json", body: JSON.stringify( { data: [ MOCK_MODEL ] } ) } ) );
        await page.route( MESSAGES_URL, ( route ) =>
            route.fulfill( {
                status: 200,
                contentType: "application/json",
                body: JSON.stringify( { content: [ { type: "text", text: JSON.stringify( MOCK_STORY ) } ] } )
            } ) );

        await gotoMenu( page );
        await page.getByRole( "button", { name: "✦ [I] AI story" } ).click();

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-valid" );
        await page.getByRole( "button", { name: "Validate" } ).click();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByRole( "button", { name: "Generate story" } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // Reach the generated story's ending, then leave to the menu.
        await page.keyboard.press( " " );
        await choiceButton( page, 1 ).click();
        await page.keyboard.press( " " );
        await page.keyboard.press( "Escape" );

        await page.keyboard.press( "a" );
        await expect( page.getByText( "ACHIEVEMENTS" ) ).toBeVisible();
        await expect( page.getByText( "0 / 7 unlocked" ) ).toBeVisible();
        await expect( achievementCard( page, "First Steps" ).getByText( "Locked", { exact: true } ) ).toBeVisible();
    } );
} );
