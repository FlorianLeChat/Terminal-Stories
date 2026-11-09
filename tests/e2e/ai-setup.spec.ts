import { test, expect } from "@playwright/test";
import { gotoMenu, openAiGenerator } from "./utilities/fixtures";
import { MOCK_MODEL, MOCK_STORY, mockGenerationError, mockGenerationPending, mockGenerationSuccess, mockModelsRefused, mockModelsSuccess, unlockGenerator } from "./utilities/aiMocks";

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
        await expect( page.getByLabel( "MODEL" ) ).toContainText( "Validate your key to list the models" );
    } );

    test( "checks the key on request only, and its format before any call", async ( { page } ) =>
    {
        let modelCalls = 0;
        await page.route( "https://api.anthropic.com/v1/models**", ( route ) =>
        {
            modelCalls += 1;
            return route.abort();
        } );

        const key = page.getByLabel( "ANTHROPIC API KEY" );
        await expect( page.getByText( "No key entered yet." ) ).toBeVisible();

        // Typing then leaving the field checks nothing by itself.
        await key.fill( "not-a-key" );
        await key.blur();
        await expect( page.getByText( "Key not checked yet: press Validate." ) ).toBeVisible();

        // A malformed key is caught locally, without reaching the network.
        await page.getByRole( "button", { name: "Validate" } ).click();
        await expect( page.getByText( /^This is not an Anthropic key/ ) ).toBeVisible();
        await expect( key ).toHaveAttribute( "aria-invalid", "true" );
        expect( modelCalls ).toBe( 0 );
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

        // Genre comes from the catalog; the language defaults to the reader's own.
        await expect( page.getByLabel( "LANGUAGE" ) ).toHaveValue( "English" );
        await page.getByLabel( "GENRE" ).selectOption( { label: "Sci-Fi" } );
        await expect( page.getByLabel( "GENRE" ) ).toHaveValue( "sci-fi" );
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

    test( "cancels a generation in flight", async ( { page } ) =>
    {
        await mockModelsSuccess( page );
        await mockGenerationPending( page );

        await unlockGenerator( page );
        await page.getByRole( "button", { name: "Generate story" } ).click();

        const cancel = page.getByRole( "button", { name: "Cancel", exact: true } );
        await expect( cancel ).toBeVisible();
        await cancel.click();

        // Back to a ready form, still on the generator.
        await expect( cancel ).toHaveCount( 0 );
        await expect( page.getByRole( "button", { name: "Generate story" } ) ).toBeEnabled();
        await expect( page.getByText( "AI GENERATOR" ) ).toBeVisible();
    } );
} );
