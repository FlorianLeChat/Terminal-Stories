<script lang="ts">
    import { asset } from "$app/paths";
    import { onDestroy, untrack } from "svelte";
    import type { AssetPath } from "$app/types";
    import * as m from "#lib/locales/messages.js";
    import { SvelteSet } from "svelte/reactivity";
    import EndingPath from "../Story/EndingPath.svelte";
    import type { TerminalLine } from "#lib/stores/terminal.ts";
    import StoryInfoDetails from "../Story/StoryInfoDetails.svelte";
    import { buildProgressBar, playTypingTick, type StoryLocale } from "#lib";

    /**
     * Maps a terminal line type to its Tailwind styling classes.
     * Defined at module level so the object is created once, not on every call.
     *
     * @author Claude
     */
    const LINE_CLASS_MAP: Record<TerminalLine[ "type" ], string> = {
        system: "text-terminal-dim",
        narrator: "text-terminal-text",
        speaker: "text-terminal-white font-bold",
        choice: "text-terminal-cyan cursor-pointer hover:text-terminal-white",
        action: "text-terminal-dim italic",
        consequence: "text-terminal-text italic",
        ending: "text-terminal-amber",
        error: "text-terminal-error",
        title: "text-terminal-white text-xl font-bold tracking-widest",
        separator: "text-terminal-dim",
        image: "",
        save: "",
        path: "",
        info: ""
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

    /**
     * Turns a validated scene image path into an `asset()` argument. Scene
     * images come from runtime story data (catalog, custom or AI stories), so
     * they cannot be checked against the static file list at compile time, and
     * stories saved earlier may still carry a leading slash that `asset()` no
     * longer accepts.
     *
     * @param source - The scene image path, already restricted to `assets/`.
     * @returns The path relative to the static directory.
     * @author Claude
     */
    const toAssetPath = ( source: string ): AssetPath =>
    {
        const relativePath = source.replace( /^\//, "" );

        return relativePath as AssetPath;
    };

    interface Props {
        lines?: TerminalLine[];
        /** When false, all lines appear instantly with no typewriter effect. */
        animated?: boolean;
        /** Increment to skip the current animation and flush all pending lines. */
        skipSignal?: number;
        /** True while lines are being typed out; bound to the parent for hint display. */
        isAnimating?: boolean;
        /**
         * Called when the user clicks a choice button; receives the 1-based
         * choice index and the id of the scene the choice belongs to.
         */
        onchoice?: ( choiceIndex: number, choiceSceneId?: string ) => void;
        /**
         * Language of the story on screen: the log is marked with it, and the
         * in-story states (chosen, not chosen, path recap) are printed in it.
         */
        locale: StoryLocale;
    }

    let { lines = [], animated = true, skipSignal = 0, isAnimating = $bindable( false ), onchoice, locale }: Props = $props();

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
    /**
     * Monotonic counter, bumped on reset, skip and unmount to cancel stale
     * timeouts (so the typewriter and its sound never run over the next view).
     *
     * @author Claude
     */
    let generation = 0;
    /** IDs already queued or rendered; prevents double-processing. */
    const knownIds = new SvelteSet<number>();
    /** IDs of lines that were revealed via typewriter — no fade-in on transfer to displayed. */
    const typedIds = new SvelteSet<number>();

    /** Line types that receive a character-by-character typing effect. */
    const TYPED_TYPES = new Set( [ "narrator", "speaker", "ending", "action", "consequence" ] );
    /** Milliseconds between each revealed character. */
    const TYPING_SPEED = 35;
    /**
     * Bounds (ms) for the random gap enforced between two typing ticks — chars
     * reveal every 18 ms, a sound per char would be a machine-gun, and a fixed
     * gap would sound robotic; randomizing it within this range mimics the
     * uneven rhythm of a real typist.
     */
    const TICK_INTERVAL_MIN = 60;
    const TICK_INTERVAL_MAX = 140;
    /** Timestamp of the last typing tick played, for throttling. */
    let lastTickAt = 0;
    /** Randomized minimum gap (ms) before the next tick may play; redrawn after each tick. */
    let nextTickInterval = TICK_INTERVAL_MIN;

    /**
     * Picks a random delay within the typing-tick bounds, so consecutive
     * ticks don't fall at a perfectly regular cadence.
     *
     * @returns A random interval in milliseconds between the configured bounds.
     * @author Claude
     */
    const randomTickInterval = (): number =>
    {
        return TICK_INTERVAL_MIN + Math.random() * ( TICK_INTERVAL_MAX - TICK_INTERVAL_MIN );
    };
    /** True when the OS requests reduced motion — disables the typewriter effect. */
    const prefersReducedMotion = typeof window !== "undefined"
        ? window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches
        : false;

    $effect( () =>
    {
        // Only `lines` is tracked; the untracked body is side effects only.
        const incoming = lines;

        untrack( () =>
        {
            if ( incoming.length === 0 )
            {
                // Full reset: the generation bump also cancels any running timeout.
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

    onDestroy( () =>
    {
        generation++;
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
            displayed.push( typingLine );
            typingLine = null;
            typingText = "";
        }

        remaining.forEach( ( l ) => typedIds.add( l.id ) );
        displayed.push( ...remaining );
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
            const needsTyping = animated && !prefersReducedMotion && !next.isRecap && TYPED_TYPES.has( next.type ) && next.text.length > 0;

            if ( needsTyping ) break;

            pendingQueue.shift();
            instantBatch.push( next );
        }

        if ( instantBatch.length > 0 )
        {
            displayed.push( ...instantBatch );
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
            displayed.push( line );
            typingLine = null;
            typingText = "";
            processNext( gen );
            return;
        }

        typingText = line.text.slice( 0, i + 1 );
        playTickThrottled( line.text[ i ] );
        setTimeout( () => typeChar( line, i + 1, gen ), TYPING_SPEED );
    };

    /**
     * Plays the soft typewriter tick for a revealed character, skipping
     * whitespace and enforcing a randomized minimum interval between two
     * ticks so the rapid character reveal doesn't turn into a continuous
     * buzz, and instead sounds like an actual person typing.
     *
     * @param char - The character just revealed.
     * @author Claude
     */
    const playTickThrottled = ( char: string ) =>
    {
        const isWhitespace = char.trim() === "";
        if ( isWhitespace ) return;

        const now = performance.now();
        const isTooSoon = now - lastTickAt < nextTickInterval;
        if ( isTooSoon ) return;

        lastTickAt = now;
        nextTickInterval = randomTickInterval();
        playTypingTick();
    };

    /** True while a scroll-to-bottom is already scheduled for the next frame. */
    let scrollQueued = false;

    /**
     * Scrolls the terminal to the bottom, coalescing bursts of requests into a
     * single write per animation frame. During the typewriter effect this fires
     * every ~18 ms; batching it avoids a forced synchronous layout per character.
     *
     * @author Claude
     */
    const scrollToBottom = () =>
    {
        if ( !container || scrollQueued ) return;

        scrollQueued = true;
        requestAnimationFrame( () =>
        {
            scrollQueued = false;
            if ( container ) container.scrollTop = container.scrollHeight;
        } );
    };

    /** A run of rendered lines: either one ordinary line or a scene's choices. */
    type OutputBlock = { kind: "line"; key: number; line: TerminalLine } | { kind: "choices"; key: number; lines: TerminalLine[] };

    /**
     * Displayed lines grouped into blocks: consecutive choice lines form one
     * ordered list, which screen readers announce with its item count.
     *
     * @author Claude
     */
    let blocks = $derived.by( (): OutputBlock[] =>
    {
        const result: OutputBlock[] = [];

        for ( const line of displayed )
        {
            const previous = result[ result.length - 1 ];
            const extendsChoiceGroup = line.type === "choice" && previous?.kind === "choices";

            if ( extendsChoiceGroup )
            {
                previous.lines.push( line );
            }
            else if ( line.type === "choice" )
            {
                result.push( { kind: "choices", key: line.id, lines: [ line ] } );
            }
            else
            {
                result.push( { kind: "line", key: line.id, line } );
            }
        }

        return result;
    } );

    /**
     * Key of the only pickable choice list, the scene being played: the last
     * block apart from trailing blank spacers, as long as it is unanswered
     * (an answered list stays inactive while its echo is pending). Once set,
     * focus moves to its first choice so keyboard and screen reader users
     * land on the new options.
     *
     * @author Claude
     */
    let liveChoicesKey = $derived.by( (): number | null =>
    {
        if ( typingLine !== null ) return null;

        for ( let i = blocks.length - 1; i >= 0; i-- )
        {
            const block = blocks[ i ];
            const isBlankSpacer = block.kind === "line" && block.line.text === "";

            if ( isBlankSpacer ) continue;

            const isUnanswered = block.kind === "choices" && chosenIndexByBlock[ block.key ] === undefined;

            return isUnanswered ? block.key : null;
        }

        return null;
    } );

    /**
     * Index picked in each choice list, keyed by the list's first line id.
     * Read from every incoming line, not only the displayed ones, so the pick
     * is struck through on click rather than once its echo has typed out.
     *
     * @author Claude
     */
    let chosenIndexByBlock = $derived.by( (): Partial<Record<number, number>> =>
    {
        const chosen: Partial<Record<number, number>> = {};
        let currentGroupKey: number | null = null;
        let previousWasChoice = false;

        for ( const line of lines )
        {
            const isChoice = line.type === "choice";

            if ( isChoice && !previousWasChoice ) currentGroupKey = line.id;

            const isEchoedPick = line.type === "action" && line.choiceIndex !== undefined;

            if ( isEchoedPick && currentGroupKey !== null )
            {
                chosen[ currentGroupKey ] = line.choiceIndex;
                currentGroupKey = null;
            }

            previousWasChoice = isChoice;
        }

        return chosen;
    } );

    /**
     * Picks a choice by click/tap. Buttons of answered scenes stay in the DOM
     * (so the log never re-announces them) but ignore activation, e.g. a SPACE
     * keyup landing on the button still focused from the previous pick.
     *
     * @param line - The choice line that was activated.
     * @param isLive - Whether the line belongs to the scene being played.
     * @author Claude
     */
    const handleChoiceClick = ( line: TerminalLine, isLive: boolean ) =>
    {
        if ( !isLive ) return;

        onchoice?.( line.choiceIndex ?? 0, line.choiceSceneId );
    };

    /**
     * Resolves how a choice line should read once its list is rendered: still
     * pickable, waiting (inactive while the scene types), picked, or left behind.
     *
     * @param line - The choice line.
     * @param isLive - Whether its list belongs to the scene being played.
     * @param pickedIndex - The index picked in its list, if any.
     * @returns The choice's display state.
     * @author Claude
     */
    const choiceState = ( line: TerminalLine, isLive: boolean, pickedIndex: number | undefined ): "live" | "waiting" | "chosen" | "discarded" =>
    {
        if ( isLive ) return "live";
        if ( pickedIndex === undefined ) return "waiting";

        const isPicked = line.choiceIndex === pickedIndex;

        return isPicked ? "chosen" : "discarded";
    };

    /** Text classes for each choice display state. */
    const CHOICE_STATE_CLASS: Record<ReturnType<typeof choiceState>, string> = {
        live: lineClass( "choice" ),
        waiting: "text-terminal-dim cursor-default",
        chosen: "text-terminal-white cursor-default",
        discarded: "text-terminal-dim line-through cursor-default"
    };

    $effect( () =>
    {
        const key = liveChoicesKey;
        if ( key === null || !container ) return;

        const firstChoice = container.querySelector<HTMLButtonElement>( `[data-choice-list="${ key }"] button` );
        firstChoice?.focus( { preventScroll: true } );
    } );

    $effect( () =>
    {
        void displayed.length;
        void typingText;
        scrollToBottom();
    } );

</script>

<!--
    role="log" announces each completed line once. The line being typed is
    hidden from assistive tech, so readers never hear it letter by letter.
    Each choice stays the same <button> for its whole life (only classes and
    attributes change once answered), so the log never re-announces a list;
    its chosen state lives in the accessible name, which the log does not
    announce, since the echo of the pick already says it once.
-->
<div
    bind:this={container}
    class="flex-1 overflow-y-auto px-4 py-2 text-[0.9375rem] leading-[1.7] scrollbar-terminal [&>*]:max-w-[68ch]"
    role="log"
    aria-live="polite"
    aria-relevant="additions"
    aria-label={m.terminal_output_aria()}
    lang={animated ? locale : undefined}
    tabindex="-1"
>
    {#each blocks as block ( block.key )}
        {#if block.kind === "choices"}
            {@const isLive = block.key === liveChoicesKey}
            {@const pickedIndex = chosenIndexByBlock[ block.key ]}

            <ol class="my-1" data-choice-list={block.key}>
                {#each block.lines as line ( line.id )}
                    {@const state = choiceState( line, isLive, pickedIndex )}
                    {@const stateLabel = state === "chosen" ? m.choice_state_chosen( {}, { locale } ) : state === "discarded" ? m.choice_state_discarded( {}, { locale } ) : ""}

                    <li class="wrap-break-word {typedIds.has( line.id ) ? "" : "animate-fadein"}">
                        <button
                            type="button"
                            class="choice-line flex min-h-11 sm:min-h-0 py-1.5 px-2 -mx-2 rounded w-full text-left {CHOICE_STATE_CLASS[ state ]}"
                            aria-label={stateLabel === "" ? undefined : `${ line.choiceIndex }. ${ line.text } ${ stateLabel }`}
                            aria-disabled={isLive ? undefined : "true"}
                            tabindex={isLive ? undefined : -1}
                            onclick={() => handleChoiceClick( line, isLive )}
                        >
                            <span class="w-[2ch] shrink-0" aria-hidden="true">{state === "chosen" ? "▸" : ""}</span>
                            <span class="choice-key shrink-0">[{line.choiceIndex}]&nbsp;</span>
                            <span>{line.text}</span>
                        </button>
                    </li>
                {/each}
            </ol>
        {:else}
            {@const line = block.line}

            {#if line.type === "image" && line.imageSrc}
                <figure class="my-3 border border-terminal-dim/30 rounded overflow-hidden max-w-xl animate-fadein">
                    <img src={asset( toAssetPath( line.imageSrc ) )} alt={line.imageAlt ?? ""} class="w-full max-h-44 object-cover grayscale opacity-75" />
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
                            <span class="text-terminal-amber">{bar.filled}</span><span class="text-terminal-dim">{bar.empty}</span>
                        </span>

                        <output class="text-terminal-amber text-xs font-bold">{m.story_item_progress_value( { value: ( line.savePercent ?? 0 ) / 100 } )}</output>
                        <span class="text-terminal-dim text-xs">{m.terminal_save_progress()}</span>
                    </div>
                </aside>
            {:else if line.type === "info" && line.info}
                <StoryInfoDetails details={line.info} />
            {:else if line.type === "path" && line.path}
                <EndingPath title={line.text} steps={line.path} {locale} />
            {:else if line.text === ""}
                <div class="h-3" aria-hidden="true"></div>
            {:else if line.type === "separator"}
                <div class="wrap-break-word whitespace-nowrap separator-line overflow-hidden {lineClass( line.type )} {typedIds.has( line.id ) ? "" : "animate-fadein"}" aria-hidden="true">
                    <span class="select-none opacity-60">{line.text}</span>
                </div>
            {:else}
                <div class="wrap-break-word {line.isRecap ? "text-terminal-dim" : lineClass( line.type )} {typedIds.has( line.id ) ? "" : "animate-fadein"}">
                    {line.text}
                </div>
            {/if}
        {/if}
    {/each}

    {#if typingLine && isAnimating}
        <div class="whitespace-pre-wrap {lineClass( typingLine.type )}" aria-hidden="true">
            {typingText}<span class="cursor-blink terminal-cursor">▋</span>
        </div>
    {/if}
</div>

<style>
    @media (pointer: coarse) {
        .choice-key {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset( 50% );
            white-space: nowrap;
        }
    }

    .choice-line[aria-disabled="true"]:active {
        background: transparent;
    }

    .choice-line:active {
        background: color-mix( in srgb, var( --color-terminal-green ) 12%, transparent );
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
        background: color-mix( in srgb, var( --color-terminal-dim ) 40%, transparent );
        border-radius: var( --radius-terminal );
    }

    @media (prefers-reduced-motion: reduce) {
        .animate-fadein,
        .cursor-blink {
            animation: none;
        }
    }
</style>
