<script lang="ts">
    /**
     * Plain heading for secondary views: the ASCII logo is reserved for the main
     * menu, so every other screen opens straight on its own name.
     *
     * @author Claude
     */
    interface Props {
        /** Name of the view, e.g. "— ACHIEVEMENTS —". */
        title: string;
    }

    let { title }: Props = $props();
</script>

<h2 class="mt-2 text-center text-terminal-green text-lg font-bold tracking-widest select-none">
    {title}
</h2>
