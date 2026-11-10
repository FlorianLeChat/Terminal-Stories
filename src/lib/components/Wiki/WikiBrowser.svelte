<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import ViewTitle from "../Terminal/ViewTitle.svelte";
    import WikiEntryDetail from "./WikiEntryDetail.svelte";
    import { availableUniverses,
        availableWikiLanguages,
        categories,
        categoryIconMap,
        countAllCategories,
        filterEntries,
        getEntry,
        getLanguageForUniverse,
        searchWikiEntries,
        truncateQueryForDisplay } from "#lib";

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
    let displayQuery = $derived( truncateQueryForDisplay( searchQuery ) );
    let categoryCounts = $derived( countAllCategories( wiki.language, wiki.universe ) );
    let filteredUniverses = $derived( wiki.language
        ? availableUniverses.filter( ( u ) => getLanguageForUniverse( u ) === wiki.language )
        : availableUniverses );

    let searchInputEl: HTMLInputElement | undefined = $state();
    let scrollContainerEl: HTMLDivElement | undefined = $state();

    $effect( () =>
    {
        if ( searchActive )
        {
            searchInputEl?.focus();
        }
    } );

    // Open each entry at its top, not at the list's scroll position.
    $effect( () =>
    {
        if ( currentEntry )
        {
            scrollContainerEl?.scrollTo( { top: 0 } );
        }
    } );

    /**
     * Returns a click handler for a wiki entry: the first click selects it, the
     * second opens it. Mouse hover already selects the entry, so on desktop a
     * click opens directly; on touch devices the selected entry shows an open
     * hint for the second tap.
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

<div bind:this={scrollContainerEl} class="flex-1 overflow-y-auto px-4 py-2 scrollbar-terminal">
    <ViewTitle title={m.wiki_subtitle()} />

    {#if !currentEntry}
        <ul class="border border-terminal-dim/40 rounded px-3 py-2 my-4 space-y-3 sm:space-y-2">
            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span id="wiki-filter-category-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_category()}
                </span>

                <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap flex-1" role="group" aria-labelledby="wiki-filter-category-label">
                    {#each categories as cat ( cat.id )}
                        <button
                            class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.category === cat.id
                                ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                                : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                            aria-pressed={wiki.category === cat.id}
                            onclick={() => terminal.setWikiCategory( cat.id )}
                        >
                            {cat.icon} {cat.label}
                            <span>({categoryCounts[ cat.id ]})</span>
                        </button>
                    {/each}
                </div>
            </li>

            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span id="wiki-filter-language-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_language()}
                </span>

                <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap flex-1" role="group" aria-labelledby="wiki-filter-language-label">
                    {#each availableWikiLanguages as language ( language )}
                        <button
                            class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.language === language
                                ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                                : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                            aria-pressed={wiki.language === language}
                            onclick={() => terminal.setWikiLanguage( language )}
                        >
                            {language}
                        </button>
                    {/each}
                </div>
            </li>

            <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span id="wiki-filter-universe-label" class="text-terminal-dim text-xs sm:w-20 shrink-0 select-none">
                    {m.wiki_filter_universe()}
                </span>

                <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap flex-1" role="group" aria-labelledby="wiki-filter-universe-label">
                    {#each filteredUniverses as universe ( universe )}
                        <button
                            class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {wiki.universe === universe
                                ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                                : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                            aria-pressed={wiki.universe === universe}
                            onclick={() => terminal.setWikiUniverse( universe )}
                        >
                            {universe}
                        </button>
                    {/each}
                </div>
            </li>
        </ul>

        {#if searchActive}
            <div class="border border-terminal-green/40 focus-within:border-terminal-green bg-terminal-green/5 rounded px-3 py-2 mb-3 flex items-center gap-2">
                <span class="text-terminal-dim text-xs select-none shrink-0">{m.wiki_search_label()}</span>
                <span class="text-terminal-green text-xs shrink-0">›</span>

                <input
                    bind:this={searchInputEl}
                    type="text"
                    class="flex-1 min-w-0 bg-transparent text-terminal-green text-xs placeholder-terminal-dim caret-terminal-green"
                    placeholder={m.wiki_search_placeholder()}
                    value={searchQuery}
                    oninput={( e ) => terminal.setSearchQuery( e.currentTarget.value )}
                    aria-label={m.wiki_search_aria()}
                    autocomplete="off"
                    spellcheck={false}
                />

                <button
                    class="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 -my-2 -mr-2 text-terminal-amber text-sm leading-none hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                    aria-label={m.action_cancel_search()}
                    onclick={() => terminal.deactivateSearch()}
                >
                    ✕
                </button>
            </div>
        {:else}
            <button
                class="w-full min-h-11 flex items-center gap-2 border border-terminal-dim/40 rounded px-3 py-2 mb-3 hover:border-terminal-dim motion-safe:transition-colors motion-safe:duration-100"
                aria-label={m.wiki_search_aria()}
                onclick={() => terminal.activateSearch()}
            >
                <span class="text-terminal-dim text-xs select-none shrink-0">{m.wiki_search_label()}</span>
                <span class="text-terminal-green text-xs shrink-0">›</span>
                <span class="flex-1 min-w-0 text-left text-terminal-dim text-xs truncate">{m.wiki_search_placeholder()}</span>
            </button>
        {/if}

        <output class="block text-terminal-dim text-xs text-center mb-4 break-words" aria-live="polite">
            {#if searchActive && searchQuery !== ""}
                {m.wiki_count_results( { count: entries.length, query: displayQuery } )}
            {:else}
                {m.wiki_count_entries( { count: entries.length } )}
                {wiki.universe ? `· ${ wiki.universe }` : ""}
            {/if}
        </output>

        {#if entries.length === 0}
            <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
                {#if searchActive && searchQuery !== ""}
                    <p class="break-words">{m.wiki_empty_search( { query: displayQuery } )}</p>

                    <button class="block mx-auto mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.deactivateSearch()}>
                        {m.wiki_empty_search_clear()}
                    </button>
                {:else}
                    {m.wiki_empty_category()}
                {/if}
            </div>
        {:else}
            <ol class="border border-terminal-dim rounded px-2 py-1 mb-2">
                {#each entries as entry, i ( entry.id )}
                    <li>
                        <button
                            class="w-full text-left px-3 py-2.5 rounded motion-safe:transition-all motion-safe:duration-100 block {i === wiki.selectedIndex
                                ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                                : "border-l-2 border-transparent hover:bg-terminal-white/5"}"
                            aria-current={i === wiki.selectedIndex ? "true" : undefined}
                            onclick={handleWikiClick( i, entry.id )}
                            onpointerenter={( e ) => { if ( e.pointerType === "mouse" ) terminal.navigateWiki( i ); }}
                        >
                            <span class="flex items-baseline gap-3">
                                <span class="text-xs shrink-0 text-terminal-dim" aria-hidden="true">
                                    {categoryIconMap[ entry.category ]}
                                </span>

                                <span class="block flex-1 min-w-0">
                                    <span class="flex items-baseline gap-2 flex-wrap mb-2">
                                        <span class="text-terminal-white font-bold text-sm">{entry.name}</span>
                                        {#if entry.name !== entry.universe}
                                            <span class="text-terminal-dim text-xs shrink-0">· {entry.universe}</span>
                                        {/if}
                                    </span>

                                    <span class="block text-terminal-text text-xs mt-0.5 leading-relaxed">
                                        {entry.summary}
                                    </span>

                                    {#if i === wiki.selectedIndex}
                                        <span class="open-hint mt-2 items-center gap-1.5 rounded border border-terminal-green/50 bg-terminal-green/10 px-2 py-1 text-terminal-green text-xs motion-safe:animate-pulse">
                                            <span aria-hidden="true">▸</span>
                                            {m.list_open_hint()}
                                        </span>
                                    {/if}
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
    {:else}
        <WikiEntryDetail entry={currentEntry} />
    {/if}
</div>

<style>
    .open-hint {
        display: none;
    }

    @media (hover: none) {
        .open-hint {
            display: inline-flex;
        }
    }

    .scrollbar-terminal::-webkit-scrollbar {
        width: 4px;
    }

    .scrollbar-terminal::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollbar-terminal::-webkit-scrollbar-thumb {
        background: color-mix( in srgb, var( --color-terminal-dim ) 40%, transparent );
        border-radius: var( --radius-terminal );
    }
</style>
