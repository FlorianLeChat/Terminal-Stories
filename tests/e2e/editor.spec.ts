import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gotoMenu } from "./utilities/fixtures";

const CATALOG_STORY_ID = "cursed-forest";

// Title of the forked catalog story, read from the shipped JSON so the test
// keeps working when story content changes.
const catalogStoryTitle = ( JSON.parse(
    readFileSync( fileURLToPath( new URL( `../../src/lib/data/stories/${ CATALOG_STORY_ID }.json`, import.meta.url ) ), "utf-8" )
) as { title: string } ).title;

/** A minimal, fully valid story file accepted by the import pipeline. */
const VALID_IMPORT = {
    id: "any-id-gets-replaced",
    title: "Imported Adventure",
    genre: "fantasy",
    language: "English",
    universe: "Import Universe",
    description: "A story imported from a file.",
    tags: [ "import" ],
    characters: [],
    startScene: "start",
    scenes: [
        {
            id: "start",
            text: [ "The imported journey begins and ends here." ],
            choices: [],
            isEnding: true,
            endingType: "neutral"
        }
    ]
};

/**
 * A hostile story file: script-looking text, an external image, an invalid
 * music/sound value, an unknown field, a prototype-polluting scene id, and a
 * choice pointing to a missing scene. Import must keep it harmless.
 */
const MALICIOUS_IMPORT = {
    title: "<script>window.hacked = true</script>",
    genre: "horror",
    language: "English",
    universe: "Evil Universe",
    description: "desc",
    injected: "should be dropped",
    startScene: "start",
    scenes: [
        { id: "__proto__", text: [ "proto" ], choices: [] },
        {
            id: "start",
            text: [ "<img src=x onerror=\"window.hacked = true\">" ],
            image: "https://evil.example/pixel.png",
            music: "javascript:alert(1)",
            sound: "not-a-sound",
            choices: [ { text: "Go", nextScene: "missing-scene" } ],
            isEnding: true
        }
    ]
};

/**
 * Opens the "my stories" screen from a fresh main menu.
 *
 * @param page - The Playwright page to drive.
 * @author Claude
 */
const gotoMyStories = async ( page: Page ): Promise<void> =>
{
    await gotoMenu( page );
    await page.keyboard.press( "e" );
    await expect( page.getByText( "MY STORIES", { exact: true } ) ).toBeVisible();
};

/**
 * Imports a story payload through the hidden file input of the "my stories"
 * screen, as if the user had picked a local file.
 *
 * @param page - The Playwright page, already on the "my stories" screen.
 * @param content - The raw text content of the imported file.
 * @author Claude
 */
const importFile = async ( page: Page, content: string ): Promise<void> =>
{
    await page.getByLabel( "⇪ Import a story (.json)" ).setInputFiles( {
        name: "story.json",
        mimeType: "application/json",
        buffer: Buffer.from( content, "utf-8" )
    } );
};

