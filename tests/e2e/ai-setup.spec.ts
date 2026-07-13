import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoMenu } from "./utilities/fixtures";

const MODELS_URL = "https://api.anthropic.com/v1/models*";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

const MOCK_MODEL = { id: "claude-mock-1", display_name: "Claude Mock 1", created_at: "2026-01-01T00:00:00Z" };

const MOCK_STORY = {
    title: "The Mocked Path",
    genre: "mystery",
    language: "English",
    universe: "Test Universe",
    description: "A story generated for testing.",
    tags: [ "test" ],
    characters: [],
    startScene: "start",
    scenes: [
        {
            id: "start",
            text: [ "You wake up in a mocked room." ],
            choices: [ { id: "c1", text: "Open the door", action: "You open it.", consequence: "Light floods in.", nextScene: "end" } ]
        },
        {
            id: "end",
            text: [ "The story ends here." ],
            isEnding: true,
            choices: []
        }
    ]
};

/**
 * Stubs the Anthropic Models API so key validation succeeds without a real
 * network call or credentials.
 *
 * @param page - The page whose requests should be intercepted.
 * @author Claude
 */
const mockModelsSuccess = async ( page: Page ): Promise<void> =>
{
    await page.route( MODELS_URL, ( route ) =>
        route.fulfill( { status: 200, contentType: "application/json", body: JSON.stringify( { data: [ MOCK_MODEL ] } ) } ) );
};

test.describe( "AI story generator", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
        await page.getByRole( "button", { name: "[I] AI" } ).click();
    } );

    test( "keeps the generation options locked until a key is validated", async ( { page } ) =>
    {
        await expect( page.getByText( "Enter a valid key to unlock the generation options." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeDisabled();
    } );

    test( "rejects a key refused by the API", async ( { page } ) =>
    {
        await page.route( MODELS_URL, ( route ) => route.fulfill( { status: 401, contentType: "application/json", body: "{}" } ) );

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-invalid" );
        await page.getByRole( "button", { name: "Validate" } ).click();

        await expect( page.getByText( "API key refused. Check your Anthropic key." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeDisabled();
    } );

    test( "unlocks the form once the key is validated", async ( { page } ) =>
    {
        await mockModelsSuccess( page );

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-valid" );
        await page.getByRole( "button", { name: "Validate" } ).click();

        await expect( page.getByText( "✓ Key validated." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();
        await expect( page.getByRole( "option", { name: "Claude Mock 1" } ) ).toBeAttached();
    } );

    test( "generates and immediately plays a story", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await page.route( MESSAGES_URL, ( route ) =>
            route.fulfill( {
                status: 200,
                contentType: "application/json",
                body: JSON.stringify( { content: [ { type: "text", text: JSON.stringify( MOCK_STORY ) } ] } )
            } ) );

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-valid" );
        await page.getByRole( "button", { name: "Validate" } ).click();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByLabel( "PREMISE" ).fill( "A mocked adventure." );
        await page.getByRole( "button", { name: "Generate story" } ).click();

        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
        await expect( page.getByText( "The Mocked Path" ) ).toBeVisible();

        await page.keyboard.press( " " );
        await expect( page.getByText( "You wake up in a mocked room." ) ).toBeVisible();
    } );

    test( "surfaces a generation error without leaving the setup screen", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await page.route( MESSAGES_URL, ( route ) => route.fulfill( { status: 500, contentType: "application/json", body: "{}" } ) );

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-valid" );
        await page.getByRole( "button", { name: "Validate" } ).click();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByRole( "button", { name: "Generate story" } ).click();

        await expect( page.getByText( "ERROR : API error (code 500). Try again later." ) ).toBeVisible();
        await expect( page.getByText( "AI GENERATOR" ) ).toBeVisible();
    } );
} );
