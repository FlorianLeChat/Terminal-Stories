<script lang="ts">
    import type { StoryMeta } from "#lib";
    import GenreTag from "./GenreTag.svelte";
    import * as m from "#lib/locales/messages.js";
    import { formatReadingTime, buildProgressBar, loadSave, loadDiscoveredEndings, saveCompletion } from "#lib";

    interface Props {
        story: StoryMeta;
        index: number;
        selectedIndex: number;
        isLast: boolean;
        onselect: ( id: string ) => void;
        onnavigate: ( index: number ) => void;
    }

    let { story, index, selectedIndex, isLast, onselect, onnavigate }: Props = $props();

    /**
     * Returns the completion percentage (0-100) for a story based on its save,
     * or `null` when no save slot exists.
     *
     * @param storyId - The story to look up.
     * @param totalScenes - Total number of scenes in that story.
     * @returns The rounded percentage, or `null` if there is no save.
     * @author Claude
     */
    const storyCompletion = ( storyId: string, totalScenes: number ): number | null =>
    {
        const save = loadSave( storyId );
        if ( !save ) return null;

        return saveCompletion( save, totalScenes );
    };

    let found = $derived( loadDiscoveredEndings( story.id ) );
    let allFound = $derived( found.size === story.endingIds.length && story.endingIds.length > 0 );
    let isSelected = $derived( index === selectedIndex );
    let completion = $derived( storyCompletion( story.id, story.stats.scenes ) );

    const cardId = $props.id();

    /**
     * Handles a tap/click on a story item: the first click selects and expands
     * it, the second opens the story. Mouse hover already selects the item, so
     * on desktop a click opens directly; on touch devices the expanded item
     * shows an open hint for the second tap.
     *
     * @author Claude
     */
    const handleClick = () =>
    {
        if ( !isSelected )
        {
            onnavigate( index );
        }
        else
        {
            onselect( story.id );
        }
    };
</script>

<li>
    <button
        class="w-full text-left px-3 py-3 rounded motion-safe:transition-all motion-safe:duration-100 block {isSelected
            ? "bg-terminal-green/15 border-l-2 border-terminal-green"
            : "border-l-2 border-transparent hover:bg-terminal-white/5"}"
        aria-current={isSelected ? "true" : undefined}
        aria-labelledby="{cardId}-title"
        aria-describedby="{cardId}-meta {cardId}-universe{isSelected ? ` ${ cardId }-desc` : ""}"
        onclick={handleClick}
        onpointerenter={( e ) => { if ( e.pointerType === "mouse" ) onnavigate( index ); }}
    >
        <span class="flex items-baseline gap-3">
            <span class="text-terminal-dim text-xs w-4 shrink-0">{index + 1}.</span>

            <span class="block flex-1 min-w-0">
                <span class="flex items-baseline justify-between max-sm:flex-col gap-2 mb-2">
                    <span id="{cardId}-title" class="text-terminal-white font-bold text-sm">{story.title}</span>

                    <span class="text-terminal-cyan text-xs shrink-0" title={m.story_item_reading_time_title()}>
                        ⏱ {m.story_item_reading_time_value( { duration: formatReadingTime( story.stats.minutes ) } )}
                    </span>
                </span>

                <span id="{cardId}-meta" class="flex items-center gap-2 flex-wrap mb-2">
                    <GenreTag genre={story.genre} phosphor={story.phosphor} />
                    <span class="text-terminal-dim text-xs shrink-0">· {story.language}</span>

                    {#if completion !== null}
                        <span class="text-terminal-amber text-xs shrink-0">
                            <span aria-hidden="true">◉</span>
                            <span class="sr-only">{m.story_item_save_aria( { completion: completion / 100 } )}</span>
                        </span>
                    {/if}

                    {#if allFound}
                        <span class="text-terminal-amber text-xs shrink-0">
                            <span aria-hidden="true">★</span>
                            <span class="sr-only">{m.story_item_all_endings_aria()}</span>
                        </span>
                    {/if}
                </span>

                <span id="{cardId}-universe" class="block text-terminal-dim text-xs">{story.universe}</span>

                {#if isSelected}
                    <span id="{cardId}-desc" class="block text-terminal-text text-xs my-2 leading-relaxed">
                        {story.description}
                    </span>

                    <span class="open-hint mb-2 items-center gap-1.5 rounded border border-terminal-green/50 bg-terminal-green/10 px-2 py-1 text-terminal-green text-xs motion-safe:animate-pulse">
                        <span aria-hidden="true">▸</span>
                        {m.list_open_hint()}
                    </span>

                    <span class="flex items-center gap-2 flex-wrap text-terminal-dim text-xs">
                        <span title={m.story_item_scenes_title()}>⌬ {story.stats.scenes} {m.story_item_scenes_entries()}</span>
                        <span title={m.story_item_explore_time_title()}>⧉ {m.story_item_explore_time_value( { duration: formatReadingTime( story.stats.fullMinutes ) } )}</span>
                    </span>

                    {#if completion !== null}
                        {@const bar = buildProgressBar( completion, 6 )}

                        <span class="flex items-center mb-1 mt-3 text-xs" title={m.story_item_progress_title()}>
                            <span class="text-terminal-amber">◉ {bar.filled}</span><span class="text-terminal-dim">{bar.empty}</span>
                            <span class="ml-2 text-terminal-amber">{m.story_item_progress_value( { value: completion / 100 } )}</span>
                        </span>
                    {/if}

                    <span class="flex items-baseline gap-x-1 flex-wrap">
                        <span class="text-terminal-dim text-xs mr-1">
                            {m.story_item_endings_count( { count: story.endingIds.length } )}
                        </span>

                        <span class="text-base tracking-widest" aria-hidden="true">
                            {#each story.endingIds as endingId ( endingId )}
                                <span class={found.has( endingId ) ? "text-terminal-green" : "text-terminal-dim"}>{found.has( endingId ) ? "●" : "○"}</span>
                            {/each}
                        </span>

                        <span class="text-terminal-dim text-xs ml-1">{m.story_item_endings_title( { found: found.size, total: story.endingIds.length } )}</span>
                    </span>
                {/if}
            </span>
        </span>
    </button>

    {#if !isLast}
        <div class="border-t border-terminal-dim/20 mx-3" aria-hidden="true"></div>
    {/if}
</li>

<style>
    .open-hint {
        display: none;
    }

    @media (hover: none) {
        .open-hint {
            display: inline-flex;
        }
    }
</style>
