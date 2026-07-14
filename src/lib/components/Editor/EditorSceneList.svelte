<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { SvelteSet } from "svelte/reactivity";
    import type { StoryFile } from "$lib";

    interface Props {
        /** The story draft being edited (read-only here). */
        draft: StoryFile;
        /** Id of the scene currently open in the scene form. */
        selectedSceneId: string;
        /** Opens the given scene in the scene form. */
        onselect: ( id: string ) => void;
        /** Appends a new scene to the draft. */
        onadd: () => void;
    }

    let { draft, selectedSceneId, onselect, onadd }: Props = $props();

    // Ids present in the draft, used to flag choices whose target is missing.
    let sceneIds = $derived( new SvelteSet( draft.scenes.map( ( scene ) => scene.id ) ) );

    // Scenes reachable from the start scene, used to flag orphaned scenes.
    let reachableIds = $derived.by( () =>
    {
        const visited = new SvelteSet<string>();
        const queue = [ draft.startScene ];

        while ( queue.length > 0 )
        {
            const id = queue.shift() as string;
            if ( visited.has( id ) ) continue;
            visited.add( id );

            const scene = draft.scenes.find( ( s ) => s.id === id );
            if ( !scene ) continue;

            for ( const choice of scene.choices ) queue.push( choice.nextScene );
        }

        return visited;
    } );

    /**
     * Returns whether a scene holds at least one choice pointing to a scene
     * that no longer exists in the draft.
     *
     * @param sceneId - The scene to inspect.
     * @returns `true` when a broken choice target is present.
     * @author Claude
     */
    const hasBrokenChoice = ( sceneId: string ): boolean =>
    {
        const scene = draft.scenes.find( ( s ) => s.id === sceneId );
        if ( !scene ) return false;

        return scene.choices.some( ( choice ) => !sceneIds.has( choice.nextScene ) );
    };
</script>

<aside class="border border-terminal-dim/40 rounded px-2 py-2 sm:w-56 shrink-0" aria-label={m.editor_scenes_legend()}>
    <h3 class="text-terminal-dim text-xs px-1 pb-2 select-none">{m.editor_scenes_legend()}</h3>

    <ul class="space-y-0.5 max-h-64 overflow-y-auto">
        {#each draft.scenes as scene ( scene.id )}
            {@const isSelected = scene.id === selectedSceneId}
            {@const isStart = scene.id === draft.startScene}
            {@const isEnding = scene.isEnding === true || scene.choices.length === 0}
            {@const isOrphan = !reachableIds.has( scene.id )}

            <li>
                <button
                    type="button"
                    class="w-full text-left px-2 py-1 rounded text-xs motion-safe:transition-colors motion-safe:duration-100 {isSelected
                        ? "bg-terminal-green/15 text-terminal-white"
                        : "text-terminal-dim hover:bg-white/5 hover:text-terminal-white"}"
                    aria-current={isSelected ? "true" : undefined}
                    onclick={() => onselect( scene.id )}
                >
                    <span class="flex items-center gap-1.5 flex-wrap">
                        <span class="min-w-0 truncate {isOrphan ? "opacity-50" : ""}">{scene.id}</span>

                        {#if isStart}
                            <span class="text-terminal-cyan text-[0.65rem] border border-terminal-cyan/40 rounded px-1 shrink-0">
                                {m.editor_scene_start_badge()}
                            </span>
                        {/if}

                        {#if isEnding}
                            <span class="text-terminal-green text-[0.65rem] border border-terminal-green/40 rounded px-1 shrink-0">
                                {m.editor_scene_ending_badge()}
                            </span>
                        {/if}

                        {#if hasBrokenChoice( scene.id )}
                            <span class="text-terminal-amber text-[0.65rem] shrink-0" title={m.editor_scene_broken_title()}>⚠</span>
                        {/if}

                        {#if isOrphan && !isStart}
                            <span class="text-terminal-amber text-[0.65rem] shrink-0" title={m.editor_scene_orphan_title()}>⊘</span>
                        {/if}
                    </span>
                </button>
            </li>
        {/each}
    </ul>

    <button
        type="button"
        class="mt-2 w-full text-xs px-2 py-1 rounded border border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        onclick={onadd}
    >
        {m.editor_scene_add()}
    </button>
</aside>
