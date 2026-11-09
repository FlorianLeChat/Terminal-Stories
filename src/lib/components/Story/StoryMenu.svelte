<script lang="ts">
    import type { DeepLinkErrorCode } from "#lib";
    import * as m from "#lib/locales/messages.js";
    import { display } from "#lib/stores/display.ts";
    import { terminal } from "#lib/stores/terminal.ts";
    import StoryListItem from "./StoryListItem.svelte";
    import TerminalLogo from "../Terminal/TerminalLogo.svelte";
    import { storiesMeta, filterStories, availableGenres, availableLanguages, searchStories, genreLabel, truncateQueryForDisplay } from "#lib";

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
    let activeFilterCount = $derived( ( filters.genre !== null ? 1 : 0 ) + ( filters.language !== null ? 1 : 0 ) );

    /**
     * Whether the filter panel is unfolded on phones, where it starts folded so the
     * catalog shows on the first screen. From `sm` up it is always shown.
     *
     * @author Claude
     */
    let filtersOpen = $state( false );
    let displayQuery = $derived( truncateQueryForDisplay( searchQuery ) );

    let searchInputEl: HTMLInputElement | undefined = $state();

    let menuNotice = $derived( $terminal.menuNotice );

    /** True on touch screens, which get the tap version of the first-launch tip. */
    const isTouchScreen = typeof window !== "undefined" && window.matchMedia( "(hover: none)" ).matches;

    /**
     * Other views reachable from the menu, listed from `sm` up. On phones the
     * footer carries the same destinations.
     *
     * @author Claude
     */
    const destinations: { label: string; open: () => void }[] = [
        { label: m.controls_menu_wiki(), open: () => terminal.openWiki() },
        { label: m.controls_menu_custom(), open: () => terminal.openCustomStories() },
        { label: m.controls_menu_ai(), open: () => terminal.openAiSetup() },
        { label: m.controls_menu_achievements(), open: () => terminal.openAchievements() }
    ];

    /** Translated explanation for each reason a deep link fell back to the menu. */
    const NOTICE_MESSAGES: Record<DeepLinkErrorCode, () => string> = {
        unknown_story: m.deeplink_err_unknown_story,
        unknown_wiki: m.deeplink_err_unknown_wiki
    };

    $effect( () =>
    {
        if ( searchActive )
        {
            searchInputEl?.focus();
        }
    } );
</script>

