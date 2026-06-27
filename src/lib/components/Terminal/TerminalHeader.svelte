<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";

    interface Props {
        view: string;
    }

    let { view }: Props = $props();

    let currentStory = $derived( $terminal.currentStory );
</script>

<header
    class="status-bar flex items-center justify-between px-4 py-1 text-xs text-terminal-dim border-b border-terminal-dim/30 select-none shrink-0"
    aria-label={m.header_aria()}
>
    <h1 class="shrink-0">TERMINAL STORIES</h1>

    <span class="flex items-center gap-2 sm:gap-4 min-w-0 px-2">
        {#if view === "story" && currentStory}
            <h2 class="text-terminal-amber truncate">{currentStory.title}</h2>
            <span class="shrink-0 hidden sm:inline">|</span>
        {/if}

        <span class="text-terminal-green shrink-0">
            {#if view === "boot"}{m.header_view_boot()}{/if}
            {#if view === "menu"}{m.header_view_menu()}{/if}
            {#if view === "story-info"}{m.header_view_story_info()}{/if}
            {#if view === "story"}{m.header_view_story()}{/if}
            {#if view === "wiki"}{m.header_view_wiki()}{/if}
            {#if view === "ai-setup"}{m.header_view_ai_setup()}{/if}
        </span>
    </span>

    <span class="cursor-blink text-terminal-green shrink-0">█</span>
</header>

<style>
    .status-bar {
        background: rgba( 0, 20, 0, 0.8 );
        /* Clear the notch / status bar when installed as a standalone PWA. */
        padding-top: calc( 0.25rem + env( safe-area-inset-top ) );
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

    @media (prefers-reduced-motion: reduce) {
        .cursor-blink {
            animation: none;
        }
    }
</style>
