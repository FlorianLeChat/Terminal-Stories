import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

const ENTRY_NAME = "Kingdom of Elarion";
const ENTRY_ID = "cursed-forest--universe--elarion";

/**
 * Locates the entry-list title for {@link ENTRY_NAME}. Scoped to the bold
 * name span within the results list, since the plain entry name also appears
 * as a filter button and inside other entries' "· <universe>" sub-line.
 *
 * @param page - The page currently showing the wiki entry list.
 * @returns A locator for the matching entry's title.
 * @author Claude
 */
const entryTitle = ( page: Page ) => page.locator( "ol > li span.font-bold", { hasText: ENTRY_NAME } );

test.describe( "Encyclopedia", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
        await page.getByRole( "button", { name: "✦ [W] Encyclopedia" } ).click();
    } );

    test( "lists entries for the default category with a count footer", async ( { page } ) =>
    {
        await expect( entryTitle( page ) ).toBeVisible();
        await expect( page.getByText( /\d+ entr(y|ies) —/ ) ).toBeVisible();
    } );

    test( "switches category with the [←→] shortcut", async ( { page } ) =>
    {
        const categoryButtons = page.locator( "[aria-labelledby=\"wiki-filter-category-label\"] button[aria-pressed]" );
        const firstCategory = categoryButtons.first();

        await expect( firstCategory ).toHaveAttribute( "aria-pressed", "true" );

        await page.keyboard.press( "ArrowRight" );
        await expect( firstCategory ).toHaveAttribute( "aria-pressed", "false" );
    } );

    test( "filters by language then by universe", async ( { page } ) =>
    {
        const languageButtons = page.locator( "[aria-labelledby=\"wiki-filter-language-label\"] button[aria-pressed]" );
        const englishButton = languageButtons.filter( { hasText: "English" } );

        // The encyclopedia opens pre-filtered to the reader's locale (English
        // in tests), so the English language filter starts selected.
        await expect( englishButton ).toHaveAttribute( "aria-pressed", "true" );

        const universeButton = page.locator( "[aria-labelledby=\"wiki-filter-universe-label\"] button", { hasText: "Kingdom of Elarion" } );
        await universeButton.click();

        await expect( entryTitle( page ) ).toBeVisible();
    } );

    test( "searches entries and clears the query", async ( { page } ) =>
    {
        await page.keyboard.press( "/" );

        const searchInput = page.getByRole( "textbox", { name: "Search an encyclopedia entry" } );
        await expect( searchInput ).toBeFocused();

        await searchInput.fill( "elarion" );
        await expect( entryTitle( page ) ).toBeVisible();

        await searchInput.fill( "zzznonexistententry" );
        await expect( page.getByText( "No entry matches \"zzznonexistententry\"." ) ).toBeVisible();

        await page.getByRole( "button", { name: "Clear search" } ).click();
        await expect( searchInput ).not.toBeVisible();
    } );

    test( "opens an entry detail and navigates back with ESC", async ( { page } ) =>
    {
        await entryTitle( page ).click();

        await expect( page.getByRole( "button", { name: "[ESC] Back to list" } ) ).toBeVisible();

        await page.keyboard.press( "Escape" );

        await expect( page.locator( "#wiki-filter-category-label" ) ).toBeVisible();
    } );

    test( "opens an entry directly through a deep link", async ( { page } ) =>
    {
        await gotoMenu( page, `/?wiki=${ ENTRY_ID }` );

        await expect( page.getByText( "KNOWLEDGE BASE" ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[ESC] Back to list" } ) ).toBeVisible();
    } );

    test( "closes the encyclopedia and returns to the main menu with ESC", async ( { page } ) =>
    {
        await page.keyboard.press( "Escape" );

        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
    } );
} );
