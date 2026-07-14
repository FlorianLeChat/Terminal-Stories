<script lang="ts">
    import * as m from "$lib/locales/messages";
    import type { StoryFile } from "$lib";

    interface Props {
        /** The story draft being edited (mutated in place). */
        draft: StoryFile;
        /** Id of the scene owning the choice. */
        sceneId: string;
        /** Position of the choice within the scene. */
        index: number;
    }

    let { draft = $bindable(), sceneId, index }: Props = $props();

    let scene = $derived( draft.scenes.find( ( s ) => s.id === sceneId ) );
    let choice = $derived( scene?.choices[ index ] );

    /**
     * Applies an optional flag field ("requiresFlag"/"setsFlag"), removing the
     * property entirely when the input is emptied.
     *
     * @param field - The flag field to update.
     * @param event - The input change event.
     * @author Claude
     */
    const handleFlagChange = ( field: "requiresFlag" | "setsFlag", event: Event ) =>
    {
        if ( !choice ) return;

        const value = ( event.currentTarget as HTMLInputElement ).value.trim();

        if ( value !== "" )
        {
            choice[ field ] = value;
        }
        else if ( field === "requiresFlag" )
        {
            delete choice.requiresFlag;
        }
        else
        {
            delete choice.setsFlag;
        }
    };

    /**
     * Removes this choice from its scene.
     *
     * @author Claude
     */
    const handleRemove = () =>
    {
        scene?.choices.splice( index, 1 );
    };
</script>

{#if scene && choice}
    <li class="border border-terminal-dim/30 rounded px-3 py-2 space-y-2">
        <div class="flex gap-2 items-end flex-wrap">
            <div class="space-y-1 flex-1 min-w-40">
                <label for={`editor-choice-text-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_text_label()}
                </label>
                <input
                    bind:value={choice.text}
                    id={`editor-choice-text-${ index }`}
                    type="text"
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                />
            </div>

            <div class="space-y-1 w-40">
                <label for={`editor-choice-target-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_target_label()}
                </label>
                <select
                    bind:value={choice.nextScene}
                    id={`editor-choice-target-${ index }`}
                    class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                >
                    {#each draft.scenes as target ( target.id )}
                        <option value={target.id}>{target.id}</option>
                    {/each}
                </select>
            </div>

            <button
                type="button"
                class="text-xs px-2 py-1 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100"
                onclick={handleRemove}
            >
                {m.editor_choice_remove()}
            </button>
        </div>

        <div class="flex gap-2 flex-wrap">
            <div class="space-y-1 flex-1 min-w-40">
                <label for={`editor-choice-action-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_action_label()}
                </label>
                <input
                    bind:value={choice.action}
                    id={`editor-choice-action-${ index }`}
                    type="text"
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                />
            </div>

            <div class="space-y-1 flex-1 min-w-40">
                <label for={`editor-choice-consequence-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_consequence_label()}
                </label>
                <input
                    bind:value={choice.consequence}
                    id={`editor-choice-consequence-${ index }`}
                    type="text"
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                />
            </div>
        </div>

        <div class="flex gap-2 flex-wrap">
            <div class="space-y-1 flex-1 min-w-32">
                <label for={`editor-choice-requires-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_requires_label()}
                </label>
                <input
                    id={`editor-choice-requires-${ index }`}
                    type="text"
                    value={choice.requiresFlag ?? ""}
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                    onchange={( e ) => handleFlagChange( "requiresFlag", e )}
                />
            </div>

            <div class="space-y-1 flex-1 min-w-32">
                <label for={`editor-choice-sets-${ index }`} class="block text-terminal-dim text-xs select-none">
                    {m.editor_choice_sets_label()}
                </label>
                <input
                    id={`editor-choice-sets-${ index }`}
                    type="text"
                    value={choice.setsFlag ?? ""}
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                    onchange={( e ) => handleFlagChange( "setsFlag", e )}
                />
            </div>
        </div>
    </li>
{/if}
