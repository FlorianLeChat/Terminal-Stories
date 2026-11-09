<script lang="ts">
    import { onMount } from "svelte";
    import { resolve } from "$app/paths";
    import type { KnowledgeEntry } from "#lib";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import { categories, categoryLabel, deepLinkSearch, getEntry } from "#lib";

    interface Props {
        entry: KnowledgeEntry;
    }

    let { entry }: Props = $props();

    let titleEl: HTMLHeadingElement | undefined = $state();

    // Focus the title so keyboard and screen reader users start on the entry.
    onMount( () =>
    {
        titleEl?.focus( { preventScroll: true } );
    } );

    /**
     * Opens a related entry in place. The anchor keeps a real `?wiki=` href
     * (shareable, opens in a new tab with a modifier key), like the links of
     * the story info screen; a plain click switches entries without reloading.
     *
     * @param e - The click event.
     * @param id - The id of the related entry.
     * @author Claude
     */
    const openRelated = ( e: MouseEvent, id: string ) =>
    {
        const opensElsewhere = e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;
        if ( opensElsewhere ) return;

        e.preventDefault();
        terminal.openRelatedEntry( id );
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

<article class="border border-terminal-dim rounded px-4 py-3 my-4 max-w-2xl mx-auto">
    <header class="flex items-baseline gap-2 flex-wrap border-b border-terminal-dim/30 pb-2 mb-3">
        <span class="text-xs text-terminal-dim">
            <span aria-hidden="true">{categories.find( ( c ) => c.id === entry.category )?.icon}</span>
            {categoryLabel( entry.category )}
        </span>

        <span class="text-terminal-dim text-xs">·</span>
        <span class="text-terminal-dim text-xs">{entry.universe}</span>
    </header>

    <h2 bind:this={titleEl} class="text-terminal-white text-lg font-bold tracking-wide mb-1" tabindex="-1">{entry.name}</h2>

    {#if entry.aliases && entry.aliases.length > 0}
        <p class="text-terminal-dim text-xs italic mb-3">
            {m.wiki_entry_also_known()}{entry.aliases.join( ", " )}
        </p>
    {/if}

    {#if entry.image}
        <figure class="my-3 border border-terminal-dim/40 rounded overflow-hidden">
            <img
                src={entry.image}
                alt={entry.name}
                class="w-full max-h-56 object-cover grayscale"
            />
        </figure>
    {/if}

    <div class="space-y-2 text-[0.9375rem] leading-[1.7] text-terminal-text mt-3 max-w-[68ch]">
        {#each descriptionLines( entry.description ) as paragraph ( paragraph )}
            <p class="whitespace-pre-wrap">{paragraph}</p>
        {/each}
    </div>

    {#if entry.related && entry.related.length > 0}
        <aside class="border-t border-terminal-dim/30 mt-4 pt-3">
            <h3 class="text-terminal-dim text-xs mb-2 select-none">
                {m.wiki_entry_see_also()}
            </h3>

            <ul class="flex flex-col gap-1">
                {#each entry.related as relatedId ( relatedId )}
                    {@const related = getEntry( relatedId )}

                    {#if related}
                        <li>
                            <a
                                href={resolve( `/${ deepLinkSearch( { type: "wiki", id: relatedId } ) }` )}
                                class="inline-flex items-center gap-1 min-h-6 max-sm:min-h-11 text-terminal-cyan text-xs underline underline-offset-2 hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                                onclick={( e ) => openRelated( e, relatedId )}
                            >
                                <span aria-hidden="true">→ {categories.find( ( c ) => c.id === related.category )?.icon}</span>
                                {related.name}
                                <span class="text-terminal-dim">({categoryLabel( related.category )})</span>
                            </a>
                        </li>
                    {/if}
                {/each}
            </ul>
        </aside>
    {/if}
</article>
