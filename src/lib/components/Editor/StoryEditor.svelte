<script lang="ts">
    import { onMount, untrack } from "svelte";
    import type { Scene, StoryFile } from "#lib";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import ViewTitle from "../Terminal/ViewTitle.svelte";
    import EditorSceneList from "./EditorSceneList.svelte";
    import EditorSceneForm from "./EditorSceneForm.svelte";
    import ConfirmDialog from "../Terminal/ConfirmDialog.svelte";
    import EditorMetadataForm from "./EditorMetadataForm.svelte";
    import EditorCharactersForm from "./EditorCharactersForm.svelte";
    import { clearEditorDraft, customStoryErrorMessage, getCustomStory, hasReachableEnding, isPhosphorTheme, loadEditorDraft, saveCustomStory, saveEditorDraft } from "#lib";

    /**
     * Custom story being edited, loaded once at init: the edited id is set
     * before this view mounts and never changes while it is displayed.
     *
     * @author Claude
     */
    const record = getCustomStory( $terminal.editingStoryId ?? "" );
    const missing = record === null;

    /**
     * Deep copy of the stored story: the record stays untouched until the user saves.
     *
     * @author Claude
     */
    let draft = $state<StoryFile>(
        record
            ? structuredClone( record.story )
            : { id: "", title: "", genre: "", language: "", universe: "", description: "", characters: [], startScene: "", scenes: [] }
    );

    /**
     * Serialized copy of the last stored version, compared against the draft to
     * know whether leaving now would lose work.
     *
     * @author Claude
     */
    let savedSnapshot = $state( record ? JSON.stringify( record.story ) : "" );
    let isDirty = $derived( !missing && JSON.stringify( draft ) !== savedSnapshot );

    $effect( () =>
    {
        terminal.setEditorDirty( isDirty );
    } );

    const storedDraft = record ? loadEditorDraft( record.story.id ) : null;
    const hasLeftoverDraft = storedDraft !== null && JSON.stringify( storedDraft.story ) !== untrack( () => savedSnapshot );

    /**
     * Unsaved draft left by a tab closed mid-edit, offered back unless it holds
     * nothing the stored story does not. Null once restored or discarded.
     *
     * @author Claude
     */
    let draftOffer = $state( hasLeftoverDraft ? storedDraft : null );

    /** Most undo steps kept; older ones are dropped. */
    const HISTORY_LIMIT = 100;
    /** Quiet time (ms) closing a burst of edits into one undo step. */
    const BURST_DELAY = 600;

    /**
     * Undo stack of serialized drafts (`future` is the redo stack). A burst of
     * edits (typing a word, a sentence) becomes a single step, closed after
     * `BURST_DELAY` of quiet.
     *
     * @author Claude
     */
    let past = $state<string[]>( [] );
    let future = $state<string[]>( [] );
    let lastSnapshot = untrack( () => JSON.stringify( draft ) );
    let isBurstOpen = false;
    let burstTimer: ReturnType<typeof setTimeout> | undefined;
    let isApplyingHistory = false;

    $effect( () =>
    {
        const current = JSON.stringify( draft );

        untrack( () =>
        {
            const isUnchanged = current === lastSnapshot;
            if ( isUnchanged ) return;

            // A restored step is not a new edit: it only becomes the baseline.
            if ( isApplyingHistory )
            {
                isApplyingHistory = false;
                lastSnapshot = current;
                return;
            }

            if ( !isBurstOpen )
            {
                past = [ ...past.slice( -( HISTORY_LIMIT - 1 ) ), lastSnapshot ];
                future = [];
                isBurstOpen = true;
            }

            lastSnapshot = current;

            clearTimeout( burstTimer );
            burstTimer = setTimeout( () =>
            {
                isBurstOpen = false;
            }, BURST_DELAY );
        } );
    } );

    // Mirror the dirty draft to the device; held back while a leftover draft is offered, not to overwrite it.
    $effect( () =>
    {
        if ( !record || draftOffer ) return;

        if ( isDirty ) saveEditorDraft( record.story.id, $state.snapshot( draft ) as StoryFile );
        else clearEditorDraft( record.story.id );
    } );

    // A story just created starts with its title selected, ready to be named.
    onMount( () =>
    {
        if ( !$terminal.editorIsNew ) return;

        const titleInput = document.getElementById( "editor-title" );
        if ( titleInput instanceof HTMLInputElement ) titleInput.select();
    } );

    let selectedSceneId = $state( record ? record.story.startScene : "" );

    /**
     * Brings back the draft left by an unexpected close.
     *
     * @author Claude
     */
    const restoreDraft = () =>
    {
        if ( !draftOffer ) return;

        // $state.snapshot, not structuredClone, which refuses $state proxies.
        draft = $state.snapshot( draftOffer.story ) as StoryFile;
        selectedSceneId = draft.startScene;
        draftOffer = null;
    };

    /**
     * Throws away the draft left by an unexpected close, keeping the stored story.
     *
     * @author Claude
     */
    const discardDraft = () =>
    {
        if ( record ) clearEditorDraft( record.story.id );

        draftOffer = null;
    };

    /**
     * Steps the draft back (undo) or forward (redo) through its history. The
     * selection falls back to the start scene when the selected scene does not
     * exist at that point of the history.
     *
     * @param direction - `-1` to undo, `1` to redo.
     * @author Claude
     */
    const stepHistory = ( direction: -1 | 1 ) =>
    {
        const source = direction === -1 ? past : future;
        const target = source[ source.length - 1 ];
        if ( target === undefined ) return;

        const current = JSON.stringify( draft );

        if ( direction === -1 )
        {
            past = past.slice( 0, -1 );
            future = [ ...future, current ];
        }
        else
        {
            future = future.slice( 0, -1 );
            past = [ ...past, current ];
        }

        clearTimeout( burstTimer );
        isBurstOpen = false;
        isApplyingHistory = true;
        draft = JSON.parse( target ) as StoryFile;

        const selectionExists = draft.scenes.some( ( scene ) => scene.id === selectedSceneId );
        if ( !selectionExists ) selectedSceneId = draft.startScene;
    };

    /** True right after a successful save, until the next attempt. */
    let savedFeedback = $state( false );

    /** Translated message of the last failed save, or null. */
    let saveError = $state<string | null>( null );

    /** A problem found in the draft, and the scene to fix it in when there is one. */
    interface DraftIssue {
        text: string;
        sceneId: string | null;
    }

    /**
     * Live validation summary (no reachable ending, unknown phosphor, broken
     * choice targets), recomputed as the draft changes so authors see problems
     * before saving.
     *
     * @author Claude
     */
    let issues = $derived.by( () =>
    {
        const list: DraftIssue[] = [];

        // Null prototype: scene ids are user-controlled property names.
        const sceneMap: Record<string, Scene> = Object.create( null );
        for ( const scene of draft.scenes ) sceneMap[ scene.id ] = scene;

        if ( !hasReachableEnding( sceneMap, draft.startScene ) )
        {
            list.push( { text: m.editor_issue_no_ending(), sceneId: draft.startScene } );
        }

        const hasUnknownPhosphor = draft.phosphor !== undefined && !isPhosphorTheme( draft.phosphor );
        if ( hasUnknownPhosphor ) list.push( { text: m.editor_issue_invalid_phosphor(), sceneId: null } );

        for ( const scene of draft.scenes )
        {
            for ( const choice of scene.choices )
            {
                if ( !sceneMap[ choice.nextScene ] )
                {
                    list.push( { text: m.editor_issue_broken_choice( { scene: scene.id, target: choice.nextScene } ), sceneId: scene.id } );
                }
            }
        }

        return list;
    } );

    /**
     * Opens the scene an issue is about and puts the focus in it, so the
     * author lands right where the fix goes.
     *
     * @param sceneId - The scene to open.
     * @author Claude
     */
    const goToIssue = ( sceneId: string ) =>
    {
        selectedSceneId = sceneId;

        // Wait for the scene form to switch to the selected scene.
        requestAnimationFrame( () => document.getElementById( "editor-scene-id" )?.focus() );
    };

    /**
     * Appends a new scene with a unique id and selects it. The scene starts
     * choice-less, which the save pipeline treats as a neutral ending until
     * choices are added.
     *
     * @author Claude
     */
    const handleAddScene = () =>
    {
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
     * Editor shortcuts: Ctrl+S / Cmd+S saves (instead of saving the page),
     * Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes, over the whole draft.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleEditorShortcut = ( e: KeyboardEvent ) =>
    {
        const hasModifier = e.ctrlKey || e.metaKey;
        if ( !hasModifier || missing ) return;

        const key = e.key.toLowerCase();
        const isSave = key === "s";
        const isUndo = key === "z" && !e.shiftKey;
        const isRedo = key === "y" || ( key === "z" && e.shiftKey );

        if ( isSave )
        {
            e.preventDefault();
            handleSave();
        }
        else if ( isUndo )
        {
            e.preventDefault();
            stepHistory( -1 );
        }
        else if ( isRedo )
        {
            e.preventDefault();
            stepHistory( 1 );
        }
    };

    /**
     * Leaves the editor discarding the unsaved changes on purpose: the draft
     * kept as a safety net goes too.
     *
     * @author Claude
     */
    const discardAndClose = () =>
    {
        if ( record ) clearEditorDraft( record.story.id );

        terminal.closeEditor();
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
            savedSnapshot = JSON.stringify( saved.story );

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

<svelte:window onkeydown={handleEditorShortcut} />

<!-- data-editor-root: where focus lands when ESC leaves a field, instead of the page body. -->
<div class="flex-1 overflow-y-auto px-4 py-2" tabindex="-1" data-editor-root>
    <ViewTitle title={m.editor_subtitle()} />

    {#if missing}
        <p class="border border-terminal-error/60 text-terminal-error text-xs rounded px-3 py-2 my-4" role="alert">
            {m.custom_err_not_found()}
        </p>
    {:else}
        <p class="text-terminal-dim text-xs text-center my-4">{m.editor_unsaved_hint()}</p>

        {#if draftOffer}
            <section class="border border-terminal-amber/60 rounded px-3 py-2 mb-4 flex flex-wrap items-center gap-2" aria-labelledby="editor-draft-title">
                <p id="editor-draft-title" class="text-terminal-amber text-sm flex-1 min-w-48">
                    {m.editor_draft_found( { date: new Date( draftOffer.savedAt ).toLocaleString() } )}
                </p>

                <button type="button" class="min-h-11 sm:min-h-8 px-3 rounded border border-terminal-green text-terminal-green text-sm hover:bg-terminal-green/15" onclick={restoreDraft}>
                    {m.editor_draft_restore()}
                </button>

                <button type="button" class="min-h-11 sm:min-h-8 px-3 rounded border border-terminal-dim/60 text-terminal-dim text-sm hover:text-terminal-white" onclick={discardDraft}>
                    {m.editor_draft_discard()}
                </button>
            </section>
        {/if}

        <EditorMetadataForm bind:draft />
        <EditorCharactersForm bind:draft />

        <div class="flex flex-col sm:flex-row gap-4 border-t border-terminal-dim/30 pt-4 mb-4">
            <EditorSceneList
                {draft}
                {selectedSceneId}
                onselect={( id ) => { selectedSceneId = id; }}
                onadd={handleAddScene}
            />

            <EditorSceneForm bind:draft bind:selectedSceneId />
        </div>

        {#if issues.length > 0}
            <section class="border border-terminal-amber/60 rounded px-3 py-2 mb-3" aria-labelledby="editor-issues-title">
                <h3 id="editor-issues-title" class="text-terminal-amber text-base font-bold tracking-widest pb-1 select-none">{m.editor_issues_title()}</h3>

                <ul class="space-y-0.5">
                    {#each issues as issue, i ( i )}
                        <li class="text-terminal-amber text-sm">
                            {#if issue.sceneId}
                                {@const sceneId = issue.sceneId}

                                <button type="button" class="min-h-6 text-left underline underline-offset-2 hover:text-terminal-white" onclick={() => goToIssue( sceneId )}>
                                    · {issue.text}
                                </button>
                            {:else}
                                · {issue.text}
                            {/if}
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if saveError}
            <p class="border border-terminal-error/60 text-terminal-error text-xs rounded px-3 py-2 mb-3" role="alert">
                {saveError}
            </p>
        {/if}

        <div class="flex items-center gap-3 flex-wrap pb-4">
            <button
                type="button"
                class="min-h-11 px-4 py-1 rounded border border-terminal-green text-terminal-green text-sm hover:bg-terminal-green/15 motion-safe:transition-colors motion-safe:duration-100"
                aria-keyshortcuts="Control+S Meta+S"
                onclick={handleSave}
            >
                {m.editor_save()}
                <kbd class="hidden sm:inline ml-2 text-xs text-terminal-dim font-[inherit]" aria-hidden="true">CTRL+S</kbd>
            </button>

            <button
                type="button"
                class="min-h-11 px-3 py-1 rounded border border-terminal-dim/60 text-terminal-dim text-sm hover:text-terminal-white hover:border-terminal-dim disabled:cursor-not-allowed disabled:border-terminal-dim/30 motion-safe:transition-colors motion-safe:duration-100"
                aria-keyshortcuts="Control+Z Meta+Z"
                disabled={past.length === 0}
                onclick={() => stepHistory( -1 )}
            >
                {m.editor_undo()}
                <kbd class="hidden sm:inline ml-2 text-xs font-[inherit]" aria-hidden="true">CTRL+Z</kbd>
            </button>

            <button
                type="button"
                class="min-h-11 px-3 py-1 rounded border border-terminal-dim/60 text-terminal-dim text-sm hover:text-terminal-white hover:border-terminal-dim disabled:cursor-not-allowed disabled:border-terminal-dim/30 motion-safe:transition-colors motion-safe:duration-100"
                aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z"
                disabled={future.length === 0}
                onclick={() => stepHistory( 1 )}
            >
                {m.editor_redo()}
                <kbd class="hidden sm:inline ml-2 text-xs font-[inherit]" aria-hidden="true">CTRL+Y</kbd>
            </button>

            {#if savedFeedback}
                <output class="text-terminal-green text-xs">{m.editor_saved()}</output>
            {/if}
        </div>
    {/if}
</div>

<ConfirmDialog
    open={$terminal.editorLeavePending}
    id="editor-leave"
    title={m.confirm_editor_leave_title()}
    description={m.confirm_editor_leave_desc()}
    confirmLabel={m.confirm_editor_leave_confirm()}
    cancelLabel={m.confirm_editor_leave_cancel()}
    onconfirm={discardAndClose}
    oncancel={terminal.cancelEditorLeave}
/>
