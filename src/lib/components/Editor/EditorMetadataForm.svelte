<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import type { MusicTheme, PhosphorTheme, StoryFile } from "#lib";
    import { KNOWN_GENRES, MUSIC_THEMES, PHOSPHOR_THEMES, genreLabel, musicThemeLabel, resolvePhosphor } from "#lib";

    interface Props {
        /** The story draft being edited (mutated in place). */
        draft: StoryFile;
    }

    let { draft = $bindable() }: Props = $props();

    /**
     * Preset genre codes, plus the draft's own value when it is a free-text
     * genre (e.g. from an imported story) so the select can show it.
     *
     * @author Claude
     */
    let genreOptions = $derived(
        KNOWN_GENRES.includes( draft.genre ) ? KNOWN_GENRES : [ draft.genre, ...KNOWN_GENRES ]
    );

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

    /** Localized name of each phosphor theme. */
    const PHOSPHOR_LABELS: Record<PhosphorTheme, () => string> = {
        green: m.phosphor_green,
        amber: m.phosphor_amber,
        cyan: m.phosphor_cyan
    };

    /**
     * Phosphor the story will actually be shown in, previewed live by the swatch
     * through `data-phosphor` so it renders with the real colors.
     *
     * @author Claude
     */
    let effectivePhosphor = $derived( resolvePhosphor( draft ) );

    /**
     * Applies the picked phosphor, removing the field entirely when
     * "automatic" is selected so the story follows its genre.
     *
     * @param event - The select change event.
     * @author Claude
     */
    const handlePhosphorChange = ( event: Event ) =>
    {
        const value = ( event.currentTarget as HTMLSelectElement ).value;

        if ( value === "" )
        {
            delete draft.phosphor;
        }
        else
        {
            draft.phosphor = value as PhosphorTheme;
        }
    };
</script>

<fieldset class="border-t border-terminal-dim/30 pt-2 space-y-3 mb-4">
    <legend class="pr-2 select-none"><h3 class="text-terminal-white text-base font-bold tracking-widest">{m.editor_metadata_legend()}</h3></legend>

    <div class="space-y-1">
        <label for="editor-title" class="block text-terminal-dim text-xs select-none">{m.editor_title_label()}</label>
        <input
            bind:value={draft.title}
            id="editor-title"
            type="text"
            class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green caret-terminal-green"
            autocomplete="off"
        />
    </div>

    <div class="space-y-1">
        <label for="editor-description" class="block text-terminal-dim text-xs select-none">{m.editor_description_label()}</label>
        <textarea
            bind:value={draft.description}
            id="editor-description"
            rows="2"
            class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green caret-terminal-green resize-none"
        ></textarea>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="space-y-1 min-w-0">
            <label for="editor-genre" class="block text-terminal-dim text-xs select-none">{m.editor_genre_label()}</label>
            <select
                bind:value={draft.genre}
                id="editor-genre"
                class="w-full bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green"
            >
                {#each genreOptions as genre ( genre )}
                    <option value={genre}>{genreLabel( genre )}</option>
                {/each}
            </select>
        </div>

        <div class="space-y-1 min-w-0">
            <label for="editor-language" class="block text-terminal-dim text-xs select-none">{m.editor_language_label()}</label>
            <input
                bind:value={draft.language}
                id="editor-language"
                type="text"
                class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green caret-terminal-green"
                autocomplete="off"
            />
        </div>

        <div class="space-y-1 min-w-0">
            <label for="editor-universe" class="block text-terminal-dim text-xs select-none">{m.editor_universe_label()}</label>
            <input
                bind:value={draft.universe}
                id="editor-universe"
                type="text"
                class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green caret-terminal-green"
                autocomplete="off"
            />
        </div>
    </div>

    <div class="space-y-1 min-w-0">
        <label for="editor-music" class="block text-terminal-dim text-xs select-none">{m.editor_music_label()}</label>
        <select
            id="editor-music"
            value={draft.music ?? ""}
            class="w-full bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green"
            onchange={handleMusicChange}
        >
            <option value="">{m.editor_music_none()}</option>

            {#each MUSIC_THEMES as theme ( theme )}
                <option value={theme}>{musicThemeLabel( theme )}</option>
            {/each}
        </select>
    </div>

    <div class="space-y-1 min-w-0">
        <label for="editor-phosphor" class="block text-terminal-dim text-xs select-none">{m.editor_phosphor_label()}</label>

        <div class="flex items-center gap-2">
            <select
                id="editor-phosphor"
                value={draft.phosphor ?? ""}
                class="flex-1 min-w-0 bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green"
                onchange={handlePhosphorChange}
            >
                <option value="">{m.editor_phosphor_auto()} · {PHOSPHOR_LABELS[ resolvePhosphor( { genre: draft.genre } ) ]()}</option>

                {#each PHOSPHOR_THEMES as theme ( theme )}
                    <option value={theme}>{PHOSPHOR_LABELS[ theme ]()}</option>
                {/each}
            </select>

            <output
                data-phosphor={effectivePhosphor}
                class="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-terminal-green bg-terminal-bg text-sm"
                aria-label={m.editor_phosphor_preview_aria()}
            >
                <span class="text-terminal-white font-bold">Aa</span>
                <span class="text-terminal-text">{PHOSPHOR_LABELS[ effectivePhosphor ]()}</span>
                <span class="text-terminal-cyan" aria-hidden="true">[1]</span>
            </output>
        </div>
    </div>
</fieldset>
