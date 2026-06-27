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
    class="status-bar flex items-center justify-between px-4 py-1 text-xs font-mono text-terminal-dim border-b border-terminal-dim/30 select-none shrink-0"
    aria-label={m.header_aria()}
>
    <span>TERMINAL STORIES</span>

    <span class="flex items-center gap-4">
        {#if view === "story" && currentStory}
            <span class="text-terminal-amber">{currentStory.title}</span>
            <span>|</span>
        {/if}

        <span class="text-terminal-green">
            {#if view === "boot"}{m.header_view_boot()}{/if}
            {#if view === "menu"}{m.header_view_menu()}{/if}
            {#if view === "story-info"}{m.header_view_story_info()}{/if}
            {#if view === "story"}{m.header_view_story()}{/if}
            {#if view === "wiki"}{m.header_view_wiki()}{/if}
            {#if view === "ai-setup"}{m.header_view_ai_setup()}{/if}
        </span>
    </span>

    <span class="cursor-blink">█</span>
</header>

<style>
    .status-bar {
        background: rgba( 0, 20, 0, 0.8 );
    }

    .cursor-blink {
        animation: blink 1s step-end infinite;
        color: #00ff46;
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
