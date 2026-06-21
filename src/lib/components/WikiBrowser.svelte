<script lang="ts">
    import { terminal } from "$lib/stores/terminal";
    import { categories,
        availableUniverses,
        availableWikiLanguages,
        filterEntries,
        getEntry,
        countByCategory,
        categoryLabel,
        getLanguageForUniverse } from "$lib/data/knowledge";

    let wiki = $derived( $terminal.wiki );
    let entries = $derived( filterEntries( wiki.category, wiki.language, wiki.universe ) );
    let currentEntry = $derived( wiki.selectedEntryId ? getEntry( wiki.selectedEntryId ) : null );
    let filteredUniverses = $derived( wiki.language
        ? availableUniverses.filter( ( u ) => getLanguageForUniverse( u ) === wiki.language )
        : availableUniverses );

    const categoryColors: Record<string, string> = {
        universe: "text-terminal-cyan",
        character: "text-terminal-amber",
        location: "text-emerald-400",
        era: "text-purple-400",
        event: "text-red-400"
    };

    function color( category: string ): string
    {
        return categoryColors[ category ] ?? "text-terminal-green";
    }

    function descriptionLines( text: string | string[] ): string[]
    {
        return Array.isArray( text ) ? text : [ text ];
    }
</script>

<div class="flex-1 overflow-y-auto px-4 py-2 font-mono scrollbar-terminal">
    <div class="mb-4 text-center select-none">
        <pre class="text-terminal-cyan text-xs leading-tight opacity-80">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
        <pre class="text-terminal-cyan text-xs leading-tight opacity-80">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

        <p class="text-terminal-dim text-xs mt-2 tracking-widest">— ENCYCLOPÉDIE DES UNIVERS INTERACTIFS —</p>
    </div>

    {#if !currentEntry}
        <div class="border border-terminal-dim/40 rounded px-3 py-2 mb-3 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-terminal-dim text-xs w-20 shrink-0 select-none">RUBRIQUE</span>

                {#each categories as cat ( cat.id )}
                    <button
                        class="text-xs px-2 py-0.5 rounded border transition-colors duration-100 {wiki.category === cat.id
                            ? `border-terminal-green bg-terminal-green/15 ${ color( cat.id ) }`
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        onclick={() => terminal.setWikiCategory( cat.id )}
                    >
                        {cat.icon} {cat.label}
                        <span class="opacity-50">({countByCategory( cat.id, wiki.language, wiki.universe )})</span>
                    </button>
                {/each}
            </div>

            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-terminal-dim text-xs w-20 shrink-0 select-none">LANGUE</span>

                {#each availableWikiLanguages as language ( language )}
                    <button
                        class="text-xs px-2 py-0.5 rounded border transition-colors duration-100 {wiki.language === language
                            ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        onclick={() => terminal.setWikiLanguage( language )}
                    >
                        {language}
                    </button>
                {/each}
            </div>

            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-terminal-dim text-xs w-20 shrink-0 select-none">UNIVERS</span>

                {#each filteredUniverses as universe ( universe )}
                    <button
                        class="text-xs px-2 py-0.5 rounded border transition-colors duration-100 {wiki.universe === universe
                            ? "border-terminal-green bg-terminal-green/15 text-terminal-white"
                            : "border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white"}"
                        onclick={() => terminal.setWikiUniverse( universe )}
                    >
                        {universe}
                    </button>
                {/each}
            </div>
        </div>

        <div class="text-terminal-dim text-xs mb-3 text-center">
            [←→] Rubrique &nbsp;|&nbsp; [↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Consulter &nbsp;|&nbsp; [ÉCHAP] Menu
        </div>

        {#if entries.length === 0}
            <div class="border border-terminal-dim/40 rounded px-3 py-8 mb-4 text-center text-terminal-dim text-sm">
                Aucune entrée dans cette rubrique pour ce filtre.
            </div>
        {:else}
            <div class="border border-terminal-dim rounded px-2 py-1 mb-4">
                {#each entries as entry, i ( entry.id )}
                    <button
                        class="w-full text-left px-3 py-2.5 rounded transition-all duration-100 block {i === wiki.selectedIndex
                            ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                            : "border-l-2 border-transparent hover:bg-white/5"}"
                        onclick={() => terminal.openWikiEntry( entry.id )}
                        onmouseenter={() => terminal.navigateWiki( i )}
                    >
                        <div class="flex items-baseline gap-3">
                            <span class="text-xs shrink-0 {color( entry.category )}">{categories.find( ( c ) => c.id
                              === entry.category )?.icon}</span>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-baseline gap-2 flex-wrap">
                                    <span class="text-terminal-white font-bold text-sm">{entry.name}</span>
                                    <span class="text-terminal-dim text-xs shrink-0">· {entry.universe}</span>
                                </div>

                                <div class="text-terminal-green text-xs mt-0.5 opacity-80 leading-relaxed">
                                    {entry.summary}
                                </div>
                            </div>
                        </div>
                    </button>

                    {#if i < entries.length - 1}
                        <div class="border-t border-terminal-dim/20 mx-3"></div>
                    {/if}
                {/each}
            </div>
        {/if}

        <div class="text-terminal-dim text-xs text-center opacity-50 pb-4">
            {entries.length} entrée{entries.length > 1 ? "s" : ""} — {categoryLabel( wiki.category )}
            {wiki.universe ? `· ${ wiki.universe }` : ""}
        </div>
    {:else}
        <div class="border border-terminal-dim rounded px-4 py-3 mb-4 max-w-2xl mx-auto">
            <div class="flex items-baseline gap-2 flex-wrap border-b border-terminal-dim/30 pb-2 mb-3">
                <span class="text-xs {color( currentEntry.category )}">
                    {categories.find( ( c ) => c.id === currentEntry.category )?.icon}
                    {categoryLabel( currentEntry.category )}
                </span>
                <span class="text-terminal-dim text-xs">·</span>
                <span class="text-terminal-dim text-xs">{currentEntry.universe}</span>
            </div>

            <h2 class="text-terminal-white text-lg font-bold tracking-wide mb-1">{currentEntry.name}</h2>

            {#if currentEntry.aliases && currentEntry.aliases.length > 0}
                <p class="text-terminal-dim text-xs italic mb-3">
                    Aussi connu sous : {currentEntry.aliases.join( ", " )}
                </p>
            {/if}

            <div class="space-y-2 text-sm leading-relaxed text-terminal-green mt-3">
                {#each descriptionLines( currentEntry.description ) as paragraph ( paragraph )}
                    <p class="whitespace-pre-wrap">{paragraph}</p>
                {/each}
            </div>

            {#if currentEntry.tags && currentEntry.tags.length > 0}
                <div class="flex gap-1 mt-4 flex-wrap">
                    {#each currentEntry.tags as tag ( tag )}
                        <span class="text-terminal-dim text-xs opacity-60">#{tag}</span>
                    {/each}
                </div>
            {/if}

            {#if currentEntry.related && currentEntry.related.length > 0}
                <div class="border-t border-terminal-dim/30 mt-4 pt-3">
                    <p class="text-terminal-dim text-xs mb-2 select-none">VOIR AUSSI</p>

                    <div class="flex flex-col gap-1">
                        {#each currentEntry.related as relatedId ( relatedId )}
                            {@const related = getEntry( relatedId )}

                            {#if related}
                                <button
                                    class="text-left text-terminal-cyan text-xs hover:text-terminal-white transition-colors duration-100"
                                    onclick={() => terminal.openRelatedEntry( relatedId )}
                                >
                                    → {categories.find( ( c ) => c.id === related.category )?.icon}
                                    {related.name}
                                    <span class="text-terminal-dim opacity-60">({categoryLabel( related.category )})</span>
                                </button>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div class="text-terminal-dim text-xs text-center opacity-60 pb-4">
            [ÉCHAP] Retour à la liste
        </div>
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
