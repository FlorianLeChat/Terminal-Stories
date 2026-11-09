import { test, expect } from "@playwright/test";
import { gotoMenu, gotoFresh, openEncyclopedia, leaveToMenu } from "./utilities/fixtures";

test.describe( "Shareable deep links", () =>
{
    test( "opening a story updates the address bar", async ( { page } ) =>
    {
        await gotoMenu( page );

        await page.locator( "ol > li button" ).first().click();

        await expect( page ).toHaveURL( /\?story=[^&]+$/ );
    } );

    // Loading `/?story=<id>` into the info screen is covered by every story.spec test.

    test( "an unknown story id falls back to the main menu and says why", async ( { page } ) =>
    {
        await gotoMenu( page, "/?story=does-not-exist" );

        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
        await expect( page.getByRole( "alert" ).filter( { hasText: "points to a story that does not exist" } ) ).toBeVisible();
    } );

    test( "a shared link opens its target directly, without the boot screen", async ( { page } ) =>
    {
        await gotoFresh( page, "/?story=cursed-forest" );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
        await expect( page.getByText( /^(Press ENTER|Tap the screen) to begin\.$/ ) ).toHaveCount( 0 );
    } );

    test( "opening a wiki entry updates the address bar", async ( { page } ) =>
    {
        await gotoMenu( page );
        await openEncyclopedia( page );

        await page.locator( "ol > li span.font-bold", { hasText: "Kingdom of Elarion" } ).click();

        await expect( page ).toHaveURL( /\?wiki=[^&]+$/ );
    } );

    test( "leaving a story back to the menu clears the address bar", async ( { page } ) =>
    {
        await gotoMenu( page, "/?story=cursed-forest" );

        await leaveToMenu( page );

        await expect( page ).toHaveURL( /^[^?]*\/?$/ );
    } );

    test( "a story opened from the menu clears the address bar once left", async ( { page } ) =>
    {
        await gotoMenu( page );

        // Shallow routing writes this query, so clearing it differs from a loaded deep link.
        await page.keyboard.press( "1" );
        await expect( page ).toHaveURL( /\?story=[^&]+$/ );

        await leaveToMenu( page );

        await expect( page ).toHaveURL( /^[^?]*\/?$/ );
    } );
} );
