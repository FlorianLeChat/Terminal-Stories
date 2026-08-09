import type { Locator, Page } from "@playwright/test";

/**
 * Locates the currently-active button for a numbered choice (`[1] ...`). The
 * terminal keeps its whole scrollback on screen, so earlier scenes may still
 * show a button with the same index — `.last()` always targets the live scene.
 *
 * @param page - The page currently on the story view.
 * @param choiceIndex - The 1-based choice index as displayed.
 * @returns A locator for the matching choice button.
 * @author Claude
 */
export const choiceButton = ( page: Page, choiceIndex: number ): Locator =>
    page.getByRole( "button", { name: new RegExp( `^\\s*\\[${ choiceIndex }\\]` ) } ).last();

/**
 * Flushes the typewriter animation via the app's own space-to-skip shortcut,
 * without letting the keypress land on whatever button is still focused from
 * the previous click. A focused `<button>` natively activates on Space, so
 * pressing it blindly would silently re-click the last choice instead of just
 * skipping the animation.
 *
 * @param page - The page currently on the story view.
 * @author Claude
 */
export const skipTypewriter = async ( page: Page ): Promise<void> =>
{
    await page.evaluate( () => ( document.activeElement as HTMLElement | null )?.blur() );
    await page.keyboard.press( " " );
};

/**
 * Plays a full choice path to its ending, flushing the typewriter before each
 * click so the test never races the animation.
 *
 * @param page - The page currently on the story view.
 * @param path - The ordered 1-based choice indices to take.
 * @author Claude
 */
export const playPath = async ( page: Page, path: number[] ): Promise<void> =>
{
    for ( const choiceIndex of path )
    {
        await skipTypewriter( page );
        await choiceButton( page, choiceIndex ).click();
    }

    await skipTypewriter( page );
};
