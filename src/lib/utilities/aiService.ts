import type { AiErrorCode, AiGenerationParams, AiModelOption, AiSettings } from "$lib/types/ai";
import type { Story } from "$lib/types/story";
import { AiError } from "$lib/utilities/aiError";
import { normalizeGeneratedStory } from "$lib/utilities/storyValidation";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODELS_URL = "https://api.anthropic.com/v1/models?limit=1000";
const API_VERSION = "2023-06-01";

// Generous ceiling: a branching story with ~10-15 scenes fits well under this,
// and a non-streaming request stays within the SDK/HTTP timeout at this size.
const MAX_TOKENS = 16000;

/**
 * Builds the system prompt describing the exact story schema the model must
 * produce. The graph is requested with scenes as an array (more reliable to
 * generate than a keyed map); {@link normalizeGeneratedStory} converts it.
 *
 * @returns The system prompt string.
 * @author Claude
 */
const buildSystemPrompt = (): string =>
{
    return [
        "You generate self-contained, branching interactive fiction for a terminal-style reader.",
        "Return ONLY a single JSON object — no markdown, no code fences, no commentary before or after.",
        "",
        "The JSON object must match this shape exactly:",
        "{",
        "  \"title\": string,",
        "  \"genre\": string,",
        "  \"language\": string,",
        "  \"universe\": string,            // short name of the story world",
        "  \"description\": string,         // 1-2 sentence teaser",
        "  \"tags\": string[],",
        "  \"characters\": [ { \"id\": string, \"name\": string, \"role\": \"protagonist\"|\"antagonist\"|\"ally\"|\"npc\"|\"narrator\" } ],",
        "  \"startScene\": string,          // must equal one scene id",
        "  \"scenes\": [",
        "    {",
        "      \"id\": string,              // unique, kebab-case",
        "      \"text\": string[],          // narration paragraphs",
        "      \"speaker\": string,         // OPTIONAL: a character id when someone speaks",
        "      \"isEnding\": boolean,       // OPTIONAL: true for terminal scenes",
        "      \"endingType\": \"good\"|\"bad\"|\"neutral\", // OPTIONAL, only on endings",
        "      \"choices\": [",
        "        { \"id\": string, \"text\": string, \"action\": string, \"consequence\": string, \"nextScene\": string }",
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
        "Rules:",
        "- Every choice.nextScene MUST reference an existing scene id.",
        "- Non-ending scenes have 2-3 choices; ending scenes have an empty choices array and isEnding=true.",
        "- Provide several distinct endings (good/bad/neutral) reachable from the start.",
        "- `action` is the player's gesture; `consequence` is what immediately follows. Keep both short.",
        "- Write ALL player-facing text (title, narration, choices, names...) in the requested language.",
        "- Make it atmospheric and coherent; avoid dead ends that are not flagged as endings."
    ].join( "\n" );
};

/**
 * Builds the user message describing the story to generate from the player's
 * parameters.
 *
 * @param params - The generation parameters.
 * @returns The user prompt string.
 * @author Claude
 */
const buildUserPrompt = ( params: AiGenerationParams ): string =>
{
    const premise = params.premise.trim() === "" ? "Surprise me with an original premise." : params.premise.trim();

    return [
        `Language: ${ params.language }`,
        `Genre: ${ params.genre }`,
        `Approximate number of scenes: ${ params.sceneCount }`,
        `Premise: ${ premise }`
    ].join( "\n" );
};

/**
 * Extracts the JSON object from the model's text output, tolerating stray
 * prose or code fences by slicing between the first `{` and the last `}`.
 *
 * @param text - The raw text returned by the model.
 * @returns The parsed JSON value.
 * @author Claude
 */