<div class="flex-1 overflow-y-auto px-4 py-2">
    {#if menuNotice}
        <p class="border border-terminal-error/60 rounded px-3 py-2 mt-2 text-terminal-error text-xs" role="alert">
            {NOTICE_MESSAGES[ menuNotice ]()}
        </p>
    {/if}

    <TerminalLogo subtitle={m.menu_subtitle()} />

    {#if !$display.welcomeDismissed}
        <aside class="flex items-center justify-center gap-1 mt-2 text-terminal-text text-xs" aria-label={m.menu_welcome_aria()}>
            <p class="py-2 text-center">{isTouchScreen ? m.menu_welcome_touch() : m.menu_welcome()}</p>

            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-8 sm:min-h-8 text-terminal-dim hover:text-terminal-white"
                aria-label={m.menu_welcome_dismiss()}
                onclick={() => display.dismissWelcome()}
            >
                <span aria-hidden="true">✕</span>
            </button>
        </aside>
    {/if}

    <nav class="hidden sm:flex flex-wrap justify-center gap-1.5 mt-4" aria-label={m.menu_nav_aria()}>
        {#each destinations as destination ( destination.label )}
            <button
                type="button"
                class="inline-flex items-center min-h-8 px-2 py-1 border border-terminal-dim/40 rounded text-xs text-terminal-dim hover:text-terminal-white hover:border-terminal-dim motion-safe:transition-colors motion-safe:duration-100"
                onclick={destination.open}
            >
                {destination.label}
            </button>
        {/each}
    </nav>

    <button
        type="button"
        class="sm:hidden w-full min-h-11 mt-4 px-3 rounded border border-terminal-dim/40 text-terminal-dim text-xs text-left flex items-center justify-between active:bg-terminal-green/15"
        aria-expanded={filtersOpen}
        aria-controls="menu-filters"
        onclick={() => { filtersOpen = !filtersOpen; }}
    >
        {m.menu_filters_toggle( { count: activeFilterCount } )}
        <span aria-hidden="true">{filtersOpen ? "▴" : "▾"}</span>
    </button>

    <ul id="menu-filters" class="{filtersOpen ? "" : "hidden"} sm:block border border-terminal-dim/40 rounded px-3 py-2 my-4 space-y-3 sm:space-y-1.5">
        <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span id="filter-genre-label" class="text-terminal-dim text-xs sm:w-28 shrink-0 select-none">
                {m.menu_filter_genre()}
                <kbd class="hidden sm:inline font-[inherit]" aria-hidden="true">[G]</kbd>
            </span>

            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap flex-1" role="group" aria-labelledby="filter-genre-label">
                {#each availableGenres as genre ( genre )}
                    <button
                        class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {filters.genre === genre
                            ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        aria-pressed={filters.genre === genre}
                        onclick={() => terminal.setFilter( "genre", genre )}
                    >
                        {genreLabel( genre )}
                    </button>
                {/each}
            </div>
        </li>

        <li class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span id="filter-language-label" class="text-terminal-dim text-xs sm:w-28 shrink-0 select-none">
                {m.menu_filter_language()}
                <kbd class="hidden sm:inline font-[inherit]" aria-hidden="true">[L]</kbd>
            </span>

            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap flex-1" role="group" aria-labelledby="filter-language-label">
                {#each availableLanguages as language ( language )}
                    <button
                        class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border w-full sm:w-auto text-center sm:text-left motion-safe:transition-colors motion-safe:duration-100 {filters.language
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
                        class="text-xs min-h-11 sm:min-h-0 px-2 py-1.5 sm:py-0.5 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100 w-full sm:w-auto sm:ml-auto"
                        onclick={() => terminal.clearFilters()}
                    >
                        {m.menu_filter_reset()}
                    </button>
                {/if}
            </div>
        </li>
    </ul>

    {#if searchActive}
        <div class="border border-terminal-green/40 focus-within:border-terminal-green bg-terminal-green/5 rounded px-3 py-2 mb-4 flex items-center gap-2">
            <span class="text-terminal-dim text-xs select-none shrink-0">{m.menu_search_label()}</span>
            <span class="text-terminal-green text-xs shrink-0">›</span>

            <input
                bind:this={searchInputEl}
                type="text"
                class="flex-1 min-w-0 bg-transparent text-terminal-green text-xs placeholder-terminal-dim caret-terminal-green"
                placeholder={m.menu_search_placeholder()}
                value={searchQuery}
                oninput={( e ) => terminal.setSearchQuery( e.currentTarget.value )}
                aria-label={m.menu_search_aria()}
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
            class="w-full min-h-11 flex items-center gap-2 border border-terminal-dim/40 rounded px-3 py-2 mb-4 hover:border-terminal-dim motion-safe:transition-colors motion-safe:duration-100"
            aria-label={m.menu_search_aria()}
            onclick={() => terminal.activateSearch()}
        >
            <span class="text-terminal-dim text-xs select-none shrink-0">{m.menu_search_label()}</span>
            <span class="text-terminal-green text-xs shrink-0">›</span>
            <span class="flex-1 min-w-0 text-left text-terminal-dim text-xs truncate">{m.menu_search_placeholder()}</span>
        </button>
    {/if}

    <output class="block text-terminal-dim text-xs text-center mb-4 break-words" aria-live="polite">
        {#if searchActive && searchQuery !== ""}
            {m.menu_count_results( { count: visibleStories.length, query: displayQuery } )}
        {:else}
            {m.menu_count_stories( { visible: visibleStories.length, total: storiesMeta.length } )}{hasFilters
                ? m.menu_count_filtered()
                : m.menu_count_available()}
        {/if}
    </output>

    {#if visibleStories.length === 0}
        <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-2 text-center text-terminal-dim text-sm">
            {#if searchActive && searchQuery !== ""}
                <p class="break-words">{m.menu_empty_search( { query: displayQuery } )}</p>

                <button class="mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.deactivateSearch()}>
                    {m.menu_empty_search_clear()}
                </button>
            {:else}
                <p>{m.menu_empty_filters()}</p>

                <button class="mt-3 text-terminal-amber text-xs underline" onclick={() => terminal.clearFilters()}>
                    {m.menu_empty_filters_reset()}
                </button>
            {/if}
        </div>
    {:else}
        <ol class="border border-terminal-dim rounded px-2 py-1 mb-2">
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
</div>
