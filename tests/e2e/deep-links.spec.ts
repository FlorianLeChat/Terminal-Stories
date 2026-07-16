import { test, expect } from "@playwright/test";
import { gotoMenu, openEncyclopedia, leaveToMenu } from "./utilities/fixtures";

test.describe( "Shareable deep links", () =>
{
    test( "opening a story updates the address bar", async ( { page } ) =>
    {
        await gotoMenu( page );

        await page.locator( "ol > li button" ).first().click();

        await expect( page ).toHaveURL( /\?story=[^&]+$/ );
    } );

    test( "loading a story link directly restores the story-info screen", async ( { page } ) =>
    {
        await gotoMenu( page, "/?story=cursed-forest" );

        await expect( page.getByText( "STORY INFO" ) ).toBeVisible();
        await expect( page.getByText( "The Cursed Forest" ) ).toBeVisible();
    } );

    test( "an unknown story id falls back to the main menu", async ( { page } ) =>
    {
        await gotoMenu( page, "/?story=does-not-exist" );

        await expect( page.getByText( "— INTERACTIVE STORIES SYSTEM —" ) ).toBeVisible();
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
} );
