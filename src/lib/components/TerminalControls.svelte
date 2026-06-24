<script lang="ts">
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

<div class="shrink-0 border-t border-terminal-dim/30 px-4 py-1 text-xs font-mono text-terminal-dim flex justify-between select-none">
    <span>
        {#if view === "story"}
            [1-9] Choix &nbsp;|&nbsp; {#if isAnimating}[ESPACE] Passer &nbsp;|&nbsp; {/if}[ÉCHAP] Menu
        {:else if view === "story-info"}
            {#if hasSave}
                [ENTRÉE] Reprendre &nbsp;|&nbsp; [N] Nouvelle partie &nbsp;|&nbsp; [ÉCHAP] Retour
            {:else}
                [ENTRÉE] Commencer &nbsp;|&nbsp; [ÉCHAP] Retour
            {/if}
        {:else if view === "menu"}
            {#if searchActive}
                [↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Sélectionner &nbsp;|&nbsp; [ÉCHAP] Annuler la recherche
            {:else}
                [↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Sélectionner &nbsp;|&nbsp; [G] Genre &nbsp;|&nbsp; [L]
                Langue &nbsp;|&nbsp; [C] Réinitialiser &nbsp;|&nbsp; [W] Encyclopédie &nbsp;|&nbsp; [/] Recherche
            {/if}
        {:else if view === "wiki"}
            {#if wikiEntryOpen}
                [ÉCHAP] Retour à la liste
            {:else if searchActive}
                [↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Consulter &nbsp;|&nbsp; [ÉCHAP] Annuler la recherche
            {:else}
                [←→] Rubrique &nbsp;|&nbsp; [↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Consulter &nbsp;|&nbsp;
                [ÉCHAP] Menu &nbsp;|&nbsp; [/] Recherche
            {/if}
        {/if}
    </span>

    <span class="opacity-40">1.0.0</span>
</div>
