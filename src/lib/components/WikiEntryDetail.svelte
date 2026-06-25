<script lang="ts">
    import { terminal } from "$lib/stores/terminal";
    import { categories, categoryLabel, getEntry } from "$lib/data/knowledge";
    import type { KnowledgeEntry } from "$lib/types/knowledge";

    interface Props {
        entry: KnowledgeEntry;
    }

    let { entry }: Props = $props();

    const categoryColors: Record<string, string> = {
        universe: "text-terminal-cyan",
        character: "text-terminal-amber",
        location: "text-emerald-400",
        era: "text-purple-400",
        event: "text-red-400"
    };

    /**
     * Returns the Tailwind text-color class for a knowledge category.
     *
     * @param category - The category identifier.
     * @returns The CSS class used to color that category.
     * @author Claude
     */
    const color = ( category: string ): string =>
    {
        return categoryColors[ category ] ?? "text-terminal-green";
    };

    /**
     * Normalizes an entry description into a list of paragraphs.
     *
     * @param text - The description, as a single string or already split.
     * @returns The description as an array of paragraphs.
     * @author Claude
     */
    const descriptionLines = ( text: string | string[] ): string[] =>
    {
        return Array.isArray( text ) ? text : [ text ];
    };
</script>

<article class="border border-terminal-dim rounded px-4 py-3 mb-4 max-w-2xl mx-auto">
    <header class="flex items-baseline gap-2 flex-wrap border-b border-terminal-dim/30 pb-2 mb-3">
        <span class="text-xs {color( entry.category )}">
            {categories.find( ( c ) => c.id === entry.category )?.icon}
            {categoryLabel( entry.category )}
        </span>

        <span class="text-terminal-dim text-xs">·</span>
        <span class="text-terminal-dim text-xs">{entry.universe}</span>
    </header>

    <h2 class="text-terminal-white text-lg font-bold tracking-wide mb-1">{entry.name}</h2>

    {#if entry.aliases && entry.aliases.length > 0}
        <p class="text-terminal-dim text-xs italic mb-3">
            Aussi connu sous : {entry.aliases.join( ", " )}
        </p>
    {/if}

    {#if entry.image}
        <figure class="my-3 border border-terminal-dim/40 rounded overflow-hidden">
            <img
                src={entry.image}
                alt={entry.name}
                class="w-full max-h-56 object-cover grayscale opacity-80"
            />
        </figure>
    {/if}

    <div class="space-y-2 text-sm leading-relaxed text-terminal-green mt-3">
        {#each descriptionLines( entry.description ) as paragraph ( paragraph )}
            <p class="whitespace-pre-wrap">{paragraph}</p>
        {/each}
    </div>

    {#if entry.tags && entry.tags.length > 0}
        <ul class="flex gap-1 mt-4 flex-wrap">
            {#each entry.tags as tag ( tag )}
                <li class="text-terminal-dim text-xs opacity-60">#{tag}</li>
            {/each}
        </ul>
    {/if}

    {#if entry.related && entry.related.length > 0}
        <aside class="border-t border-terminal-dim/30 mt-4 pt-3">
            <h3 class="text-terminal-dim text-xs mb-2 select-none">VOIR AUSSI</h3>

            <ul class="flex flex-col gap-1">
                {#each entry.related as relatedId ( relatedId )}
                    {@const related = getEntry( relatedId )}

                    {#if related}
                        <li>
                            <button
                                class="text-left text-terminal-cyan text-xs hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                                onclick={() => terminal.openRelatedEntry( relatedId )}
                            >
                                → {categories.find( ( c ) => c.id === related.category )?.icon}
                                {related.name}
                                <span class="text-terminal-dim opacity-60">({categoryLabel( related.category )})</span>
                            </button>
                        </li>
                    {/if}
                {/each}
            </ul>
        </aside>
    {/if}
</article>

<p class="text-terminal-dim text-xs text-center opacity-60 pb-4">
    [ÉCHAP] Retour à la liste
</p>
