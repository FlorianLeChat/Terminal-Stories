<script lang="ts">
    import { genreLabel, resolvePhosphor, type PhosphorTheme } from "#lib";

    interface Props {
        /** The story's genre code (or free-text genre). */
        genre: string;
        /** The story's own phosphor, when it sets one. */
        phosphor?: PhosphorTheme;
    }

    let { genre, phosphor }: Props = $props();

    /**
     * Phosphor applied locally through `data-phosphor`, so the tag prints in its universe's colors.
     *
     * @author Claude
     */
    let theme = $derived( resolvePhosphor( { genre, phosphor } ) );
</script>

<span data-phosphor={theme} class="inline-flex items-center shrink-0 px-1.5 rounded border border-terminal-green/40 text-terminal-green text-xs">
    {genreLabel( genre )}
</span>
