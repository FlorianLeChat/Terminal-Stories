<script lang="ts">
    import { terminal } from "$lib/stores/terminal";

    interface Props {
        view: string;
    }

    let { view }: Props = $props();

    let currentStory = $derived( $terminal.currentStory );
</script>

<header
    class="status-bar flex items-center justify-between px-4 py-1 text-xs font-mono text-terminal-dim border-b border-terminal-dim/30 select-none shrink-0"
    aria-label="Barre d'état"
>
    <span>TERMINAL STORIES</span>

    <span class="flex items-center gap-4">
        {#if view === "story" && currentStory}
            <span class="text-terminal-amber">{currentStory.title}</span>
            <span>|</span>
        {/if}

        <span class="text-terminal-green">
            {#if view === "boot"}DÉMARRAGE{/if}
            {#if view === "menu"}MENU PRINCIPAL{/if}
            {#if view === "story-info"}INFO HISTOIRE{/if}
            {#if view === "story"}LECTURE EN COURS{/if}
            {#if view === "wiki"}BASE DE CONNAISSANCES{/if}
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
