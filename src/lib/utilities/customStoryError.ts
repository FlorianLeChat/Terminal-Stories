import * as m from "$lib/locales/messages";
import type { CustomStoryErrorCode } from "$lib/types/customStory";

/**
 * A custom-story failure carrying a machine-readable
 * {@link CustomStoryErrorCode} instead of localized text, so the UI can render
 * a translatable message.
 *
 * @author Claude
 */
export class CustomStoryError extends Error
{
    readonly code: CustomStoryErrorCode;

    constructor( code: CustomStoryErrorCode )
    {
        super( code );
        this.name = "CustomStoryError";
        this.code = code;
    }
}

/**
 * Resolves any thrown value into a translatable, user-facing message. Known
 * {@link CustomStoryError} codes map to dedicated Paraglide messages; anything
 * else falls back to a generic message.
 *
 * @param error - The value caught from a failed custom-story operation.
 * @returns A localized message for display.
 * @author Claude
 */
export const customStoryErrorMessage = ( error: unknown ): string =>
{
    if ( !( error instanceof CustomStoryError ) ) return m.custom_err_unknown();

    switch ( error.code )
    {
        case "invalid_json": return m.custom_err_invalid_json();
        case "not_object": return m.custom_err_not_object();
        case "no_scenes": return m.custom_err_no_scenes();
        case "no_scene_ids": return m.custom_err_no_scene_ids();
        case "no_ending": return m.custom_err_no_ending();
        case "too_large": return m.custom_err_too_large();
        case "quota_exceeded": return m.custom_err_quota();
        case "not_found": return m.custom_err_not_found();
        default: return m.custom_err_unknown();
    }
};
