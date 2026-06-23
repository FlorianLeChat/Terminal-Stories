<script lang="ts">
    import { terminal } from "$lib/stores/terminal";
    import { storiesMeta, filterStories, availableGenres, availableLanguages } from "$lib/data";
    import { formatReadingTime } from "$lib/utilities/readingTime";
    import { loadSave } from "$lib/utilities/saveService";

    interface Props {
        selectedIndex?: number;
        onselect: ( id: string ) => void;
        onnavigate: ( index: number ) => void;
    }

    let { selectedIndex = 0, onselect, onnavigate }: Props = $props();

    let filters = $derived( $terminal.filters );
    let visibleStories = $derived( filterStories( storiesMeta, filters ) );
    let hasFilters = $derived( filters.genre !== null || filters.language !== null );

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
     * Splits a percentage into filled / empty block counts for a compact bar.
     * Both parts use the same `█` glyph so every block is identical width.
     *
     * @param percent - Value between 0 and 100.
     * @param blocks - Total number of characters in the bar (default 6).
     * @returns An object with the two repeated strings.
     * @author Claude
     */
    const miniBar = ( percent: number, blocks = 6 ): { filled: string; empty: string } =>
    {
        const filledCount = Math.round( ( percent / 100 ) * blocks );

        return {
            filled: "█".repeat( filledCount ),
            empty: "█".repeat( blocks - filledCount )
        };
    };
</script>

<div class="flex-1 overflow-y-auto px-4 py-2 font-mono">
    <div class="mb-6 text-center select-none">
        <pre class="text-terminal-green text-xs leading-tight opacity-80">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
        <pre class="text-terminal-green text-xs leading-tight opacity-80">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

        <p class="text-terminal-dim text-xs mt-2 tracking-widest">— SYSTÈME D'HISTOIRES INTERACTIVES v1.0 —</p>
    </div>

    <div class="border border-terminal-dim/40 rounded px-3 py-2 mb-4 space-y-1.5">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-terminal-dim text-xs w-16 shrink-0 select-none">GENRE</span>

            {#each availableGenres as genre ( genre )}
                <button
                    class="text-xs px-2 py-0.5 rounded border transition-colors duration-100 {filters.genre === genre
                        ? `border-terminal-green bg-terminal-green/15 ${ genreColor( genre ) }`
                        : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                    onclick={() => terminal.setFilter( "genre", genre )}
                >
                    {genre}
                </button>
            {/each}
        </div>

        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-terminal-dim text-xs w-16 shrink-0 select-none">LANGUE</span>
            {#each availableLanguages as language ( language )}
                <button
                    class="text-xs px-2 py-0.5 rounded border transition-colors duration-100 {filters.language
                      === language
                        ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                        : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                    onclick={() => terminal.setFilter( "language", language )}
                >
                    {language}
                </button>
            {/each}

            {#if hasFilters}
                <button
                    class="text-xs px-2 py-0.5 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 transition-colors duration-100 ml-auto"
                    onclick={() => terminal.clearFilters()}
                >
                    ✕ Réinitialiser
                </button>
            {/if}
        </div>
    </div>

    <div class="flex items-center justify-center gap-3 mb-4 text-xs">
        <span class="text-terminal-dim">↑ ↓ Naviguer &nbsp;|&nbsp; ENTRÉE Sélectionner &nbsp;|&nbsp; Numéro Accès direct</span>

        <button
            class="px-2 py-0.5 rounded border border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 transition-colors duration-100"
            onclick={() => terminal.openWiki()}
        >
            ✦ [W] Encyclopédie
        </button>
    </div>

    {#if visibleStories.length === 0}
        <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
            <p>Aucune histoire ne correspond à ces filtres.</p>

            <button class="mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.clearFilters()}>
                Réinitialiser les filtres
            </button>
        </div>
    {:else}
        <div class="border border-terminal-dim rounded px-2 py-1 mb-4">
            {#each visibleStories as story, i ( story.id )}
                <button
                    class="w-full text-left px-3 py-3 rounded transition-all duration-100 block {i === selectedIndex
                        ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                        : "border-l-2 border-transparent hover:bg-white/5"}"
                    onclick={() => onselect( story.id )}
                    onmouseenter={() => onnavigate( i )}
                >
                    <span class="flex items-baseline gap-3">
                        <span class="text-terminal-dim text-xs w-4 shrink-0">{i + 1}.</span>

                        <span class="block flex-1 min-w-0">
                            <span class="flex items-baseline gap-2 flex-wrap">
                                <span class="text-terminal-white font-bold text-sm">{story.title}</span>
                                <span class="text-xs {genreColor( story.genre )} shrink-0">[{story.genre}]</span>
                                <span class="text-terminal-dim text-xs shrink-0">· {story.language}</span>

                                {#if storyCompletion( story.id, story.stats.scenes ) !== null}
                                    <span
                                        class="text-terminal-amber text-xs shrink-0 font-mono"
                                        title="Sauvegarde — {storyCompletion( story.id, story.stats.scenes )}% explorés"
                                    >
                                        ◉
                                    </span>
                                {/if}

                                <span class="text-terminal-cyan text-xs shrink-0 ml-auto" title="Temps de lecture estimé d'une partie">
                                    ⏱ {formatReadingTime( story.stats.minutes )}
                                </span>
                            </span>

                            <span class="block text-terminal-dim text-xs mt-0.5">{story.universe}</span>

                            {#if i === selectedIndex}
                                <span class="block text-terminal-green text-xs mt-1 opacity-80 leading-relaxed">
                                    {story.description}
                                </span>

                                <span class="flex items-center gap-3 mt-1 text-terminal-dim text-xs opacity-70">
                                    <span title="Nombre de scènes">⌬ {story.stats.scenes} entrées</span>
                                    <span title="Nombre de fins possibles">✦ {story.stats.endings} fin{story.stats.endings > 1 ? "s" : ""}</span>
                                    <span title="Temps pour explorer tout le contenu">⧉ {formatReadingTime( story.stats.fullMinutes )} au total</span>

                                    {#if storyCompletion( story.id, story.stats.scenes ) !== null}
                                        {@const pct = storyCompletion( story.id, story.stats.scenes ) ?? 0}
                                        {@const bar = miniBar( pct )}

                                        <span class="font-mono ml-auto text-xs" title="Progression sauvegardée">
                                            <span class="text-terminal-amber">◉ {bar.filled}</span><span class="text-terminal-dim/50">{bar.empty}</span>
                                            <span class="text-terminal-amber"> {pct}%</span>
                                        </span>
                                    {/if}
                                </span>

                                <span class="flex gap-1 mt-1 flex-wrap">
                                    {#each story.tags as tag ( tag )}
                                        <span class="text-terminal-dim text-xs opacity-60">#{tag}</span>
                                    {/each}
                                </span>
                            {/if}
                        </span>
                    </span>
                </button>

                {#if i < visibleStories.length - 1}
                    <div class="border-t border-terminal-dim/20 mx-3"></div>
                {/if}
            {/each}
        </div>
    {/if}

    <div class="text-terminal-dim text-xs text-center opacity-50 pb-4">
        {visibleStories.length} / {storiesMeta.length} histoire{storiesMeta.length > 1 ? "s" : ""}
        {hasFilters
            ? "filtrée" + ( visibleStories.length > 1 ? "s" : "" )
            : "disponible" + ( storiesMeta.length > 1 ? "s" : "" )}
    </div>
</div>
