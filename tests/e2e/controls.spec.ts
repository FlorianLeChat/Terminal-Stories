import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

// Which footer the app renders is the only viewport-dependent behavior worth a
// dedicated spec: everything reachable through it (filters, search, story
// start, encyclopedia...) is already exercised by the feature specs, which the
// `Mobile Chrome` project replays at a phone-sized viewport. So each test here
// runs on the single project it describes, rather than forcing a viewport size
// and running twice with identical results.
test.describe( "Responsive footer controls", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
    } );

    test( "shows the keyboard-shortcut legend on desktop, not the mobile nav", async ( { page, isMobile } ) =>
    {
        test.skip( isMobile, "desktop footer only" );

        // The legend keeps the [KEY] reminders (still clickable for the mouse).
        await expect( page.getByRole( "button", { name: "[G] Genre" } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "[W] Encyclopedia" } ) ).toBeVisible();

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
        await expect( page.getByRole( "button", { name: "[G] Genre" } ) ).toBeHidden();
        await expect( page.getByRole( "button", { name: "[↓] Down" } ) ).toBeHidden();
    } );
} );
