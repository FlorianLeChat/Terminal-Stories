<script lang="ts">
    import { resolve } from "$app/paths";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import { deepLinkSearch, formatReadingTime, type EntryLink, type StoryInfoDetails } from "#lib";

    interface Props {
        /** Facts gathered for the story being previewed. */
        details: StoryInfoDetails;
    }

    let { details }: Props = $props();

    /**
     * Endings not found yet, clamped at zero: a save from an older version of the
     * story may list more endings than it now has.
     *
     * @author Claude
     */
    let endingsLeft = $derived( Math.max( 0, details.endingsTotal - details.endingsFound ) );

    /**
     * Opens an encyclopedia entry in place. The anchor keeps a real `?wiki=`
     * href (shareable, opens in a new tab with a modifier key), while a plain
     * click switches views without reloading the app.
     *
     * @param e - The click event.
     * @param entry - The entry to open.
     * @author Claude
     */
    const openEntry = ( e: MouseEvent, entry: EntryLink ) =>
    {
        const opensElsewhere = e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;
        if ( opensElsewhere ) return;

        e.preventDefault();
        terminal.openWiki();
        terminal.openRelatedEntry( entry.id );
    };
</script>

{#snippet entryLink( entry: EntryLink, label: string )}
    <a
        href={resolve( `/${ deepLinkSearch( { type: "wiki", id: entry.id } ) }` )}
        class="text-terminal-cyan underline underline-offset-2 hover:text-terminal-white"
        onclick={( e ) => openEntry( e, entry )}
    >{label}</a>
{/snippet}

<dl class="my-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm animate-fadein">
    <dt class="text-terminal-dim">{m.story_info_reading_label()}</dt>
    <dd class="text-terminal-text">
        {m.story_item_reading_time_value( { duration: formatReadingTime( details.readingMinutes ) } )}
        <span class="text-terminal-dim">·</span>
        {m.story_item_explore_time_value( { duration: formatReadingTime( details.fullMinutes ) } )}
    </dd>

    <dt class="text-terminal-dim">{m.story_info_endings_label()}</dt>
    <dd class="text-terminal-text">
        <span class="tracking-widest" aria-hidden="true"><span class="text-terminal-green">{"●".repeat( details.endingsFound )}</span><span class="text-terminal-dim">{"○".repeat( endingsLeft )}</span></span>
        <span>{m.story_info_endings_value( { found: details.endingsFound, total: details.endingsTotal } )}</span>
    </dd>

    {#if details.characters.length > 0}
        <dt class="text-terminal-dim">{m.story_info_characters_label()}</dt>
        <dd>
            <ul class="flex flex-wrap gap-x-3 gap-y-1">
                {#each details.characters as character ( character.id )}
                    <li>{@render entryLink( character, character.name )}</li>
                {/each}
            </ul>
        </dd>
    {/if}

    {#if details.universe}
        <dt class="text-terminal-dim">{m.story_info_universe_label()}</dt>
        <dd>{@render entryLink( details.universe, m.story_info_universe_link( { universe: details.universe.name } ) )}</dd>
    {/if}
</dl>

<style>
    .animate-fadein {
        animation: fadein 0.15s ease-in;
    }

    @keyframes fadein {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .animate-fadein {
            animation: none;
        }
    }
</style>
