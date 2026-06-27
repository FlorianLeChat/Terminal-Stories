<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import WikiEntryDetail from "./WikiEntryDetail.svelte";
    import { availableUniverses,
        availableWikiLanguages,
        categories,
        categoryIconMap,
        categoryLabel,
        countAllCategories,
        filterEntries,
        getEntry,
        getLanguageForUniverse,
        searchWikiEntries } from "$lib";

    let wiki = $derived( $terminal.wiki );
    let searchActive = $derived( $terminal.searchActive );
    let searchQuery = $derived( $terminal.searchQuery );
    let entries = $derived(
        searchActive && searchQuery !== ""
            ? searchWikiEntries( searchQuery ).filter( ( e ) =>
                ( !wiki.language || getLanguageForUniverse( e.universe ) === wiki.language )
                && ( !wiki.universe || e.universe === wiki.universe )
            )
            : filterEntries( wiki.category, wiki.language, wiki.universe )
    );
    let currentEntry = $derived( wiki.selectedEntryId ? getEntry( wiki.selectedEntryId ) : null );
    let categoryCounts = $derived( countAllCategories( wiki.language, wiki.universe ) );
    let filteredUniverses = $derived( wiki.language
        ? availableUniverses.filter( ( u ) => getLanguageForUniverse( u ) === wiki.language )
        : availableUniverses );

    let searchInputEl: HTMLInputElement | undefined = $state();

    $effect( () =>
    {
        if ( searchActive )
        {
            searchInputEl?.focus();
        }
    } );

    const categoryColors: Record<string, string> = {
        universe: "text-terminal-cyan",
        character: "text-terminal-amber",
        location: "text-emerald-400",
        era: "text-purple-400",
        event: "text-red-400"
    };

    /**
     * Returns the Tailwind text-color class for a knowledge category.
     *
     * @param category - The category identifier.
     * @returns The CSS class used to color that category.
     * @author Claude
     */
    const color = ( category: string ): string =>
    {
        return categoryColors[ category ] ?? "text-terminal-green";
    };

    /**
     * Returns a click handler for a wiki entry. On mobile there is no hover,
     * so the first tap selects the entry (matching the keyboard/hover state)
     * and the second tap opens it. On desktop the hover already set
     * selectedIndex, so the click always reaches the open branch directly.
     *
     * @param i - Index of the entry in the current list.
     * @param entryId - Identifier of the entry to open on the second tap.
     * @returns A click event handler.
     * @author Claude
     */
    const handleWikiClick = ( i: number, entryId: string ) => () =>
    {
        if ( i !== wiki.selectedIndex )
        {
            terminal.navigateWiki( i );
        }
        else
        {
            terminal.openWikiEntry( entryId );
        }
    };

</script>

