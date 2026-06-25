<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        ondone: () => void;
    }

    let { ondone }: Props = $props();

    const bootLines: { text: string; delay: number; blink?: boolean }[] = [
        { text: "Raven Green 2026.07.1 LTS v1.0.0 (GNU/Linux 7.0.2-7-generic x86_64)", delay: 0 },
        { text: "An Open Source Operating System made with love by Raven Industries © 2026", delay: 120 },
        { text: "", delay: 200 },
        { text: "Initialisation du système narratif...", delay: 350 },
        { text: "[OK] Chargement du moteur d'histoires", delay: 600 },
        { text: "[OK] Lecture des données de scénario", delay: 800 },
        { text: "[OK] Validation des arbres de choix", delay: 950 },
        { text: "[OK] Chargement des personnages", delay: 1100 },
        { text: "", delay: 1200 },
        { text: "3 histoires chargées.", delay: 1350 },
        { text: "", delay: 1450 },
        { text: "Appuyez sur ENTRÉE pour commencer.", delay: 1600, blink: true }
    ];

    // Reveal flag per boot line, and whether the whole sequence has finished.
    let visible = $state( bootLines.map( () => false ) );
    let done = $state( false );

    // Reveal each boot line on its own delay to fake a system booting up; the
    // last line flips `done`, after which input is accepted.
    // When the OS requests reduced motion, all lines are shown immediately.
    onMount( () =>
    {
        const prefersReducedMotion = window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches;

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

                if ( i === bootLines.length - 1 )
                {
                    done = true;
                }
            }, bootLines[ i ].delay );
        } );
    } );

    /**
     * Advances past the boot screen when ENTER is pressed, once the sequence
     * has finished.
     *
     * @param e - The keyboard event.
     * @author Claude
     */
    const handleKey = ( e: KeyboardEvent ) =>
    {
        if ( done && e.key === "Enter" ) ondone();
    };

    /**
     * Advances past the boot screen on click, once the sequence has finished.
     *
     * @author Claude
     */
    const handleClick = () =>
    {
        if ( done ) ondone();
    };
</script>

<svelte:window onkeydown={handleKey} />

<button
    class="flex-1 text-left flex flex-col justify-center px-8 font-mono select-none"
    aria-label="Démarrage du système — appuyez sur Entrée pour continuer"
    onclick={handleClick}
>
    {#each bootLines as line, i ( i )}
        {#if visible[ i ]}
            <div
                class="leading-relaxed animate-fadein text-sm"
                class:text-terminal-green={!line.blink}
                class:text-terminal-amber={line.blink}
                class:blink-text={line.blink}
            >
                {#if line.text === ""}
                    &nbsp;
                {:else}
                    {line.text}
                {/if}
            </div>
        {/if}
    {/each}
</button>

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

    .blink-text {
        animation: fadein 0.2s ease-in, blink 1.2s step-end infinite;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.2;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .animate-fadein,
        .blink-text {
            animation: none;
        }
    }
</style>
