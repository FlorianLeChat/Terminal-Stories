<script lang="ts">
    import * as m from "$lib/locales/messages";
    import type { MusicTheme, StoryFile } from "$lib";
    import { KNOWN_GENRES, MUSIC_THEMES, genreLabel } from "$lib";

    interface Props {
        /** The story draft being edited (mutated in place). */
        draft: StoryFile;
    }

    let { draft = $bindable() }: Props = $props();

    // Offer the preset genre codes, plus the draft's own value when it is a
    // free-text genre (e.g. from an imported story) so the select shows it.
    let genreOptions = $derived(
        KNOWN_GENRES.includes( draft.genre ) ? KNOWN_GENRES : [ draft.genre, ...KNOWN_GENRES ]
    );

    /**
     * Rebuilds the tag list from the comma-separated input value.
     *
     * @param event - The input change event.
     * @author Claude
     */
    const handleTagsChange = ( event: Event ) =>
    {
        const value = ( event.currentTarget as HTMLInputElement ).value;

        draft.tags = value
            .split( "," )
            .map( ( tag ) => tag.trim() )
            .filter( ( tag ) => tag !== "" );
    };

    /**
     * Applies the picked default music theme, removing the field entirely when
     * the default option is selected.
     *
     * @param event - The select change event.
     * @author Claude
     */
    const handleMusicChange = ( event: Event ) =>
    {
        const value = ( event.currentTarget as HTMLSelectElement ).value;

        if ( value === "" )
        {
            delete draft.music;
        }
        else
        {
            draft.music = value as MusicTheme;
        }
    };
</script>

<fieldset class="border border-terminal-dim/40 rounded px-4 py-3 space-y-3 mb-3">
    <legend class="text-terminal-dim text-xs px-1 select-none">{m.editor_metadata_legend()}</legend>

    <div class="space-y-1">
        <label for="editor-title" class="block text-terminal-dim text-xs select-none">{m.editor_title_label()}</label>
        <input
            bind:value={draft.title}
            id="editor-title"
            type="text"
            class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
            autocomplete="off"
        />
    </div>

    <div class="space-y-1">
        <label for="editor-description" class="block text-terminal-dim text-xs select-none">{m.editor_description_label()}</label>
        <textarea
            bind:value={draft.description}
            id="editor-description"
            rows="2"
            class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green resize-none"
        ></textarea>
    </div>

    <div class="flex gap-3 flex-wrap">
        <div class="space-y-1 flex-1 min-w-32">
            <label for="editor-genre" class="block text-terminal-dim text-xs select-none">{m.editor_genre_label()}</label>
            <select
                bind:value={draft.genre}
                id="editor-genre"
                class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
            >
                {#each genreOptions as genre ( genre )}
                    <option value={genre}>{genreLabel( genre )}</option>
                {/each}
            </select>
        </div>

        <div class="space-y-1 flex-1 min-w-32">
            <label for="editor-language" class="block text-terminal-dim text-xs select-none">{m.editor_language_label()}</label>
            <input
                bind:value={draft.language}
                id="editor-language"
                type="text"
                class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                autocomplete="off"
            />
        </div>

        <div class="space-y-1 flex-1 min-w-32">
            <label for="editor-universe" class="block text-terminal-dim text-xs select-none">{m.editor_universe_label()}</label>
            <input
                bind:value={draft.universe}
                id="editor-universe"
                type="text"
                class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                autocomplete="off"
            />
        </div>
    </div>

    <div class="flex gap-3 flex-wrap">
        <div class="space-y-1 flex-1 min-w-32">
            <label for="editor-tags" class="block text-terminal-dim text-xs select-none">{m.editor_tags_label()}</label>
            <input
                id="editor-tags"
                type="text"
                value={draft.tags.join( ", " )}
                class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                autocomplete="off"
                onchange={handleTagsChange}
            />
        </div>

        <div class="space-y-1 flex-1 min-w-32">
            <label for="editor-music" class="block text-terminal-dim text-xs select-none">{m.editor_music_label()}</label>
            <select
                id="editor-music"
                value={draft.music ?? ""}
                class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                onchange={handleMusicChange}
            >
                <option value="">{m.editor_music_none()}</option>

                {#each MUSIC_THEMES as theme ( theme )}
                    <option value={theme}>{theme}</option>
                {/each}
            </select>
        </div>
    </div>
</fieldset>
