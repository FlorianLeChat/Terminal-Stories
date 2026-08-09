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

    test( "opens pre-filtered to the reader's language and cycles it with [L]", async ( { page } ) =>
    {
        const languageButtons = page.locator( "[aria-labelledby=\"filter-language-label\"] button[aria-pressed]" );

        // The app renders the base locale (English) in tests, so the catalog
        // opens pre-filtered to English: the first language starts selected,
        // the Reset control is available, and the count reflects the filter
        // rather than the full catalog.
        await expect( languageButtons.nth( 0 ) ).toHaveAttribute( "aria-pressed", "true" );
        await expect( page.getByRole( "button", { name: "✕ Reset" } ) ).toBeVisible();
        await expect( page.getByText( /\/ \d+ stories filtered/ ) ).toBeVisible();

        // [L] advances to the next language in the cycle.
        await page.keyboard.press( "l" );
        await expect( languageButtons.nth( 0 ) ).toHaveAttribute( "aria-pressed", "false" );
        await expect( languageButtons.nth( 1 ) ).toHaveAttribute( "aria-pressed", "true" );

        // [C] clears every filter, deselecting all languages.
        await page.keyboard.press( "c" );
        await expect( languageButtons.nth( 0 ) ).toHaveAttribute( "aria-pressed", "false" );
        await expect( languageButtons.nth( 1 ) ).toHaveAttribute( "aria-pressed", "false" );
    } );

    test( "searches the catalog and clears the query", async ( { page } ) =>
    {
        await page.getByRole( "button", { name: "Search for a story" } ).click();

        const searchInput = page.getByRole( "textbox", { name: "Search for a story" } );
        await expect( searchInput ).toBeFocused();

        await searchInput.fill( "forest" );

        await expect( page.getByText( "The Cursed Forest" ) ).toBeVisible();
        await expect( page.getByText( /result for "forest"/ ) ).toBeVisible();

        // The ✕ beside the box cancels the search outright. Matched exactly, as
        // the desktop footer legend carries a "[ESC] Cancel search" entry too.
        await page.getByRole( "button", { name: "Cancel search", exact: true } ).click();
        await expect( searchInput ).not.toBeVisible();

        // Reopening the search starts from an empty query again.
        await page.getByRole( "button", { name: "Search for a story" } ).click();
        await searchInput.fill( "zzznonexistentquery" );
        await expect( page.getByText( "No story matches \"zzznonexistentquery\"." ) ).toBeVisible();

        await page.getByRole( "button", { name: "Clear search" } ).click();
        await expect( searchInput ).not.toBeVisible();
    } );

    test( "truncates a long search query in the count and empty-state messages", async ( { page } ) =>
    {
        await page.getByRole( "button", { name: "Search for a story" } ).click();

        const searchInput = page.getByRole( "textbox", { name: "Search for a story" } );
        const longQuery = "z".repeat( 60 );
        const truncatedQuery = `${ "z".repeat( 40 ) }...`;

        await searchInput.fill( longQuery );

        await expect( page.getByText( `No story matches "${ truncatedQuery }".` ) ).toBeVisible();
        await expect( page.getByText( longQuery, { exact: false } ) ).not.toBeVisible();
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

    test( "navigates the list and opens a story with the footer buttons", async ( { page, isMobile } ) =>
    {
        // The footer is the keyboard-shortcut legend on desktop only; on mobile
        // list navigation is done by tapping the list directly (see controls.spec).
        test.skip( isMobile, "footer legend is desktop-only" );

        await page.getByRole( "button", { name: "[↓] Down" } ).click();
        await expect( page.locator( "ol > li button[aria-current='true']" ) ).toHaveCount( 1 );

        await page.getByRole( "button", { name: "[↑] Up" } ).click();
        await page.getByRole( "button", { name: "[ENTER] Select" } ).click();

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
    } );
} );
