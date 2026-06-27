<script lang="ts">
    import * as m from "$lib/locales/messages";
    import type { StoryMeta } from "$lib";
    import { formatReadingTime, buildProgressBar, loadSave, loadDiscoveredEndings } from "$lib";

    interface Props {
        story: StoryMeta;
        index: number;
        selectedIndex: number;
        isLast: boolean;
        onselect: ( id: string ) => void;
        onnavigate: ( index: number ) => void;
    }

    let { story, index, selectedIndex, isLast, onselect, onnavigate }: Props = $props();

    const genreColors: Record<string, string> = {
        "Fantasy": "text-emerald-400",
        "Sci-Fi": "text-blue-400",
        "Thriller": "text-red-400",
        "Horror": "text-purple-400",
        "Detective": "text-yellow-400"
    };

    /**
     * Returns the Tailwind text-color class for a genre, falling back to the
     * dim terminal color for unknown genres.
     *
     * @param genre - The story genre.
     * @returns The CSS class to color the genre label.
     * @author Claude
     */
    const genreColor = ( genre: string ): string =>
    {
        return genreColors[ genre ] ?? "text-terminal-dim";
    };

    /**
     * Returns the completion percentage (0–100) for a story based on its save,
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

        return Math.min( 100, Math.round( ( save.history.length + 1 ) / totalScenes * 100 ) );
    };

    /**
     * Returns the Unicode circled number glyph for a 1-based ending index.
     * Supports indices 1–20 (the Unicode range for circled digits).
     *
     * @param i - 1-based position of the ending (e.g. 1 → ①).
     * @returns The matching circled-number character.
     * @author Claude
     */
    const endingGlyph = ( i: number ): string =>
    {
        // U+2460 is ①; adding (i - 1) walks through ②③... up to ⑳ (U+2473).
        return String.fromCodePoint( 0x245f + i );
    };

    let found = $derived( loadDiscoveredEndings( story.id ) );
    let allFound = $derived( found.size === story.endingIds.length && story.endingIds.length > 0 );
    let isSelected = $derived( index === selectedIndex );
    let completion = $derived( storyCompletion( story.id, story.stats.scenes ) );
</script>

<li>
    <button
        class="w-full text-left px-3 py-3 rounded motion-safe:transition-all motion-safe:duration-100 block {isSelected
            ? "bg-terminal-green/15 border-l-2 border-terminal-green"
            : "border-l-2 border-transparent hover:bg-white/5"}"
        aria-current={isSelected ? "true" : undefined}
        onclick={() => onselect( story.id )}
        onmouseenter={() => onnavigate( index )}
    >
        <span class="flex items-baseline gap-3">
            <span class="text-terminal-dim text-xs w-4 shrink-0">{index + 1}.</span>

            <span class="block flex-1 min-w-0">
                <span class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-terminal-white font-bold text-sm">{story.title}</span>
                    <span class="text-xs {genreColor( story.genre )} shrink-0">[{story.genre}]</span>
                    <span class="text-terminal-dim text-xs shrink-0">· {story.language}</span>

                    {#if completion !== null}
                        <span
                            class="text-terminal-amber text-xs shrink-0"
                            aria-label={m.story_item_save_aria( { completion: completion / 100 } )}
                        >
                            ◉
                        </span>
                    {/if}

                    {#if allFound}
                        <span class="text-terminal-amber text-xs shrink-0" aria-label={m.story_item_all_endings_aria()}>
                            ★
                        </span>
                    {/if}

                    <span class="text-terminal-cyan text-xs shrink-0 ml-auto" title={m.story_item_reading_time_title()}>
                        ⏱ {formatReadingTime( story.stats.minutes )} / partie
                    </span>
                </span>

                <span class="block text-terminal-dim text-xs mt-0.5">{story.universe}</span>

                {#if isSelected}
                    <span class="block text-terminal-green text-xs mt-1 opacity-80 leading-relaxed">
                        {story.description}
                    </span>

                    <span class="flex items-center gap-3 mt-1 text-terminal-dim text-xs opacity-70">
                        <span title={m.story_item_scenes_title()}>⌬ {story.stats.scenes} {m.story_item_scenes_entries()}</span>
                        <span title={m.story_item_explore_time_title()}>⧉ {formatReadingTime( story.stats.fullMinutes )} pour tout explorer</span>

                        {#if completion !== null}
                            {@const bar = buildProgressBar( completion, 6 )}

                            <span class="ml-auto text-xs" title={m.story_item_progress_title()}>
                                <span class="text-terminal-amber">◉ {bar.filled}</span><span class="text-terminal-dim/50">{bar.empty}</span>
                                <span class="text-terminal-amber"> {m.story_item_progress_value( { value: completion / 100 } )}</span>
                            </span>
                        {/if}
                    </span>

                    <span
                        class="flex items-center gap-1 mt-1"
                        title={m.story_item_endings_title( { found: found.size, total: story.endingIds.length } )}
                    >
                        <span class="text-terminal-dim text-xs opacity-70 mr-1">
                            {m.story_item_endings_count( { count: story.endingIds.length } )}
                        </span>

                        {#each story.endingIds as endingId, idx ( endingId )}
                            <span class="text-2xl {found.has( endingId ) ? "text-terminal-green" : "text-terminal-dim"}">
                                {endingGlyph( idx + 1 )}
                            </span>
                        {/each}
                    </span>

                    <span role="list" class="flex gap-1 mt-1 flex-wrap">
                        {#each story.tags as tag ( tag )}
                            <span role="listitem" class="text-terminal-dim text-xs opacity-60">#{tag}</span>
                        {/each}
                    </span>
                {/if}
            </span>
        </span>
    </button>

    {#if !isLast}
        <div class="border-t border-terminal-dim/20 mx-3" aria-hidden="true"></div>
    {/if}
</li>
