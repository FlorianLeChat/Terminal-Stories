import { test, expect } from "@playwright/test";
import { gotoMenu, openAiGenerator } from "./utilities/fixtures";
import { MOCK_MODEL, MOCK_STORY, mockGenerationError, mockGenerationSuccess, mockModelsRefused, mockModelsSuccess, unlockGenerator } from "./utilities/aiMocks";

test.describe( "AI story generator", () =>
{
    test.beforeEach( async ( { page } ) =>
    {
        await gotoMenu( page );
        await openAiGenerator( page );
    } );

    test( "keeps the generation options locked until a key is validated", async ( { page } ) =>
    {
        await expect( page.getByText( "Enter a valid key to unlock the generation options." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeDisabled();
    } );

    test( "rejects a key refused by the API", async ( { page } ) =>
    {
        await mockModelsRefused( page );

        await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-invalid" );
        await page.getByRole( "button", { name: "Validate" } ).click();

        await expect( page.getByText( "API key refused. Check your Anthropic key." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeDisabled();
    } );

    test( "unlocks the form once the key is validated", async ( { page } ) =>
    {
        await mockModelsSuccess( page );

        await unlockGenerator( page );

        await expect( page.getByText( "✓ Key validated." ) ).toBeVisible();
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();
        await expect( page.getByRole( "option", { name: MOCK_MODEL.display_name } ) ).toBeAttached();
    } );

    test( "generates and immediately plays a story", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await mockGenerationSuccess( page );

        await unlockGenerator( page );
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByLabel( "PREMISE" ).fill( "A mocked adventure." );
        await page.getByRole( "button", { name: "Generate story" } ).click();

        await expect( page.getByText( "NOW READING" ) ).toBeVisible();
        await expect( page.getByText( MOCK_STORY.title ) ).toBeVisible();

        await page.keyboard.press( " " );
        await expect( page.getByText( MOCK_STORY.scenes[ 0 ].text[ 0 ] ) ).toBeVisible();
    } );

    test( "surfaces a generation error without leaving the setup screen", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await mockGenerationError( page );

        await unlockGenerator( page );
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();

        await page.getByRole( "button", { name: "Generate story" } ).click();

        await expect( page.getByText( "ERROR : API error (code 500). Try again later." ) ).toBeVisible();
        await expect( page.getByText( "AI GENERATOR" ) ).toBeVisible();
    } );
} );
