<script lang="ts">
    import * as m from "$lib/locales/messages";
    import type { TerminalView } from "$lib/stores/terminal";

    interface Props {
        view: TerminalView;
        /** True when the current story has a save in localStorage. */
        hasSave: boolean;
        /** True while the typewriter animation is running. */
        isAnimating: boolean;
        /** True when a wiki entry detail is open (shows back hint instead of nav hints). */
        wikiEntryOpen: boolean;
        /** True when the search input is currently open. */
        searchActive: boolean;
        /** True when playing a generated story and sitting on an ending scene. */
        atGeneratedEnding: boolean;
        /** True when playing a catalog story and sitting on an ending scene. */
        atStandardEnding: boolean;
        /** Number of endings discovered so far (meaningful only when at an ending). */
        endingsFound: number;
        /** Total endings in the current story (meaningful only when at an ending). */
        endingsTotal: number;
    }

    let { view, hasSave, isAnimating, wikiEntryOpen, searchActive, atGeneratedEnding, atStandardEnding, endingsFound, endingsTotal }: Props = $props();

    const showEndingsCount = $derived( ( atGeneratedEnding || atStandardEnding ) && endingsTotal > 0 );
</script>

<footer class="shrink-0 border-t border-terminal-dim/30 px-4 py-1 text-xs font-mono text-terminal-dim flex justify-between select-none">
    <span>
        {#if view === "story"}
            {#if atGeneratedEnding}
                {m.controls_ai_restart()} &nbsp;|&nbsp; {m.controls_story_menu()}
            {:else if atStandardEnding}
                {m.controls_story_ending()} &nbsp;|&nbsp; {m.controls_story_menu()}
            {:else}
                {m.controls_story_choices()} &nbsp;|&nbsp; {#if isAnimating}{m.controls_story_skip()} &nbsp;|&nbsp; {/if}{m.controls_story_menu()}
            {/if}
        {:else if view === "story-info"}
            {#if hasSave}
                {m.controls_story_info_resume()} &nbsp;|&nbsp; {m.controls_story_info_new()} &nbsp;|&nbsp; {m.controls_story_info_back()}
            {:else}
                {m.controls_story_info_start()} &nbsp;|&nbsp; {m.controls_story_info_back()}
            {/if}
        {:else if view === "menu"}
            {#if searchActive}
                {m.controls_menu_navigate()} &nbsp;|&nbsp; {m.controls_menu_select()} &nbsp;|&nbsp; {m.controls_menu_cancel_search()}
            {:else}
                {m.controls_menu_navigate()} &nbsp;|&nbsp; {m.controls_menu_select()} &nbsp;|&nbsp; {m.controls_menu_genre()} &nbsp;|&nbsp; {m.controls_menu_language()}
                &nbsp;|&nbsp; {m.controls_menu_reset()} &nbsp;|&nbsp; {m.controls_menu_wiki()} &nbsp;|&nbsp; {m.controls_menu_ai()} &nbsp;|&nbsp; {m.controls_menu_search()}
            {/if}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                {m.controls_wiki_back()}
            {:else if searchActive}
                {m.controls_menu_navigate()} &nbsp;|&nbsp; {m.controls_wiki_consult()} &nbsp;|&nbsp; {m.controls_menu_cancel_search()}
            {:else}
                {m.controls_wiki_category()} &nbsp;|&nbsp; {m.controls_menu_navigate()} &nbsp;|&nbsp; {m.controls_wiki_consult()} &nbsp;|&nbsp;
                {m.controls_story_menu()} &nbsp;|&nbsp; {m.controls_menu_search()}
            {/if}
        {:else if view === "ai-setup"}
            {m.controls_ai_generate()} &nbsp;|&nbsp; {m.controls_story_menu()}
        {/if}
    </span>

    {#if showEndingsCount}
        <output class="opacity-60">{m.ai_endings_progress( { found: endingsFound, total: endingsTotal } )}</output>
    {/if}

    <small class="opacity-40">1.0.0</small>
</footer>
