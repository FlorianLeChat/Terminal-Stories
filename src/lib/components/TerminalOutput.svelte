<script lang="ts">
    import type { TerminalLine } from "$lib/stores/terminal";

    interface Props {
        lines?: TerminalLine[];
    }

    let { lines = [] }: Props = $props();

    let container: HTMLElement;

    // Auto-scroll to the bottom whenever new lines are appended, so the latest
    // narration stays in view like a real terminal.
    $effect( () =>
    {
        void lines.length;

        if ( container )
        {
            container.scrollTop = container.scrollHeight;
        }
    } );

    /**
     * Maps a terminal line type to its Tailwind styling classes.
     *
     * @param type - The kind of line being rendered.
     * @returns The CSS classes for that line type.
     * @author Claude
     */
    const lineClass = ( type: TerminalLine[ "type" ] ): string =>
    {
        const map: Record<TerminalLine[ "type" ], string> = {
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

        return map[ type ] ?? "text-terminal-green";
    };

    /**
     * Splits a percentage into filled / empty block counts for a progress bar.
     * Both parts use the same `█` glyph so every block is identical width.
     *
     * @param percent - Value between 0 and 100.
     * @param total - Total number of blocks (default 10).
     * @returns An object with the two repeated strings.
     * @author Claude
     */
    const buildProgressBar = ( percent: number, total = 10 ): { filled: string; empty: string } =>
    {
        const filledCount = Math.round( ( percent / 100 ) * total );

        return {
            filled: "█".repeat( filledCount ),
            empty: "█".repeat( total - filledCount )
        };
    };
</script>

<div
    bind:this={container}
    class="flex-1 overflow-y-auto px-4 py-2 font-mono text-sm leading-relaxed scrollbar-terminal"
>
    {#each lines as line ( line.id )}
        {#if line.type === "image" && line.imageSrc}
            <div class="my-3 border border-terminal-dim/30 rounded overflow-hidden max-w-xl animate-fadein">
                <img src={line.imageSrc} alt="" class="w-full max-h-44 object-cover grayscale opacity-75" />
            </div>
        {:else if line.type === "save"}
            <div class="my-2 border border-terminal-amber rounded px-3 py-2 bg-terminal-amber/8 animate-fadein select-none">
                <div class="flex items-center gap-2 text-terminal-amber font-bold text-xs tracking-widest">
                    <span>◉</span>
                    <span>SAUVEGARDE TROUVÉE</span>
                </div>

                <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-xs font-mono">
                        <span class="text-terminal-amber">{buildProgressBar( line.savePercent ?? 0 ).filled}</span><span class="text-terminal-dim/50">{buildProgressBar( line.savePercent ?? 0 ).empty}</span>
                    </span>

                    <span class="text-terminal-amber text-xs font-bold">{line.savePercent ?? 0}%</span>
                    <span class="text-terminal-dim text-xs">progression</span>
                </div>
            </div>
        {:else if line.text === ""}
            <div class="h-3"></div>
        {:else}
            <div class="line {lineClass( line.type )} animate-fadein">
                {#if line.type === "separator"}
                    <span class="select-none opacity-40">{line.text}</span>
                {:else}
                    {line.text}
                {/if}
            </div>
        {/if}
    {/each}
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
            transform: translateY(2px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
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
</style>