<div class="flex-1 overflow-y-auto px-4 py-2 scrollbar-terminal">
    <TerminalLogo subtitle={m.wiki_subtitle()} />

    {#if !currentEntry}
        <ul aria-labelledby="wiki-filter-category-label" class="border border-terminal-dim/40 rounded px-3 py-2 my-4 space-y-3 sm:space-y-2">
            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap" role="group" aria-labelledby="wiki-filter-category-label">
                <span id="wiki-filter-category-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_category()}
                </span>

                {#each categories as cat ( cat.id )}
                    <button
                        class="text-xs px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.category === cat.id
                            ? `border-terminal-green bg-terminal-green/15 ${ color( cat.id ) }`
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        aria-pressed={wiki.category === cat.id}
                        onclick={() => terminal.setWikiCategory( cat.id )}
                    >
                        {cat.icon} {cat.label}
                        <span class="opacity-80">({categoryCounts[ cat.id ]})</span>
                    </button>
                {/each}
            </li>

            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap" role="group" aria-labelledby="wiki-filter-language-label">
                <span id="wiki-filter-language-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_language()}
                </span>

                {#each availableWikiLanguages as language ( language )}
                    <button
                        class="text-xs px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.language === language
                            ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        aria-pressed={wiki.language === language}
                        onclick={() => terminal.setWikiLanguage( language )}
                    >
                        {language}
                    </button>
                {/each}
            </li>

            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap" role="group" aria-labelledby="wiki-filter-universe-label">
                <span id="wiki-filter-universe-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_universe()}
                </span>

                {#each filteredUniverses as universe ( universe )}
                    <button
                        class="text-xs px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.universe === universe
                            ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        aria-pressed={wiki.universe === universe}
                        onclick={() => terminal.setWikiUniverse( universe )}
                    >
                        {universe}
                    </button>
                {/each}
            </li>
        </ul>

        {#if searchActive}
            <div class="border border-terminal-green/40 bg-terminal-green/5 rounded px-3 py-2 mb-3 flex items-center gap-2">
                <span class="text-terminal-dim text-xs select-none shrink-0">{m.wiki_search_label()}</span>
                <span class="text-terminal-green text-xs shrink-0">›</span>

                <input
                    bind:this={searchInputEl}
                    type="text"
                    class="flex-1 bg-transparent text-terminal-green text-xs outline-none placeholder-terminal-dim/50 caret-terminal-green"
                    placeholder={m.wiki_search_placeholder()}
                    value={searchQuery}
                    oninput={( e ) => terminal.setSearchQuery( e.currentTarget.value )}
                    aria-label={m.wiki_search_aria()}
                    autocomplete="off"
                    spellcheck={false}
                />

                <span class="text-terminal-dim text-xs shrink-0 select-none">{m.wiki_search_cancel()}</span>
            </div>
        {/if}

        <nav class="text-terminal-dim text-xs mb-4 text-center">
            {#if searchActive}
                {m.wiki_nav_search_active()}
            {:else}
                {m.wiki_nav_default()}
            {/if}
        </nav>

        {#if entries.length === 0}
            <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
                {#if searchActive && searchQuery !== ""}
                    <p>{m.wiki_empty_search( { query: searchQuery } )}</p>

                    <button class="block mx-auto mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.deactivateSearch()}>
                        {m.wiki_empty_search_clear()}
                    </button>
                {:else}
                    {m.wiki_empty_category()}
                {/if}
            </div>
        {:else}
            <ol class="border border-terminal-dim rounded px-2 py-1 mb-4">
                {#each entries as entry, i ( entry.id )}
                    <li>
                        <button
                            class="w-full text-left px-3 py-2.5 rounded motion-safe:transition-all motion-safe:duration-100 block {i === wiki.selectedIndex
                                ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                                : "border-l-2 border-transparent hover:bg-white/5"}"
                            aria-current={i === wiki.selectedIndex ? "true" : undefined}
                            onclick={handleWikiClick( i, entry.id )}
                            onpointerenter={( e ) => { if ( e.pointerType === "mouse" ) terminal.navigateWiki( i ); }}
                        >
                            <span class="flex items-baseline gap-3">
                                <span class="text-xs shrink-0 {color( entry.category )}">
                                    {categoryIconMap[ entry.category ]}
                                </span>

                                <span class="block flex-1 min-w-0">
                                    <span class="flex items-baseline gap-2 flex-wrap mb-2">
                                        <span class="text-terminal-white font-bold text-sm">{entry.name}</span>
                                        <span class="text-terminal-dim text-xs shrink-0">· {entry.universe}</span>
                                    </span>

                                    <span class="block text-terminal-green text-xs mt-0.5 opacity-80 leading-relaxed">
                                        {entry.summary}
                                    </span>
                                </span>
                            </span>
                        </button>

                        {#if i < entries.length - 1}
                            <div class="border-t border-terminal-dim/20 mx-3" aria-hidden="true"></div>
                        {/if}
                    </li>
                {/each}
            </ol>
        {/if}

        <div class="text-terminal-dim text-xs text-center opacity-80 pb-4">
            {#if searchActive && searchQuery !== ""}
                {m.wiki_count_results( { count: entries.length, query: searchQuery } )}
            {:else}
                {m.wiki_count_entries( { count: entries.length } )} — {categoryLabel( wiki.category )}
                {wiki.universe ? `· ${ wiki.universe }` : ""}
            {/if}
        </div>
    {:else}
        <WikiEntryDetail entry={currentEntry} />
    {/if}
</div>

<style>
    .scrollbar-terminal::-webkit-scrollbar {
        width: 4px;
    }

    .scrollbar-terminal::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollbar-terminal::-webkit-scrollbar-thumb {
        background: #1a4a1a;
        border-radius: 2px;
    }
</style>
