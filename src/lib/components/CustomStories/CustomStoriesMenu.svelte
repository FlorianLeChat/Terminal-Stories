<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import type { CustomStoryRecord } from "$lib";
    import { customStoryErrorMessage,
        deleteCustomStory,
        exportCustomStory,
        genreColor,
        genreLabel,
        getStory,
        importCustomStory,
        listCustomStories } from "$lib";

    interface Props {
        /** Creates a blank custom story and opens it in the editor. */
        oncreate: () => void;
    }

    let { oncreate }: Props = $props();

    let selectedIndex = $derived( $terminal.customSelectedIndex );

    // Re-read the stored list whenever the store signals a storage change
    // (save, import, delete), keeping this view in sync without a reload.
    let records = $derived.by( () =>
    {
        void $terminal.customStoriesVersion;

        return listCustomStories();
    } );

    /** Translated message of the last failed operation, or null. */
    let actionError = $state<string | null>( null );

    let fileInputEl: HTMLInputElement | undefined = $state();

    /**
     * Resolves the title of the bundled story a record was forked from, when
     * that origin still exists in the catalog.
     *
     * @param record - The custom story record to inspect.
     * @returns The origin's title, or `null` when not applicable.
     * @author Claude
     */
    const forkOriginTitle = ( record: CustomStoryRecord ): string | null =>
    {
        if ( !record.forkedFrom ) return null;

        const origin = getStory( record.forkedFrom );

        return origin ? origin.title : null;
    };

    /**
     * Opens the info screen of a custom story so it can be played.
     *
     * @param id - The custom story id.
     * @author Claude
     */
    const handlePlay = ( id: string ) =>
    {
        terminal.selectStory( id );
    };

    /**
     * Opens the editor on a custom story.
     *
     * @param id - The custom story id.
     * @author Claude
     */
    const handleEdit = ( id: string ) =>
    {
        terminal.openEditor( id );
    };

    /**
     * Exports a custom story as a downloadable JSON file.
     *
     * @param id - The custom story id.
     * @author Claude
     */
    const handleExport = ( id: string ) =>
    {
        try
        {
            const { filename, json } = exportCustomStory( id );
            const blob = new Blob( [ json ], { type: "application/json" } );
            const url = URL.createObjectURL( blob );

            const anchor = document.createElement( "a" );
            anchor.href = url;
            anchor.download = filename;
            anchor.click();

            URL.revokeObjectURL( url );
        }
        catch ( error )
        {
            actionError = customStoryErrorMessage( error );
        }
    };

    /**
     * Deletes a custom story (with its save and endings) after confirmation.
     *
     * @param record - The record to delete.
     * @author Claude
     */
    const handleDelete = ( record: CustomStoryRecord ) =>
    {
        const confirmed = confirm( m.custom_delete_confirm( { title: record.story.title } ) );
        if ( !confirmed ) return;

        deleteCustomStory( record.story.id );
        terminal.bumpCustomStories();
    };

    /**
     * Reads the picked file and imports it as a new custom story, surfacing a
     * translated error when the file is rejected by the validation pipeline.
     *
     * @param event - The file input change event.
     * @author Claude
     */
    const handleImportFile = async ( event: Event ) =>
    {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[ 0 ];

        // Allow re-picking the same file later (change wouldn't fire otherwise).
        input.value = "";

        if ( !file ) return;

        actionError = null;

        try
        {
            const text = await file.text();
            importCustomStory( text );
            terminal.bumpCustomStories();
        }
        catch ( error )
        {
            actionError = customStoryErrorMessage( error );
        }
    };
</script>

