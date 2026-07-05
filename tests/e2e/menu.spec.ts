import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

test.describe( "Main menu", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
    } );

    test( "lists the story catalog with a count footer", async ( { page } ) =>
    {
        await expect( page.locator( "ol > li button" ).first() ).toBeVisible();
        await expect( page.getByText( /\/ \d+ stor(y|ies)/ ) ).toBeVisible();
    } );

    test( "cycles and resets the genre filter", async ( { page } ) =>
    {
        const genreButtons = page.locator( "[aria-labelledby=\"filter-genre-label\"] button[aria-pressed]" );
        const firstGenre = genreButtons.first();

        await firstGenre.click();
        await expect( firstGenre ).toHaveAttribute( "aria-pressed", "true" );

        const resetButton = page.getByRole( "button", { name: "✕ Reset" } );
        await expect( resetButton ).toBeVisible();

        await resetButton.click();
        await expect( firstGenre ).toHaveAttribute( "aria-pressed", "false" );
    } );

    test( "cycles the language filter with the [L] shortcut", async ( { page } ) =>
    {
        const languageButtons = page.locator( "[aria-labelledby=\"filter-language-label\"] button[aria-pressed]" );
        const firstLanguage = languageButtons.first();

        await page.keyboard.press( "l" );
        await expect( firstLanguage ).toHaveAttribute( "aria-pressed", "true" );

        await page.keyboard.press( "c" );
        await expect( firstLanguage ).toHaveAttribute( "aria-pressed", "false" );
    } );

    test( "searches the catalog and clears the query", async ( { page } ) =>
    {
        await page.keyboard.press( "/" );

        const searchInput = page.getByRole( "textbox", { name: "Search for a story" } );
        await expect( searchInput ).toBeFocused();

        await searchInput.fill( "forest" );

        await expect( page.getByText( "The Cursed Forest" ) ).toBeVisible();
        await expect( page.getByText( /result for "forest"/ ) ).toBeVisible();

        await searchInput.fill( "zzznonexistentquery" );
        await expect( page.getByText( "No story matches \"zzznonexistentquery\"." ) ).toBeVisible();

        await page.getByRole( "button", { name: "Clear search" } ).click();
        await expect( searchInput ).not.toBeVisible();
    } );

    test( "navigates the list with arrow keys and opens a story with ENTER", async ( { page } ) =>
    {
        await page.keyboard.press( "ArrowDown" );
        await expect( page.locator( "ol > li button[aria-current='true']" ) ).toHaveCount( 1 );

        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
    } );

    test( "opens the first story with the [1] direct-access shortcut", async ( { page } ) =>
    {
        const firstTitle = await page.locator( "ol > li button" ).first().locator( ".font-bold" ).innerText();

        await page.keyboard.press( "1" );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
        await expect( page.getByText( firstTitle ) ).toBeVisible();
    } );

    test( "opens the encyclopedia from the menu button", async ( { page } ) =>
    {
        await page.getByRole( "button", { name: "✦ [W] Encyclopedia" } ).click();

        await expect( page.getByText( "KNOWLEDGE BASE" ) ).toBeVisible();
    } );

    test( "opens the AI story generator from the menu button", async ( { page } ) =>
    {
        await page.getByRole( "button", { name: "✦ [I] AI story" } ).click();

        await expect( page.getByText( "AI GENERATOR" ) ).toBeVisible();
    } );
} );
