import type { Action } from "svelte/action";

/**
 * Svelte action that hides an `<img>` whose source fails to load, so a missing
 * icon leaves a clean gap instead of the browser's broken-image glyph.
 *
 * @param node - The image element to guard.
 * @returns The action teardown removing the listener.
 * @author Claude
 */
export const hideOnError: Action<HTMLImageElement> = ( node ) =>
{
    const hide = () =>
    {
        node.style.visibility = "hidden";
    };

    node.addEventListener( "error", hide );

    return {
        destroy: () =>
        {
            node.removeEventListener( "error", hide );
        }
    };
};