const parseStoryJson = ( text: string ): unknown =>
{
    const start = text.indexOf( "{" );
    const end = text.lastIndexOf( "}" );

    const hasObject = start !== -1 && end > start;
    if ( !hasObject ) throw new AiError( "no_json" );

    const candidate = text.slice( start, end + 1 );

    try
    {
        return JSON.parse( candidate );
    }
    catch
    {
        throw new AiError( "invalid_json" );
    }
};

/**
 * Maps an HTTP error status from the Anthropic API to a machine-readable
 * {@link AiErrorCode}. The UI turns the code into a translatable message.
 *
 * @param status - The HTTP status code.
 * @returns The matching error code.
 * @author Claude
 */
const codeForStatus = ( status: number ): AiErrorCode =>
{
    if ( status === 401 ) return "auth";
    if ( status === 429 ) return "rate_limit";
    if ( status === 400 ) return "bad_request";

    return "api";
};

/** Minimal shape of one entry in the Models API response. */
interface ModelEntry {
    id: string;
    display_name?: string;
    created_at?: string;
}

/**
 * Fetches the list of models available to the user's key from the Anthropic
 * Models API, newest first. Used to populate the model picker dynamically;
 * callers fall back to a curated list when this fails.
 *
 * @param settings - The user's API key (the model field is ignored here).
 * @returns The available models as `{ id, label }` options.
 * @throws {AiError} With an {@link AiErrorCode} on network or API failures.
 * @author Claude
 */
export const listModels = async ( settings: AiSettings ): Promise<AiModelOption[]> =>
{
    let response: Response;

    try
    {
        response = await fetch( MODELS_URL, {
            method: "GET",
            headers: {
                "x-api-key": settings.apiKey,
                "anthropic-version": API_VERSION,
                "anthropic-dangerous-direct-browser-access": "true"
            }
        } );
    }
    catch
    {
        throw new AiError( "network" );
    }

    if ( !response.ok ) throw new AiError( codeForStatus( response.status ), response.status );

    const payload = ( await response.json() ) as { data?: ModelEntry[] };
    const entries = Array.isArray( payload.data ) ? payload.data : [];

    // Newest models first, so the most capable recent ones sit at the top.
    const sorted = [ ...entries ].sort( ( a, b ) => ( b.created_at ?? "" ).localeCompare( a.created_at ?? "" ) );

    return sorted.map( ( entry ) => ( { id: entry.id, label: entry.display_name ?? entry.id } ) );
};

/** Minimal shape of the Messages API response we rely on. */
interface MessagesResponse {
    content?: { type: string; text?: string }[];
}

/**
 * Generates a complete, ephemeral interactive story by calling the Anthropic
 * Messages API directly from the browser with the user's own key. The result
 * is validated and normalized into a playable {@link Story}.
 *
 * @param params - The player's generation parameters.
 * @param settings - The user's API key and chosen model.
 * @returns The generated, validated story.
 * @throws {AiError} With an {@link AiErrorCode} on network, API, or invalid-output failures.
 * @author Claude
 */
export const generateStory = async ( params: AiGenerationParams, settings: AiSettings ): Promise<Story> =>
{
    let response: Response;

    try
    {
        response = await fetch( API_URL, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": settings.apiKey,
                "anthropic-version": API_VERSION,
                // Required to allow calling the API directly from a browser.
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify( {
                model: settings.model,
                max_tokens: MAX_TOKENS,
                system: buildSystemPrompt(),
                messages: [ { role: "user", content: buildUserPrompt( params ) } ]
            } )
        } );
    }
    catch
    {
        throw new AiError( "network" );
    }

    if ( !response.ok )
    {
        throw new AiError( codeForStatus( response.status ), response.status );
    }

    const payload = ( await response.json() ) as MessagesResponse;
    const textBlock = payload.content?.find( ( block ) => block.type === "text" );
    const text = textBlock?.text ?? "";

    if ( text.trim() === "" ) throw new AiError( "empty_response" );

    const parsed = parseStoryJson( text );

    return normalizeGeneratedStory( parsed );
};
