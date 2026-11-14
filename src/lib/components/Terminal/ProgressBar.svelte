<script lang="ts">
    /**
     * Decorative progress bar drawn with CSS instead of block glyphs, which
     * fall back to other fonts and misalign. The value is always printed next
     * to it, so the bar is hidden from assistive technology.
     *
     * @author Claude
     */
    interface Props {
        /** Completion between 0 and 100. */
        percent: number;
        /** Width of the bar, in characters. */
        width?: number;
    }

    let { percent, width = 10 }: Props = $props();

    let clamped = $derived( Math.min( 100, Math.max( 0, percent ) ) );
</script>

<span class="track" style="width: {width}ch" aria-hidden="true">
    <span class="fill" style="width: {clamped}%"></span>
</span>

<style>
    .track {
        display: inline-block;
        height: 0.75em;
        border: 1px solid color-mix( in srgb, var( --color-terminal-dim ) 50%, transparent );
        background: color-mix( in srgb, var( --color-terminal-dim ) 15%, transparent );
    }

    .fill {
        display: block;
        height: 100%;
        background: var( --color-terminal-amber );
    }
</style>
