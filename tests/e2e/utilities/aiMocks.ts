import type { Page } from "@playwright/test";

const MODELS_URL = "https://api.anthropic.com/v1/models*";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** The single model the stubbed Models API advertises. */
export const MOCK_MODEL = { id: "claude-mock-1", display_name: "Claude Mock 1", created_at: "2026-01-01T00:00:00Z" };

/** A minimal two-scene story returned by the stubbed generation endpoint. */
export const MOCK_STORY = {
    title: "The Mocked Path",
    genre: "mystery",
    language: "English",
    universe: "Test Universe",
    description: "A story generated for testing.",
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
export const mockModelsSuccess = async ( page: Page ): Promise<void> =>
{
    await page.route( MODELS_URL, ( route ) =>
        route.fulfill( { status: 200, contentType: "application/json", body: JSON.stringify( { data: [ MOCK_MODEL ] } ) } ) );
};

/**
 * Stubs the Anthropic Models API with the response a rejected key produces.
 *
 * @param page - The page whose requests should be intercepted.
 * @author Claude
 */
export const mockModelsRefused = async ( page: Page ): Promise<void> =>
{
    await page.route( MODELS_URL, ( route ) => route.fulfill( { status: 401, contentType: "application/json", body: "{}" } ) );
};

/**
 * Stubs the Anthropic Messages API so generation returns {@link MOCK_STORY}.
 *
 * @param page - The page whose requests should be intercepted.
 * @author Claude
 */
export const mockGenerationSuccess = async ( page: Page ): Promise<void> =>
{
    await page.route( MESSAGES_URL, ( route ) =>
        route.fulfill( {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify( { content: [ { type: "text", text: JSON.stringify( MOCK_STORY ) } ] } )
        } ) );
};

/**
 * Stubs the Anthropic Messages API with a server error, so the setup screen
 * has to surface a generation failure.
 *
 * @param page - The page whose requests should be intercepted.
 * @author Claude
 */
export const mockGenerationError = async ( page: Page ): Promise<void> =>
{
    await page.route( MESSAGES_URL, ( route ) => route.fulfill( { status: 500, contentType: "application/json", body: "{}" } ) );
};

/**
 * Fills in a valid key and validates it, unlocking the generation options.
 * Assumes the AI generator screen is already open and the Models API stubbed.
 *
 * @param page - The page currently on the AI generator screen.
 * @author Claude
 */
export const unlockGenerator = async ( page: Page ): Promise<void> =>
{
    await page.getByLabel( "ANTHROPIC API KEY" ).fill( "sk-ant-valid" );
    await page.getByRole( "button", { name: "Validate" } ).click();
};
