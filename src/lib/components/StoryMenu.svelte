<script lang="ts">
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "./TerminalLogo.svelte";
    import StoryListItem from "./StoryListItem.svelte";
    import { searchStories } from "$lib/utilities/searchIndex";
    import { storiesMeta, filterStories, availableGenres, availableLanguages } from "$lib/data";

    interface Props {
        selectedIndex?: number;
        onselect: ( id: string ) => void;
        onnavigate: ( index: number ) => void;
    }

    let { selectedIndex = 0, onselect, onnavigate }: Props = $props();

    let filters = $derived( $terminal.filters );
    let searchActive = $derived( $terminal.searchActive );
    let searchQuery = $derived( $terminal.searchQuery );
    let visibleStories = $derived(
        searchActive && searchQuery !== ""
            ? filterStories( searchStories( searchQuery ), filters )
            : filterStories( storiesMeta, filters )
    );
    let hasFilters = $derived( filters.genre !== null || filters.language !== null );

    let searchInputEl: HTMLInputElement | undefined = $state();

    $effect( () =>
    {
        if ( searchActive )
        {
            searchInputEl?.focus();
        }
    } );

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
</script>

<div class="flex-1 overflow-y-auto px-4 py-2 font-mono">
    <TerminalLogo subtitle="— SYSTÈME D'HISTOIRES INTERACTIVES —" />

    <div class="border border-terminal-dim/40 rounded px-3 py-2 mb-4 space-y-1.5">
        <div class="flex items-center gap-2 flex-wrap" role="group" aria-labelledby="filter-genre-label">
            <span id="filter-genre-label" class="text-terminal-dim text-xs w-16 shrink-0 select-none">GENRE</span>

            {#each availableGenres as genre ( genre )}
                <button
                    class="text-xs px-2 py-0.5 rounded border motion-safe:transition-colors motion-safe:duration-100 {filters.genre === genre
                        ? `border-terminal-green bg-terminal-green/15 ${ genreColor( genre ) }`
                        : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                    aria-pressed={filters.genre === genre}
                    onclick={() => terminal.setFilter( "genre", genre )}
                >
                    {genre}
                </button>
            {/each}
        </div>

        <div class="flex items-center gap-2 flex-wrap" role="group" aria-labelledby="filter-language-label">
            <span id="filter-language-label" class="text-terminal-dim text-xs w-16 shrink-0 select-none">LANGUE</span>

            {#each availableLanguages as language ( language )}
                <button
                    class="text-xs px-2 py-0.5 rounded border motion-safe:transition-colors motion-safe:duration-100 {filters.language
                      === language
                        ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                        : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                    aria-pressed={filters.language === language}
                    onclick={() => terminal.setFilter( "language", language )}
                >
                    {language}
                </button>
            {/each}

            {#if hasFilters}
                <button
                    class="text-xs px-2 py-0.5 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100 ml-auto"
                    onclick={() => terminal.clearFilters()}
                >
                    ✕ Réinitialiser
                </button>
            {/if}
        </div>
    </div>

    <div class="flex items-center justify-center gap-3 mb-4 text-xs">
        {#if searchActive}
            <span class="text-terminal-dim">↑ ↓ Naviguer &nbsp;|&nbsp; ENTRÉE Sélectionner &nbsp;|&nbsp; ÉCHAP Annuler</span>
        {:else}
            <span class="text-terminal-dim">↑ ↓ Naviguer &nbsp;|&nbsp; ENTRÉE Sélectionner &nbsp;|&nbsp; Numéro Accès direct</span>

            <button
                class="px-2 py-0.5 rounded border border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 motion-safe:transition-colors motion-safe:duration-100"
                onclick={() => terminal.openWiki()}
            >
                ✦ [W] Encyclopédie
            </button>
        {/if}
    </div>

    {#if searchActive}
        <div class="border border-terminal-green/40 bg-terminal-green/5 rounded px-3 py-2 mb-4 flex items-center gap-2">
            <span class="text-terminal-dim text-xs select-none shrink-0">RECHERCHE</span>
            <span class="text-terminal-green text-xs shrink-0">›</span>
            <input
                bind:this={searchInputEl}
                type="text"
                class="flex-1 bg-transparent text-terminal-green text-xs outline-none font-mono placeholder-terminal-dim/50 caret-terminal-green"
                placeholder="Titre, genre, univers, personnage, tag..."
                value={searchQuery}
                oninput={( e ) => terminal.setSearchQuery( e.currentTarget.value )}
                aria-label="Rechercher une histoire"
                autocomplete="off"
                spellcheck={false}
            />
            <span class="text-terminal-dim text-xs shrink-0 select-none">[ÉCHAP] Annuler</span>
        </div>
    {/if}

    {#if visibleStories.length === 0}
        <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
            {#if searchActive && searchQuery !== ""}
                <p>Aucune histoire ne correspond à « {searchQuery} ».</p>

                <button class="mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.deactivateSearch()}>
                    Effacer la recherche
                </button>
            {:else}
                <p>Aucune histoire ne correspond à ces filtres.</p>

                <button class="mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.clearFilters()}>
                    Réinitialiser les filtres
                </button>
            {/if}
        </div>
    {:else}
        <ol class="border border-terminal-dim rounded px-2 py-1 mb-4">
            {#each visibleStories as story, i ( story.id )}
                <StoryListItem
                    {story}
                    index={i}
                    {selectedIndex}
                    isLast={i === visibleStories.length - 1}
                    {onselect}
                    {onnavigate}
                />
            {/each}
        </ol>
    {/if}

    <div class="text-terminal-dim text-xs text-center opacity-50 pb-4">
        {#if searchActive && searchQuery !== ""}
            {visibleStories.length} résultat{visibleStories.length > 1 ? "s" : ""} pour « {searchQuery} »
        {:else}
            {visibleStories.length} / {storiesMeta.length} histoire{storiesMeta.length > 1 ? "s" : ""}
            {hasFilters
                ? "filtrée" + ( visibleStories.length > 1 ? "s" : "" )
                : "disponible" + ( storiesMeta.length > 1 ? "s" : "" )}
        {/if}
    </div>
</div>
