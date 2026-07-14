import { test, expect } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

// A phone-sized viewport (below Tailwind's `sm` 640px breakpoint) where the
// control bar wraps and the fold toggle is offered.
const MOBILE_VIEWPORT = { width: 375, height: 812 };

// A desktop viewport (at/above `sm`) where the bar is always shown and the
// toggle is hidden.
const DESKTOP_VIEWPORT = { width: 1024, height: 768 };

test.describe( "Mobile control bar fold toggle", () =>
{
    test( "hides and shows the control buttons when tapped", async ( { page } ) =>
    {
        await page.setViewportSize( MOBILE_VIEWPORT );
        await gotoMenu( page );

        const toggle = page.getByRole( "button", { name: "Controls" } );
        const genreControl = page.getByRole( "button", { name: "[G] Genre" } );

        // Expanded by default: the toggle is offered and the controls are shown.
        await expect( toggle ).toBeVisible();
        await expect( genreControl ).toBeVisible();

        // Folding hides the control buttons while keeping the toggle reachable.
        await toggle.click();
        await expect( genreControl ).toBeHidden();
        await expect( toggle ).toBeVisible();

        // Unfolding brings them back.
        await toggle.click();
        await expect( genreControl ).toBeVisible();
    } );

    test( "keeps the controls always visible on desktop without a toggle", async ( { page } ) =>
    {
        await page.setViewportSize( DESKTOP_VIEWPORT );
        await gotoMenu( page );

        await expect( page.getByRole( "button", { name: "[G] Genre" } ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Controls" } ) ).toBeHidden();
    } );
} );
