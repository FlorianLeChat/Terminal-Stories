import type { StoryFile } from "#lib/types/story.ts";

/** An unsaved editor draft kept on the device, in case the tab closes. */
export interface EditorDraft {
    /** The draft story, as last edited. */
    story: StoryFile;
    /** Epoch ms of the last edit. */
    savedAt: number;
}

/**
 * Builds the localStorage key of a custom story's unsaved draft.
 *
 * @param storyId - The custom story identifier.
 * @returns The namespaced key string.
 * @author Claude
 */
const draftKey = ( storyId: string ): string => `terminal-stories:editor-draft:${ storyId }`;

/**
 * Keeps the editor's unsaved draft on the device, so an unexpected close
 * (tab closed, crash, reload) never loses the work. Storage failures (quota,
 * private mode) are ignored: the draft is a safety net, not the save.
 *
 * @param storyId - The custom story being edited.
 * @param story - The current draft.
 * @author Claude
 */
export const saveEditorDraft = ( storyId: string, story: StoryFile ): void =>
{
    if ( globalThis.window === undefined ) return;

    const draft: EditorDraft = { story, savedAt: Date.now() };

    try
    {
        localStorage.setItem( draftKey( storyId ), JSON.stringify( draft ) );
    }
    catch
    {
        // The safety net is best effort: a full storage must not break editing.
    }
};

/**
 * Reads the unsaved draft kept for a custom story, if any.
 *
 * @param storyId - The custom story identifier.
 * @returns The draft, or `null` when none is kept or it is unreadable.
 * @author Claude
 */
export const loadEditorDraft = ( storyId: string ): EditorDraft | null =>
{
    if ( globalThis.window === undefined ) return null;

    const raw = localStorage.getItem( draftKey( storyId ) );
    if ( !raw ) return null;

    try
    {
        return JSON.parse( raw ) as EditorDraft;
    }
    catch
    {
        return null;
    }
};

/**
 * Drops the unsaved draft of a custom story (saved, or discarded on purpose).
 *
 * @param storyId - The custom story identifier.
 * @author Claude
 */
export const clearEditorDraft = ( storyId: string ): void =>
{
    if ( globalThis.window === undefined ) return;

    localStorage.removeItem( draftKey( storyId ) );
};
