<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import EditorMetadataForm from "./EditorMetadataForm.svelte";
    import EditorCharactersForm from "./EditorCharactersForm.svelte";
    import EditorSceneList from "./EditorSceneList.svelte";
    import EditorSceneForm from "./EditorSceneForm.svelte";
    import type { Scene, StoryFile } from "$lib";
    import { customStoryErrorMessage, getCustomStory, hasReachableEnding, saveCustomStory } from "$lib";

    // The edited id is set before this view mounts and never changes while it
    // is displayed, so the record can be loaded once at init.
    const record = getCustomStory( $terminal.editingStoryId ?? "" );
    const missing = record === null;

    // The draft is a deep copy: nothing touches the stored record until the
    // user explicitly saves.
    let draft = $state<StoryFile>(
        record
            ? structuredClone( record.story )
            : { id: "", title: "", genre: "", language: "", universe: "", description: "", characters: [], startScene: "", scenes: [] }
    );

    let selectedSceneId = $state( record ? record.story.startScene : "" );

    /** True right after a successful save, until the next attempt. */
    let savedFeedback = $state( false );

    /** Translated message of the last failed save, or null. */
    let saveError = $state<string | null>( null );

    // Live validation summary: broken choice targets and ending reachability,
    // recomputed as the draft changes so authors see problems before saving.
    let issues = $derived.by( () =>
    {
        const list: string[] = [];

        // Null prototype: scene ids are user-controlled property names.
        const sceneMap: Record<string, Scene> = Object.create( null );
        for ( const scene of draft.scenes ) sceneMap[ scene.id ] = scene;

        if ( !hasReachableEnding( sceneMap, draft.startScene ) )
        {
            list.push( m.editor_issue_no_ending() );
        }

        for ( const scene of draft.scenes )
        {
            for ( const choice of scene.choices )
            {
                if ( !sceneMap[ choice.nextScene ] )
                {
                    list.push( m.editor_issue_broken_choice( { scene: scene.id, target: choice.nextScene } ) );
                }
            }
        }

        return list;
    } );

    /**
     * Appends a new scene with a unique id and selects it. The scene starts
     * choice-less, which the save pipeline treats as a neutral ending until
     * choices are added.
     *
     * @author Claude
     */
    const handleAddScene = () =>
    {
        // Walk the counter past any existing "scene-N" id to stay unique.
        let counter = draft.scenes.length + 1;
        let id = `scene-${ counter }`;

        while ( draft.scenes.some( ( scene ) => scene.id === id ) )
        {
            counter += 1;
            id = `scene-${ counter }`;
        }

        draft.scenes.push( { id, text: [ "" ], choices: [] } );
        selectedSceneId = id;
    };

    /**
     * Runs the draft through the full validation/sanitization pipeline and
     * persists it, then reloads the draft from the normalized result so the
     * editor reflects exactly what was stored (pruned choices, clamped text...).
     *
     * @author Claude
     */
    const handleSave = () =>
    {
        saveError = null;
        savedFeedback = false;

        try
        {
            const saved = saveCustomStory( $state.snapshot( draft ) as StoryFile );

            draft = structuredClone( saved.story );

            const selectionStillExists = draft.scenes.some( ( scene ) => scene.id === selectedSceneId );
            if ( !selectionStillExists ) selectedSceneId = draft.startScene;

            savedFeedback = true;
            terminal.bumpCustomStories();
        }
        catch ( error )
        {
            saveError = customStoryErrorMessage( error );
        }
    };
</script>

<div class="flex-1 overflow-y-auto px-4 py-2">
    <TerminalLogo subtitle={m.editor_subtitle()} />

    {#if missing}
        <p class="border border-terminal-amber/60 text-terminal-amber text-xs rounded px-3 py-2 my-4" role="alert">
            {m.custom_err_not_found()}
        </p>
    {:else}
        <p class="text-terminal-dim text-xs text-center my-4">{m.editor_unsaved_hint()}</p>

        <EditorMetadataForm bind:draft />
        <EditorCharactersForm bind:draft />

        <div class="flex flex-col sm:flex-row gap-3 mb-3">
            <EditorSceneList
                {draft}
                {selectedSceneId}
                onselect={( id ) => { selectedSceneId = id; }}
                onadd={handleAddScene}
            />

            <EditorSceneForm bind:draft bind:selectedSceneId />
        </div>

        {#if issues.length > 0}
            <section class="border border-terminal-amber/60 rounded px-3 py-2 mb-3" aria-label={m.editor_issues_title()}>
                <h3 class="text-terminal-amber text-xs pb-1 select-none">{m.editor_issues_title()}</h3>

                <ul class="space-y-0.5">
                    {#each issues as issue, i ( i )}
                        <li class="text-terminal-amber/80 text-xs">· {issue}</li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if saveError}
            <p class="border border-terminal-amber/60 text-terminal-amber text-xs rounded px-3 py-2 mb-3" role="alert">
                {saveError}
            </p>
        {/if}

        <div class="flex items-center gap-3 pb-4">
            <button
                type="button"
                class="px-3 py-1 rounded border border-terminal-green text-terminal-green text-xs hover:bg-terminal-green/15 motion-safe:transition-colors motion-safe:duration-100"
                onclick={handleSave}
            >
                {m.editor_save()}
            </button>

            {#if savedFeedback}
                <output class="text-terminal-green text-xs">{m.editor_saved()}</output>
            {/if}
        </div>
    {/if}
</div>
