import type { StoryFile } from "$lib/types/story";

/**
 * Machine-readable failure codes for custom-story operations (import, save,
 * storage). The UI maps each code to a translatable Paraglide message; no
 * user-facing sentence is ever carried by these codes.
 */
export type CustomStoryErrorCode
    = | "invalid_json"
      | "not_object"
      | "no_scenes"
      | "no_scene_ids"
      | "no_ending"
      | "too_large"
      | "quota_exceeded"
      | "not_found"
      | "unknown";

/**
 * A user-created (or forked/imported) story persisted in the browser's
 * localStorage, wrapped with local-only metadata. Custom stories are private:
 * they never leave the device unless the user exports them explicitly.
 */
export interface CustomStoryRecord {
    /** The story content itself, in the same on-disk shape as bundled stories. */
    story: StoryFile;
    /** Epoch ms when this custom story was created (or imported). */
    createdAt: number;
    /** Epoch ms of the last edit. */
    updatedAt: number;
    /** Id of the bundled story this one was forked from, when applicable. */
    forkedFrom?: string;
}
