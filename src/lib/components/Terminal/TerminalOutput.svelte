<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { untrack } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { buildProgressBar } from "$lib";
    import type { TerminalLine } from "$lib/stores/terminal";

    /**
     * Maps a terminal line type to its Tailwind styling classes.
     * Defined at module level so the object is created once, not on every call.
     *
     * @author Claude
     */
    const LINE_CLASS_MAP: Record<TerminalLine[ "type" ], string> = {
        system: "text-terminal-dim",
        narrator: "text-terminal-green",
        speaker: "text-terminal-amber font-bold",
        choice: "text-terminal-cyan cursor-pointer hover:text-terminal-white",
        action: "text-terminal-dim italic",
        consequence: "text-terminal-green italic",
        ending: "text-terminal-amber",
        error: "text-red-500",
        title: "text-terminal-white text-xl font-bold tracking-widest",
        separator: "text-terminal-dim",
        image: "",
        save: ""
    };

    /**
     * Returns the Tailwind styling classes for a terminal line type.
     *
     * @param type - The kind of line being rendered.
     * @returns The CSS classes for that line type.
     * @author Claude
     */
    const lineClass = ( type: TerminalLine[ "type" ] ): string =>
    {
        return LINE_CLASS_MAP[ type ] ?? "text-terminal-green";
    };

    interface Props {
        lines?: TerminalLine[];
        /** When false, all lines appear instantly with no typewriter effect. */
        animated?: boolean;
        /** Increment to skip the current animation and flush all pending lines. */
        skipSignal?: number;
        /** True while lines are being typed out; bound to the parent for hint display. */
        isAnimating?: boolean;
        /** Called when the user clicks a choice button; receives the 1-based choice index. */
        onchoice?: ( choiceIndex: number ) => void;
    }

    let { lines = [], animated = true, skipSignal = 0, isAnimating = $bindable( false ), onchoice }: Props = $props();

    let container: HTMLElement;

    /** Lines fully rendered to the terminal. */
    let displayed = $state<TerminalLine[]>( [] );
    /** The line currently being typed out character by character. */
    let typingLine = $state<TerminalLine | null>( null );
    /** Characters of the typing line revealed so far. */
    let typingText = $state( "" );

    /**
     * Non-reactive processing state — plain JS vars so the $effect only
     * re-runs when `lines` changes, not when these internal flags flip.
     */
    let pendingQueue: TerminalLine[] = [];
    let isProcessing = false;
    /** Monotonic counter — incremented on reset to cancel stale timeouts. */
    let generation = 0;
    /** IDs already queued or rendered; prevents double-processing. */
    const knownIds = new SvelteSet<number>();
    /** IDs of lines that were revealed via typewriter — no fade-in on transfer to displayed. */
    const typedIds = new SvelteSet<number>();

    /** Line types that receive a character-by-character typing effect. */
    const TYPED_TYPES = new Set( [ "narrator", "speaker", "ending", "action", "consequence" ] );
    /** Milliseconds between each revealed character. */
    const TYPING_SPEED = 18;
    /** True when the OS requests reduced motion — disables the typewriter effect. */
    const prefersReducedMotion = typeof window !== "undefined"
        ? window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches
        : false;

    $effect( () =>
    {
        // Only `lines` is tracked — everything inside untrack is side effect only.
        const incoming = lines;

        untrack( () =>
        {
            if ( incoming.length === 0 )
            {
                // Full reset — also invalidate any running timeout via generation bump.
                generation++;
                displayed = [];
                typingLine = null;
                typingText = "";
                pendingQueue = [];
                isProcessing = false;
                isAnimating = false;
                knownIds.clear();
                typedIds.clear();
                return;
            }

            const newLines = incoming.filter( ( l ) => !knownIds.has( l.id ) );
            if ( newLines.length === 0 ) return;

            newLines.forEach( ( l ) => knownIds.add( l.id ) );
            pendingQueue.push( ...newLines );

            if ( !isProcessing )
            {
                processNext( generation );
            }
        } );
    } );

    $effect( () =>
    {
        // Only `skipSignal` is tracked.
        const sig = skipSignal;

        untrack( () =>
        {
            if ( sig > 0 ) flushAll();
        } );
    } );

    /**
     * Instantly moves all queued and in-progress lines to `displayed`, cancelling
     * any running typewriter animation.
     *
     * @author Claude
     */
    const flushAll = () =>
    {
        generation++;

        const remaining = [ ...pendingQueue ];
        pendingQueue = [];

        if ( typingLine )
        {
            typedIds.add( typingLine.id );
            displayed = [ ...displayed, typingLine ];
            typingLine = null;
            typingText = "";
        }

        remaining.forEach( ( l ) => typedIds.add( l.id ) );
        displayed = [ ...displayed, ...remaining ];
        isProcessing = false;
        isAnimating = false;
    };

    /**
     * Pops lines from the queue and renders them. Instant lines are batched
     * and flushed together; animated lines kick off `typeChar` asynchronously.
     *
     * @param gen - Generation at dispatch time; stale calls exit early.
     * @author Claude
     */
    const processNext = ( gen: number ) =>
    {
        if ( gen !== generation ) return;

        const instantBatch: TerminalLine[] = [];

        while ( pendingQueue.length > 0 )
        {
            const next = pendingQueue[ 0 ];
            const needsTyping = animated && !prefersReducedMotion && TYPED_TYPES.has( next.type ) && next.text.length > 0;

            if ( needsTyping ) break;

            pendingQueue.shift();
            instantBatch.push( next );
        }

        if ( instantBatch.length > 0 )
        {
            displayed = [ ...displayed, ...instantBatch ];
        }

        if ( pendingQueue.length === 0 )
        {
            isProcessing = false;
            isAnimating = false;
            return;
        }

        isProcessing = true;
        isAnimating = true;
        const next = pendingQueue.shift();

        if ( !next )
        {
            isProcessing = false;
            return;
        }

        typingLine = next;
        typingText = "";
        typeChar( next, 0, gen );
    };

    /**
     * Reveals one more character of `line`, then schedules itself for the
     * next character. Moves the line to `displayed` when all chars are shown.
     *
     * @param line - The line being animated.
     * @param i - Index of the next character to reveal.
     * @param gen - Generation guard; stale timeouts exit early.
     * @author Claude
     */
    const typeChar = ( line: TerminalLine, i: number, gen: number ) =>
    {
        if ( gen !== generation ) return;

        if ( i >= line.text.length )
        {
            typedIds.add( line.id );
            displayed = [ ...displayed, line ];
            typingLine = null;
            typingText = "";
            processNext( gen );
            return;
        }

        typingText = line.text.slice( 0, i + 1 );
        setTimeout( () => typeChar( line, i + 1, gen ), TYPING_SPEED );
    };

    const scrollToBottom = () =>
    {
        if ( container )
        {
            container.scrollTop = container.scrollHeight;
        }
    };

    // Keep the view scrolled to the bottom when displayed or typing text changes.
    $effect( () =>
    {
        void displayed.length;
        void typingText;
        scrollToBottom();
    } );

