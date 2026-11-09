import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

// Only the footer itself is viewport-specific: what it reaches is covered by the
// feature specs, replayed by `Mobile Chrome`. Each test runs on its own project.
test.describe( "Responsive footer controls", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
    } );

    test( "shows the keyboard-shortcut legend on desktop, not the mobile nav", async ( { page, isMobile } ) =>
    {
        test.skip( isMobile, "desktop footer only" );

        // The legend keeps clickable [KEY] reminders; the other views sit in the menu's nav.
        await expect( page.getByRole( "button", { name: "[/] Search" } ) ).toBeVisible();
        await expect( page.getByRole( "navigation", { name: "Other views" } ).getByRole( "button", { name: "[W] Encyclopedia" } ) ).toBeVisible();

        // The plain-label mobile navigation buttons are hidden on desktop.
        await expect( page.getByRole( "button", { name: "Encyclopedia", exact: true } ) ).toBeHidden();
    } );

    test( "shows only page-navigation buttons on mobile, not the legend", async ( { page, isMobile } ) =>
    {
        test.skip( !isMobile, "mobile footer only" );

        // Page-access navigation, with short labels and no [KEY] prefix.
        await expect( page.getByRole( "button", { name: "Encyclopedia", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "AI", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Achievements", exact: true } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "My stories", exact: true } ) ).toBeVisible();

        // The keyboard legend and its filter/navigation duplicates are hidden.
        await expect( page.getByRole( "button", { name: "[/] Search" } ) ).toBeHidden();
        await expect( page.getByRole( "button", { name: "[↓] Down" } ) ).toBeHidden();
    } );
} );
