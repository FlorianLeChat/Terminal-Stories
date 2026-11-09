import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { choiceButton, playPath, skipTypewriter } from "./utilities/story";
import { findPathToEnding, findAllEndingPaths } from "./utilities/storyPath";
import { gotoMenu, openAchievements, openAiGenerator, leaveToMenu } from "./utilities/fixtures";
import { mockGenerationSuccess, mockModelsSuccess, unlockGenerator } from "./utilities/aiMocks";

const STORY_ID = "cursed-forest";

/**
 * Locates the achievement card carrying the given heading, so its status badge
 * can be asserted independently of the other cards.
 *
 * @param page - The page currently on the achievements view.
 * @param name - The achievement's displayed name.
 * @returns A locator for the matching card article.
 * @author Claude
 */
const achievementCard = ( page: Page, name: string ): Locator =>
    page.locator( "article" ).filter( { has: page.getByRole( "heading", { name } ) } );

test.describe( "Achievements", () =>
{
    test( "opens the achievements screen and lists locked and secret achievements", async ( { page } ) =>
    {
        await gotoMenu( page );
        await openAchievements( page );

        await expect( page.getByText( "ACHIEVEMENTS", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( "0 / 7 unlocked" ) ).toBeVisible();

        // A regular achievement shows its real name and a Locked badge.
        await expect( achievementCard( page, "First Steps" ).getByText( "Locked", { exact: true } ) ).toBeVisible();

        // Secret achievements stay masked until unlocked.
        await expect( page.getByRole( "heading", { name: "? ? ?" } ).first() ).toBeVisible();
        await expect( page.getByRole( "heading", { name: "Great Explorer" } ) ).toHaveCount( 0 );
    } );

    test( "completing a story for the first time notifies and unlocks First Steps", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await playPath( page, path );

        // Filtered by text: the "Endings discovered" <output> is a status region too.
        const toast = page.getByRole( "status" ).filter( { hasText: /Achievements? unlocked/ } );
        await expect( toast ).toBeVisible();
        await expect( toast.getByText( "First Steps" ) ).toBeVisible();

        // The unlock is also persisted, and shown on the achievements screen.
        await leaveToMenu( page );
        await openAchievements( page );

        await expect( achievementCard( page, "First Steps" ).getByText( "Unlocked", { exact: true } ) ).toBeVisible();
    } );

    test( "discovering every ending of a story unlocks No Stone Unturned", async ( { page } ) =>
    {
        const paths = findAllEndingPaths( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();

        for ( let i = 0; i < paths.length; i++ )
        {
            await playPath( page, paths[ i ] );

            const isLastPath = i === paths.length - 1;

            // Restart between endings; the last one stays on screen to leave from.
            if ( !isLastPath )
            {
                await page.getByRole( "button", { name: "Restart", exact: true } ).click();
            }
        }

        await leaveToMenu( page );
        await openAchievements( page );

        await expect( achievementCard( page, "No Stone Unturned" ).getByText( "Unlocked", { exact: true } ) ).toBeVisible();
    } );

    test( "resets every unlocked achievement back to locked", async ( { page } ) =>
    {
        const path = findPathToEnding( STORY_ID );

        await gotoMenu( page, `/?story=${ STORY_ID }` );
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await playPath( page, path );

        await leaveToMenu( page );
        await openAchievements( page );

        await expect( achievementCard( page, "First Steps" ).getByText( "Unlocked", { exact: true } ) ).toBeVisible();

        const resetButton = page.getByRole( "button", { name: "Reset achievements" } );

        await resetButton.click();
        await page.getByRole( "dialog", { name: "Reset achievements?" } ).getByRole( "button", { name: "Reset everything" } ).click();

        await expect( page.getByText( "0 / 7 unlocked" ) ).toBeVisible();
        await expect( achievementCard( page, "First Steps" ).getByText( "Locked", { exact: true } ) ).toBeVisible();

        // With nothing left to reset, the action is no longer offered.
        await expect( resetButton ).toBeHidden();
    } );

    test( "AI-generated stories never award achievements", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await mockGenerationSuccess( page );

        await gotoMenu( page );
        await openAiGenerator( page );

        await unlockGenerator( page );
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByRole( "button", { name: "Generate story" } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();

        // Reach the generated story's ending, then leave to the menu.
        await skipTypewriter( page );
        await choiceButton( page, 1 ).click();
        await skipTypewriter( page );
        await leaveToMenu( page );

        await openAchievements( page );
        await expect( page.getByText( "ACHIEVEMENTS", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( "0 / 7 unlocked" ) ).toBeVisible();
        await expect( achievementCard( page, "First Steps" ).getByText( "Locked", { exact: true } ) ).toBeVisible();
    } );
} );