test.describe( "My stories", () =>
{
    test( "creates a blank story, edits it, and plays it to its ending without unlocking achievements", async ( { page } ) =>
    {
        await gotoMyStories( page );
        await expect( page.getByText( "No custom story yet", { exact: false } ) ).toBeVisible();

        // [N] creates a blank story and opens the editor on it.
        await page.keyboard.press( "n" );
        await expect( page.getByText( "STORY EDITOR", { exact: true } ) ).toBeVisible();

        await page.getByLabel( "TITLE" ).fill( "My Test Story" );
        await page.getByLabel( "Text of this line" ).fill( "The adventure starts and ends here." );

        await page.getByRole( "button", { name: "Save", exact: true } ).click();
        await expect( page.getByText( "✓ Saved." ) ).toBeVisible();

        // ESC returns to the list, which now shows the saved story.
        await page.keyboard.press( "Escape" );
        await expect( page.getByText( "MY STORIES", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( "My Test Story" ) ).toBeVisible();

        // ENTER opens the highlighted story's info screen, ENTER again plays it.
        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "STORY INFO", { exact: true } ) ).toBeVisible();

        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "NOW READING", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( "The adventure starts and ends here." ) ).toBeVisible();

        // The single scene is an ending, so the restart control is offered.
        await expect( page.getByRole( "button", { name: "[ENTER] Restart" } ) ).toBeVisible();

        // Custom stories never award achievements, even on a first ending.
        const achievements = await page.evaluate( () => localStorage.getItem( "terminal-stories:achievements" ) );
        expect( achievements ).toBeNull();
    } );

    test( "forks a catalog story into an editable private copy", async ( { page } ) =>
    {
        await gotoMenu( page, `/?story=${ CATALOG_STORY_ID }` );
        await expect( page.getByText( "STORY INFO", { exact: true } ) ).toBeVisible();

        // [F] forks the previewed story and opens the copy in the editor.
        await page.keyboard.press( "f" );
        await expect( page.getByText( "STORY EDITOR", { exact: true } ) ).toBeVisible();
        await expect( page.getByLabel( "TITLE" ) ).toHaveValue( catalogStoryTitle );

        await page.keyboard.press( "Escape" );
        await expect( page.getByText( "MY STORIES", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( `forked from "${ catalogStoryTitle }"` ) ).toBeVisible();
    } );

    test( "exports a custom story as a JSON file", async ( { page } ) =>
    {
        await gotoMyStories( page );

        await page.keyboard.press( "n" );
        await page.getByLabel( "TITLE" ).fill( "Export Me" );
        await page.getByRole( "button", { name: "Save", exact: true } ).click();
        await expect( page.getByText( "✓ Saved." ) ).toBeVisible();
        await page.keyboard.press( "Escape" );

        const downloadPromise = page.waitForEvent( "download" );
        await page.getByRole( "button", { name: "Export" } ).click();
        const download = await downloadPromise;

        expect( download.suggestedFilename() ).toBe( "export-me.json" );

        // The downloaded file round-trips as a valid story with the same title.
        const path = await download.path();
        const exported = JSON.parse( readFileSync( path, "utf-8" ) ) as { title: string; scenes: unknown[] };

        expect( exported.title ).toBe( "Export Me" );
        expect( exported.scenes.length ).toBeGreaterThan( 0 );
    } );

    test( "imports a valid story file", async ( { page } ) =>
    {
        await gotoMyStories( page );

        await importFile( page, JSON.stringify( VALID_IMPORT ) );

        await expect( page.getByText( "Imported Adventure" ) ).toBeVisible();
    } );

    test( "rejects a file that is not valid JSON", async ( { page } ) =>
    {
        await gotoMyStories( page );

        await importFile( page, "this is { not json" );

        await expect( page.getByText( "This file is not valid JSON." ) ).toBeVisible();
        await expect( page.getByText( "No custom story yet", { exact: false } ) ).toBeVisible();
    } );

    test( "rejects a story without any reachable ending", async ( { page } ) =>
    {
        await gotoMyStories( page );

        // Two scenes locked in a loop: no ending can ever be reached.
        const endless = {
            ...VALID_IMPORT,
            title: "Endless Loop",
            scenes: [
                { id: "start", text: [ "a" ], choices: [ { text: "go", nextScene: "back" } ] },
                { id: "back", text: [ "b" ], choices: [ { text: "return", nextScene: "start" } ] }
            ]
        };

        await importFile( page, JSON.stringify( endless ) );

        await expect( page.getByText( "The story has no reachable ending." ) ).toBeVisible();
        await expect( page.getByText( "No custom story yet", { exact: false } ) ).toBeVisible();
    } );

    test( "sanitizes malicious content on import", async ( { page } ) =>
    {
        await gotoMyStories( page );

        await importFile( page, JSON.stringify( MALICIOUS_IMPORT ) );

        // The script-looking title is rendered as inert text, not executed.
        await expect( page.getByText( MALICIOUS_IMPORT.title ) ).toBeVisible();

        // Play the story: the HTML-looking line must appear as literal text.
        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "STORY INFO", { exact: true } ) ).toBeVisible();
        await page.keyboard.press( "Enter" );
        await expect( page.getByText( "NOW READING", { exact: true } ) ).toBeVisible();
        await expect( page.getByText( MALICIOUS_IMPORT.scenes[ 1 ].text[ 0 ] as string ) ).toBeVisible();

        // Neither the title nor the scene text ever executed as script.
        const hacked = await page.evaluate( () => ( window as unknown as { hacked?: boolean } ).hacked );
        expect( hacked ).toBeUndefined();

        // The stored payload was stripped of every dangerous field.
        const records = await page.evaluate( () =>
            JSON.parse( localStorage.getItem( "terminal-stories:custom-stories" ) ?? "[]" ) ) as {
            story: {
                scenes: { id: string; image?: string; music?: string; sound?: string; choices: unknown[] }[];
            } & Record<string, unknown>;
        }[];

        expect( records ).toHaveLength( 1 );

        const startScene = records[ 0 ].story.scenes.find( ( scene ) => scene.id === "start" );

        expect( startScene?.image ).toBeUndefined();
        expect( startScene?.music ).toBeUndefined();
        expect( startScene?.sound ).toBeUndefined();
        // The choice pointing to a missing scene was pruned.
        expect( startScene?.choices ).toHaveLength( 0 );
        // The prototype-polluting scene id was refused.
        expect( records[ 0 ].story.scenes.some( ( scene ) => scene.id === "__proto__" ) ).toBe( false );
        // Unknown top-level fields are not persisted.
        expect( "injected" in records[ 0 ].story ).toBe( false );
    } );

    test( "deletes a custom story after confirmation", async ( { page } ) =>
    {
        await gotoMyStories( page );

        await importFile( page, JSON.stringify( VALID_IMPORT ) );
        await expect( page.getByText( "Imported Adventure" ) ).toBeVisible();

        page.once( "dialog", ( dialog ) => dialog.accept() );
        await page.getByRole( "button", { name: "Delete" } ).click();

        await expect( page.getByText( "No custom story yet", { exact: false } ) ).toBeVisible();
        await expect( page.getByText( "Imported Adventure" ) ).toBeHidden();
    } );
} );
