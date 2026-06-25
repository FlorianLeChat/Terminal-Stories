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
    }

    let { view, hasSave, isAnimating, wikiEntryOpen, searchActive }: Props = $props();
</script>

<footer class="shrink-0 border-t border-terminal-dim/30 px-4 py-1 text-xs font-mono text-terminal-dim flex justify-between select-none">
    <span>
        {#if view === "story"}
            {m.controls_story_choices()} &nbsp;|&nbsp; {#if isAnimating}{m.controls_story_skip()} &nbsp;|&nbsp; {/if}{m.controls_story_menu()}
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
                &nbsp;|&nbsp; {m.controls_menu_reset()} &nbsp;|&nbsp; {m.controls_menu_wiki()} &nbsp;|&nbsp; {m.controls_menu_search()}
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
        {/if}
    </span>

    <small class="opacity-40">1.0.0</small>
</footer>