<div class="flex-1 overflow-y-auto px-4 py-2">
    <TerminalLogo subtitle={m.custom_subtitle()} />

    <p class="text-terminal-dim text-xs text-center my-4">{m.custom_intro()}</p>

    <div class="flex items-center gap-2 flex-wrap mb-4">
        <button
            class="text-xs px-2 py-1.5 sm:py-1 rounded border border-terminal-green/60 text-terminal-green hover:bg-terminal-green/10 motion-safe:transition-colors motion-safe:duration-100"
            onclick={oncreate}
        >
            {m.custom_new_button()}
        </button>

        <button
            class="text-xs px-2 py-1.5 sm:py-1 rounded border border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 motion-safe:transition-colors motion-safe:duration-100"
            onclick={() => fileInputEl?.click()}
        >
            {m.custom_import_button()}
        </button>

        <input
            bind:this={fileInputEl}
            type="file"
            accept=".json,application/json"
            class="hidden"
            aria-label={m.custom_import_button()}
            onchange={handleImportFile}
        />
    </div>

    {#if actionError}
        <p class="border border-terminal-amber/60 text-terminal-amber text-xs rounded px-3 py-2 mb-4" role="alert">
            {actionError}
        </p>
    {/if}

    {#if records.length === 0}
        <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
            <p>{m.custom_empty()}</p>
        </div>
    {:else}
        <ol class="border border-terminal-dim rounded px-2 py-1 mb-2">
            {#each records as record, i ( record.story.id )}
                {@const origin = forkOriginTitle( record )}
                {@const isSelected = i === selectedIndex}

                <li class={i < records.length - 1 ? "border-b border-terminal-dim/20" : ""}>
                    <article
                        class="w-full text-left px-3 py-3 rounded motion-safe:transition-all motion-safe:duration-100 {isSelected
                            ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                            : "border-l-2 border-transparent hover:bg-white/5"}"
                        aria-current={isSelected ? "true" : undefined}
                        onpointerenter={( e ) => { if ( e.pointerType === "mouse" ) terminal.navigateCustom( i ); }}
                    >
                        <header class="flex items-baseline gap-3 mb-2">
                            <span class="text-terminal-dim text-xs w-4 shrink-0">{i + 1}.</span>
                            <h3 class="text-terminal-white font-bold text-sm flex-1 min-w-0 truncate">{record.story.title}</h3>
                        </header>

                        <p class="flex items-center gap-2 flex-wrap mb-2 pl-7">
                            <span class="text-xs {genreColor( record.story.genre )} shrink-0">[{genreLabel( record.story.genre )}]</span>
                            <span class="text-terminal-dim text-xs shrink-0">· {record.story.language}</span>
                            <span class="text-terminal-dim text-xs shrink-0">
                                · {m.custom_scene_count( { count: record.story.scenes.length } )}
                            </span>

                            {#if origin}
                                <span class="text-terminal-amber text-xs shrink-0">⑂ {m.custom_forked_from( { title: origin } )}</span>
                            {/if}
                        </p>

                        <p class="pl-7 mb-2">
                            <time datetime={new Date( record.updatedAt ).toISOString()} class="text-terminal-dim/70 text-xs">
                                {m.custom_updated_at( { date: new Date( record.updatedAt ).toLocaleDateString() } )}
                            </time>
                        </p>

                        <nav class="flex items-center gap-1.5 flex-wrap pl-7">
                            <button
                                class="text-xs px-2 py-1 rounded border border-terminal-green/60 text-terminal-green hover:bg-terminal-green/10 motion-safe:transition-colors motion-safe:duration-100"
                                onclick={() => handlePlay( record.story.id )}
                            >
                                {m.custom_play_button()}
                            </button>

                            <button
                                class="text-xs px-2 py-1 rounded border border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 motion-safe:transition-colors motion-safe:duration-100"
                                onclick={() => handleEdit( record.story.id )}
                            >
                                {m.custom_edit_button()}
                            </button>

                            <button
                                class="text-xs px-2 py-1 rounded border border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                                onclick={() => handleExport( record.story.id )}
                            >
                                {m.custom_export_button()}
                            </button>

                            <button
                                class="text-xs px-2 py-1 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100"
                                onclick={() => handleDelete( record )}
                            >
                                {m.custom_delete_button()}
                            </button>
                        </nav>
                    </article>
                </li>
            {/each}
        </ol>
    {/if}
</div>
