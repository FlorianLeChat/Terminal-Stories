<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import SoundControl from "./SoundControl.svelte";
    import { terminal } from "#lib/stores/terminal.ts";
    import ScanlinesControl from "./ScanlinesControl.svelte";

    interface Props {
        view: string;
    }

    let { view }: Props = $props();

    let currentStory = $derived( $terminal.currentStory );

    /**
     * True during playback: on a phone the narrow bar then shows the story
     * title, and the product name is kept for screen readers only.
     *
     * @author Claude
     */
    let isReadingStory = $derived( view === "story" && currentStory !== null );

    /**
     * Time of the last auto-save. The saved mark shows once the playthrough
     * has been saved, and is re-keyed on this value so it is announced and
     * flashes on every save.
     *
     * @author Claude
     */
    let lastSavedAt = $derived( $terminal.lastSavedAt );
    let showSaved = $derived( isReadingStory && lastSavedAt !== null );
</script>

<header
    class="status-bar flex items-center justify-between min-h-11 pl-4 pr-2 text-xs text-terminal-dim border-b border-terminal-dim/30 select-none shrink-0"
    aria-label={m.header_aria()}
>
    <h1 class="shrink-0 {isReadingStory ? "sr-only sm:not-sr-only" : ""}">TERMINAL STORIES</h1>

    <span class="flex items-center gap-2 sm:gap-4 min-w-0 {isReadingStory ? "pr-2 sm:px-2" : "px-2"}">
        {#if isReadingStory && currentStory}
            <h2 class="text-terminal-white truncate">{currentStory.title}</h2>
            <span class="shrink-0 text-terminal-dim" aria-hidden="true">|</span>
        {/if}

        <span class="text-terminal-green shrink-0">
            {#if view === "boot"}{m.header_view_boot()}{/if}
            {#if view === "menu"}{m.header_view_menu()}{/if}
            {#if view === "story-info"}{m.header_view_story_info()}{/if}
            {#if view === "story"}{m.header_view_story()}{/if}
            {#if view === "wiki"}{m.header_view_wiki()}{/if}
            {#if view === "achievements"}{m.header_view_achievements()}{/if}
            {#if view === "ai-setup"}{m.header_view_ai_setup()}{/if}
            {#if view === "custom-stories"}{m.header_view_custom_stories()}{/if}
            {#if view === "editor"}{m.header_view_editor()}{/if}
        </span>
    </span>

    <span class="flex items-center gap-1 shrink-0">
        <output class="text-terminal-amber px-1" aria-live="polite">
            {#if showSaved}
                {#key lastSavedAt}
                    <span class="saved-flash">
                        <span aria-hidden="true">◉</span>
                        <span class="max-sm:sr-only">{m.header_saved()}</span>
                    </span>
                {/key}
            {/if}
        </output>

        <ScanlinesControl />
        <SoundControl />
        <span class="cursor-blink text-terminal-green" aria-hidden="true">█</span>
    </span>
</header>

<style>
    .status-bar {
        background: color-mix( in srgb, var( --color-terminal-panel ) 80%, transparent );
        /* Clear the notch / status bar when installed as a standalone PWA. */
        padding-top: env( safe-area-inset-top );
    }

    .cursor-blink {
        animation: blink 1s step-end infinite;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
    }

    .saved-flash {
        animation: saved-flash 1.2s ease-out;
    }

    @keyframes saved-flash {
        from {
            color: var( --color-terminal-white );
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .cursor-blink,
        .saved-flash {
            animation: none;
        }
    }
</style>