</script>

<div
    bind:this={container}
    class="flex-1 overflow-y-auto px-4 py-2 text-sm leading-relaxed scrollbar-terminal"
    aria-live="polite"
    aria-label={m.terminal_output_aria()}
>
    {#each displayed as line ( line.id )}
        {#if line.type === "image" && line.imageSrc}
            <figure class="my-3 border border-terminal-dim/30 rounded overflow-hidden max-w-xl animate-fadein">
                <img src={line.imageSrc} alt="" class="w-full max-h-44 object-cover grayscale opacity-75" />
            </figure>
        {:else if line.type === "save"}
            {@const bar = buildProgressBar( line.savePercent ?? 0 )}

            <aside class="my-2 border border-terminal-amber rounded px-3 py-2 bg-terminal-amber/8 animate-fadein select-none" aria-label={m.terminal_save_aria()}>
                <p class="flex items-center gap-2 text-terminal-amber font-bold text-xs tracking-widest">
                    <span>◉</span>
                    <span>{m.terminal_save_label()}</span>
                </p>

                <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-xs">
                        <span class="text-terminal-amber">{bar.filled}</span><span class="text-terminal-dim/50">{bar.empty}</span>
                    </span>

                    <output class="text-terminal-amber text-xs font-bold">{m.story_item_progress_value( { value: ( line.savePercent ?? 0 ) / 100 } )}</output>
                    <span class="text-terminal-dim text-xs">{m.terminal_save_progress()}</span>
                </div>
            </aside>
        {:else if line.text === ""}
            <div class="h-3" aria-hidden="true"></div>
        {:else if line.type === "choice"}
            <button
                class="line {lineClass( line.type )} {typedIds.has( line.id ) ? "" : "animate-fadein"} w-full text-left"
                onclick={() => onchoice?.( line.choiceIndex ?? 0 )}
            >
                {line.text}
            </button>
        {:else}
            <div class="line {lineClass( line.type )} {typedIds.has( line.id ) ? "" : "animate-fadein"}">
                {#if line.type === "separator"}
                    <span class="select-none opacity-40">{line.text}</span>
                {:else}
                    {line.text}
                {/if}
            </div>
        {/if}
    {/each}

    {#if typingLine && isAnimating}
        <output class="line block {lineClass( typingLine.type )}">
            {typingText}<span class="cursor-blink">▋</span>
        </output>
    {/if}
</div>

<style>
    .line {
        white-space: pre-wrap;
        word-break: break-word;
    }

    .animate-fadein {
        animation: fadein 0.15s ease-in;
    }

    @keyframes fadein {
        from {
            opacity: 0;
            transform: translateY( 2px );
        }
        to {
            opacity: 1;
            transform: translateY( 0 );
        }
    }

    .cursor-blink {
        display: inline-block;
        margin-left: 1px;
        animation: blink 0.7s step-start infinite;
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

    @media (prefers-reduced-motion: reduce) {
        .animate-fadein,
        .cursor-blink {
            animation: none;
        }
    }
</style>
