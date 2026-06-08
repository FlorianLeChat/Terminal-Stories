<script lang="ts">
    import { storiesMeta } from "$lib/data";

    interface Props {
        selectedIndex?: number;
        onselect: ( id: string ) => void;
        onnavigate: ( index: number ) => void;
    }

    let { selectedIndex = 0, onselect, onnavigate }: Props = $props();

    const genreColors: Record<string, string> = {
        "Fantasy": "text-emerald-400",
        "Sci-Fi": "text-blue-400",
        "Thriller": "text-red-400",
        "Horror": "text-purple-400",
        "Detective": "text-yellow-400"
    };

    function genreColor( genre: string ): string
    {
        return genreColors[ genre ] ?? "text-terminal-dim";
    }
</script>

<div class="flex-1 overflow-y-auto px-4 py-2 font-mono">
    <div class="mb-6 text-center select-none">
        <pre class="text-terminal-green text-xs leading-tight opacity-80">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
        <pre class="text-terminal-green text-xs leading-tight opacity-80">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

        <p class="text-terminal-dim text-xs mt-2 tracking-widest">— SYSTÈME D'HISTOIRES INTERACTIVES v1.0 —</p>
    </div>

    <div class="text-terminal-dim text-xs mb-4 text-center">
        ↑ ↓ Naviguer &nbsp;|&nbsp; ENTRÉE Sélectionner &nbsp;|&nbsp; Numéro Accès direct
    </div>

    <div class="border border-terminal-dim rounded px-2 py-1 mb-4">
        {#each storiesMeta as story, i ( story.id )}
            <button
                class="w-full text-left px-3 py-3 rounded transition-all duration-100 block {i === selectedIndex
                    ? "bg-terminal-green/15 border-l-2 border-terminal-green"
                    : "border-l-2 border-transparent hover:bg-white/5"
                }"
                onclick={() => onselect( story.id )}
                onmouseenter={() => onnavigate( i )}
            >
                <div class="flex items-baseline gap-3">
                    <span class="text-terminal-dim text-xs w-4 shrink-0">{i + 1}.</span>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2 flex-wrap">
                            <span class="text-terminal-white font-bold text-sm">{story.title}</span>
                            <span class="text-xs {genreColor( story.genre )} shrink-0">[{story.genre}]</span>
                        </div>

                        <div class="text-terminal-dim text-xs mt-0.5">{story.universe}</div>

                        {#if i === selectedIndex}
                            <div class="text-terminal-green text-xs mt-1 opacity-80 leading-relaxed">
                                {story.description}
                            </div>

                            <div class="flex gap-1 mt-1 flex-wrap">
                                {#each story.tags as tag ( tag )}
                                    <span class="text-terminal-dim text-xs opacity-60">#{tag}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            </button>

            {#if i < storiesMeta.length - 1}
                <div class="border-t border-terminal-dim/20 mx-3"></div>
            {/if}
        {/each}
    </div>

    <div class="text-terminal-dim text-xs text-center opacity-50 pb-4">
        {storiesMeta.length} histoire{storiesMeta.length > 1 ? "s" : ""} disponible{storiesMeta.length > 1 ? "s" : ""}
    </div>
</div>
