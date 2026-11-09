import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { gotoMenu, skipBoot } from "./utilities/fixtures";

/**
 * Unfolds the filter panel, which starts collapsed on phone-sized viewports
 * so the catalog shows on the first screen.
 *
 * @param page - The Playwright page, on the main menu.
 * @author Claude
 */
const openMobileFilters = async ( page: Page ): Promise<void> =>
{
    const toggle = page.getByRole( "button", { name: /^Filters \(\d\)/ } );

    await expect( toggle ).toHaveAttribute( "aria-expanded", "false" );
    await toggle.click();
    await expect( toggle ).toHaveAttribute( "aria-expanded", "true" );
};

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

    test( "shows a first-launch tip until it is closed, for good", async ( { page } ) =>
    {
        const tip = page.getByRole( "complementary", { name: "Getting started" } );
        await expect( tip ).toBeVisible();

        await tip.getByRole( "button", { name: "Hide this tip" } ).click();
        await expect( tip ).toHaveCount( 0 );

        await page.reload();
        await skipBoot( page );
        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
        await expect( tip ).toHaveCount( 0 );
    } );

    test( "cycles and resets the genre filter", async ( { page, isMobile } ) =>
    {
        if ( isMobile ) await openMobileFilters( page );

        const genreButtons = page.locator( "[aria-labelledby=\"filter-genre-label\"] button[aria-pressed]" );
        const firstGenre = genreButtons.first();

        await firstGenre.click();
        await expect( firstGenre ).toHaveAttribute( "aria-pressed", "true" );

        const resetButton = page.getByRole( "button", { name: "✕ Reset" } );
        await expect( resetButton ).toBeVisible();

        await resetButton.click();
        await expect( firstGenre ).toHaveAttribute( "aria-pressed", "false" );
    } );

    test( "opens on the full catalog and cycles the language with [L]", async ( { page, isMobile } ) =>
    {
        if ( isMobile ) await openMobileFilters( page );

        const languageButtons = page.locator( "[aria-labelledby=\"filter-language-label\"] button[aria-pressed]" );

        // No language is preselected on first launch: the whole catalog shows.
        await expect( languageButtons.nth( 0 ) ).toHaveAttribute( "aria-pressed", "false" );
        await expect( page.getByText( /\/ \d+ stories available/ ) ).toBeVisible();

        // [L] steps through the languages.
        await page.keyboard.press( "l" );
        await expect( languageButtons.nth( 0 ) ).toHaveAttribute( "aria-pressed", "true" );
        await expect( page.getByRole( "button", { name: "✕ Reset" } ) ).toBeVisible();

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

        // Matched exactly: the desktop legend also has a "[ESC] Cancel search" entry.
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
        test.skip( isMobile, "footer legend is desktop-only" );

        await page.getByRole( "button", { name: "[↓] Down" } ).click();
        await expect( page.locator( "ol > li button[aria-current='true']" ) ).toHaveCount( 1 );

        await page.getByRole( "button", { name: "[↑] Up" } ).click();
        await page.getByRole( "button", { name: "[ENTER] Select" } ).click();

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
    } );

    test( "starts with no story expanded on touch screens", async ( { page, isMobile } ) =>
    {
        test.skip( !isMobile, "two-tap expansion is touch-only" );

        await expect( page.locator( "ol > li button[aria-current='true']" ) ).toHaveCount( 0 );

        // The first tap expands a card, the second opens it.
        await page.locator( "ol > li button" ).first().tap();
        await expect( page.locator( "ol > li button[aria-current='true']" ) ).toHaveCount( 1 );
    } );
} );
