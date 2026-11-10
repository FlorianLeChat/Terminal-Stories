<script lang="ts">
    import { onMount } from "svelte";
    import * as m from "#lib/locales/messages.js";
    import { storiesMeta, playBoot, playTypingTick, resumeAudio } from "#lib";

    interface Props {
        ondone: () => void;
    }

    let { ondone }: Props = $props();

    const isTouchScreen = typeof window !== "undefined" && window.matchMedia( "(pointer: coarse)" ).matches;

    /**
     * Final boot line: invites a tap on touch screens, which have no ENTER key.
     * Lines are only revealed after mount, so the server-side value is never shown.
     *
     * @author Claude
     */
    const startPrompt = isTouchScreen ? m.boot_press_tap() : m.boot_press_enter();

    const bootLines: { text: string; delay: number; blink?: boolean }[] = [
        { text: "Raven Green 2026.07.1 LTS (GNU/Linux 7.0.2-7-generic x86_64)", delay: 0 },
        { text: m.boot_os_tagline(), delay: 120 },
        { text: "", delay: 200 },
        { text: m.boot_init(), delay: 350 },
        { text: m.boot_engine(), delay: 600 },
        { text: m.boot_scenario(), delay: 800 },
        { text: m.boot_choices(), delay: 950 },
        { text: m.boot_characters(), delay: 1100 },
        { text: "", delay: 1200 },
        { text: m.boot_loaded( { count: storiesMeta.length } ), delay: 1350 },
        { text: "", delay: 1450 },
        { text: startPrompt, delay: 1600, blink: true }
    ];

    let visible = $state( bootLines.map( () => false ) );
    let done = $state( false );

    // Reveal each line on its own delay (all at once under reduced motion); the last one sets `done`.
    onMount( () =>
    {
        const prefersReducedMotion = window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches;

        // Fanfare synced with the "initialize" line (index 3); both calls no-op while muted.
        const fanfareDelay = prefersReducedMotion ? 0 : bootLines[ 3 ].delay;
        setTimeout( () =>
        {
            resumeAudio();
            playBoot();
        }, fanfareDelay );

        if ( prefersReducedMotion )
        {
            visible = bootLines.map( () => true );
            done = true;
            return;
        }

        bootLines.forEach( ( _line, i ) =>
        {
            setTimeout( () =>
            {
                visible[ i ] = true;

                const hasText = bootLines[ i ].text !== "";
                if ( hasText ) playTypingTick();

                if ( i === bootLines.length - 1 )
                {
                    done = true;
                }
            }, bootLines[ i ].delay );
        } );
    } );

    /**
     * Advances past the boot screen when ENTER is pressed, once the sequence
     * has finished. Ignored while a button or link has focus: it handles ENTER
     * itself, and starting here too would run the transition twice.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleKey = ( e: KeyboardEvent ) =>
    {
        const isControlFocused = document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLAnchorElement;
        if ( isControlFocused ) return;

        if ( done && e.key === "Enter" ) ondone();
    };

    /**
     * Advances past the boot screen, once the sequence has finished.
     *
     * @author Claude
     */
    const handleStart = () =>
    {
        if ( done ) ondone();
    };

    /**
     * Advances past the boot screen on a tap/click anywhere on the screen.
     * Other controls (sound toggle, source-code link, skip link) keep their
     * own job, and the start prompt handles its own click.
     *
     * @param e - The click event.
     * @author Claude
     */
    const handleScreenClick = ( e: MouseEvent ) =>
    {
        const target = e.target as HTMLElement | null;
        const isOnControl = Boolean( target?.closest( "a, button, input" ) );
        if ( isOnControl ) return;

        handleStart();
    };
</script>

<svelte:window onkeydown={handleKey} onclick={handleScreenClick} />

<section class="flex-1 flex flex-col justify-center px-4 sm:px-8 select-none">
    {#each bootLines as line, i ( i )}
        {#if visible[ i ]}
            {#if line.blink}
                <button type="button" class="self-start text-left leading-relaxed animate-fadein text-xs sm:text-sm wrap-break-word text-terminal-amber blink-text" onclick={handleStart}>
                    {line.text}
                </button>
            {:else}
                <p class="leading-relaxed animate-fadein text-xs sm:text-sm wrap-break-word text-terminal-green">
                    {#if line.text === ""}
                        &nbsp;
                    {:else}
                        {line.text}
                    {/if}
                </p>
            {/if}
        {/if}
    {/each}
</section>

<style>
    .animate-fadein {
        animation: fadein 0.2s ease-in;
    }

    @keyframes fadein {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    /* The theme's pulse floor keeps the signal prompt above 4.5:1 contrast. */
    .blink-text {
        animation: fadein 0.2s ease-in, pulse 1.6s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: var( --pulse-floor );
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .animate-fadein,
        .blink-text {
            animation: none;
        }
    }
</style>
