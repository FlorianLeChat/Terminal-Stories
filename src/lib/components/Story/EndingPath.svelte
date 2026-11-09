<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import type { EndingPathStep, StoryLocale } from "#lib";

    interface Props {
        /** Heading of the recap, e.g. "PATH TAKEN". */
        title: string;
        /** Branching points from the opening scene to the ending, in order. */
        steps: EndingPathStep[];
        /** Language of the story, which the recap is printed in. */
        locale: StoryLocale;
    }

    let { title, steps, locale }: Props = $props();

    const headingId = $props.id();

    /**
     * Number of discarded branches that can still lead to an ending not found yet.
     * The ✧ legend and its screen reader summary only show when it is positive.
     *
     * @author Claude
     */
    let unfoundBranchCount = $derived(
        steps.reduce( ( total, step ) => total + step.choices.filter( ( choice ) => choice.leadsToUnfoundEnding ).length, 0 )
    );
    let hasUnfoundBranch = $derived( unfoundBranchCount > 0 );

    /**
     * Pads a 1-based step number to two digits, like a console listing.
     *
     * @param index - The 0-based position of the step.
     * @returns The padded step number.
     * @author Claude
     */
    const stepNumber = ( index: number ): string =>
    {
        return String( index + 1 ).padStart( 2, "0" );
    };
</script>

<!--
    Recap printed under an ending: one entry per choice made, the pick in
    pale phosphor, the branches left behind struck through, a ✧ on those still
    hiding an unfound ending. Screen readers only hear the pick and the ✧
    branches; the other discarded branches are visual context.
-->
<section class="my-3 border-t border-b border-terminal-dim/40 py-3 animate-fadein" aria-labelledby={headingId}>
    <h2 id={headingId} class="text-terminal-amber text-xs font-bold tracking-widest mb-2">
        {title} · {m.ending_path_count( { count: steps.length }, { locale } )}
    </h2>

    {#if hasUnfoundBranch}
        <p class="sr-only">{m.ending_path_summary( { count: unfoundBranchCount }, { locale } )}</p>
    {/if}

    <ol class="space-y-2">
        {#each steps as step, index ( index )}
            <li class="flex gap-3">
                <span class="text-terminal-dim text-xs pt-0.5 shrink-0" aria-hidden="true">{stepNumber( index )}</span>
                <span class="sr-only">{m.ending_path_step( { index: index + 1 }, { locale } )}</span>

                <ul class="min-w-0">
                    {#each step.choices as choice, choiceIndex ( choiceIndex )}
                        {@const isSpokenBranch = choice.isPicked || choice.leadsToUnfoundEnding}

                        <li class={choice.isPicked ? "text-terminal-white" : "text-terminal-dim"} aria-hidden={isSpokenBranch ? undefined : "true"}>
                            <span class="inline-block w-[2ch]" aria-hidden="true">{choice.isPicked ? "▸" : choice.leadsToUnfoundEnding ? "✧" : ""}</span>
                            <span class={choice.isPicked ? "" : "line-through"}>{choice.text}</span>
                            {#if !choice.isPicked && choice.leadsToUnfoundEnding}
                                <span class="sr-only">{m.ending_path_unfound( {}, { locale } )}</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </li>
        {/each}
    </ol>

    {#if hasUnfoundBranch}
        <p class="text-terminal-dim text-xs mt-3">
            <span aria-hidden="true">✧</span> {m.ending_path_unfound_legend( {}, { locale } )}
        </p>
    {/if}
</section>

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
