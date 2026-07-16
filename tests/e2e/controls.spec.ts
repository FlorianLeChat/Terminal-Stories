import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

// A phone-sized viewport (below Tailwind's `sm` 640px breakpoint) where the
// footer shows only page-navigation buttons.
const MOBILE_VIEWPORT = { width: 375, height: 812 };

// A desktop viewport (at/above `sm`) where the footer is the keyboard-shortcut
// legend.
const DESKTOP_VIEWPORT = { width: 1024, height: 768 };

const STORY_ID = "cursed-forest";

test.describe( "Responsive footer controls", () =>
{
    test( "shows the keyboard-shortcut legend on desktop, not the mobile nav", async ( { page } ) =>
    {
        await page.setViewportSize( DESKTOP_VIEWPORT );
        await gotoMenu( page );

        // The legend keeps the [KEY] reminders (still clickable for the mouse).
        await expect( page.getByRole( "button", { name: "[G] Genre" } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[W] Encyclopedia" } ) ).toBeVisible();

        // The plain-label mobile navigation buttons are hidden on desktop.
        await expect( page.getByRole( "button", { name: "Encyclopedia", exact: true } ) ).toBeHidden();

        // The old mobile fold toggle no longer exists at all.
        await expect( page.getByRole( "button", { name: "Controls" } ) ).toHaveCount( 0 );
    } );

    test( "shows only page-navigation buttons on mobile, not the legend", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page );

        // Page-access navigation, with short labels and no [KEY] prefix.
        await expect( page.getByRole( "button", { name: "Encyclopedia", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "AI", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Achievements", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "My stories", exact: true } ) ).toBeVisible();

        // The keyboard legend and its filter/navigation duplicates are hidden.
        await expect( page.getByRole( "button", { name: "[G] Genre" } ) ).toBeHidden();
        await expect( page.getByRole( "button", { name: "[↓] Down" } ) ).toBeHidden();

        // No fold toggle anymore.
        await expect( page.getByRole( "button", { name: "Controls" } ) ).toHaveCount( 0 );
    } );

    test( "reaches the encyclopedia from the mobile navigation", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page );

        await page.getByRole( "button", { name: "Encyclopedia", exact: true } ).click();
        await expect( page.getByText( "KNOWLEDGE BASE" ) ).toBeVisible();

        // The mobile footer offers a single, explicit way back to the catalog.
        await expect( page.getByRole( "button", { name: "Back to stories", exact: true } ) ).toBeVisible();
    } );

    test( "keeps the filters tappable in the page on mobile", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page );

        const genreButtons = page.locator( "[aria-labelledby=\"filter-genre-label\"] button[aria-pressed]" );
        await genreButtons.first().click();
        await expect( genreButtons.first() ).toHaveAttribute( "aria-pressed", "true" );
    } );

    test( "activates the search from the on-page button on mobile", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page );

        await page.getByRole( "button", { name: "Search for a story" } ).click();

        const searchInput = page.getByRole( "textbox", { name: "Search for a story" } );
        await expect( searchInput ).toBeFocused();

        // The active search box carries its own cancel control.
        await page.getByRole( "button", { name: "Cancel search" } ).click();
        await expect( searchInput ).not.toBeVisible();
    } );

    test( "starts a story from the on-page action bar on mobile", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page, `/?story=${ STORY_ID }` );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();

        // The footer only offers the way back; playback starts from the page.
        await page.getByRole( "button", { name: "Start", exact: true } ).click();
        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
    } );
} );
