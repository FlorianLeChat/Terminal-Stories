import * as m from "$lib/locales/messages";
import type { AiErrorCode } from "$lib/types/ai";

/**
 * An AI failure carrying a machine-readable {@link AiErrorCode} instead of
 * localized text, so the UI can render a translatable message.
 *
 * @author Claude
 */
export class AiError extends Error
{
    readonly code: AiErrorCode;
    readonly status?: number;

    constructor( code: AiErrorCode, status?: number )
    {
        super( code );
        this.name = "AiError";
        this.code = code;
        this.status = status;
    }
}

/**
 * Resolves any thrown value into a translatable, user-facing message. Known
 * {@link AiError} codes map to dedicated Paraglide messages; anything else
 * falls back to a generic message.
 *
 * @param error - The value caught from a failed AI operation.
 * @returns A localized message for display.
 * @author Claude
 */
export const aiErrorMessage = ( error: unknown ): string =>
{
    if ( !( error instanceof AiError ) ) return m.ai_err_unknown();

    switch ( error.code )
    {
        case "network": return m.ai_err_network();
        case "auth": return m.ai_err_auth();
        case "rate_limit": return m.ai_err_rate_limit();
        case "bad_request": return m.ai_err_bad_request();
        case "api": return m.ai_err_api( { status: error.status ?? 0 } );
        case "empty_response": return m.ai_err_empty();
        case "no_json": return m.ai_err_no_json();
        case "invalid_json": return m.ai_err_invalid_json();
        case "not_object": return m.ai_err_not_object();
        case "no_scenes": return m.ai_err_no_scenes();
        case "no_scene_ids": return m.ai_err_no_scene_ids();
        case "no_ending": return m.ai_err_no_ending();
        default: return m.ai_err_unknown();
    }
};
