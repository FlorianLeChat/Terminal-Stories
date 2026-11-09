<script lang="ts">
    interface Props {
        subtitle: string;
    }

    let { subtitle }: Props = $props();
</script>

<div class="mt-2 text-center select-none">
    <pre class="ascii-banner text-terminal-green text-xs leading-tight" aria-hidden="true">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
    <pre class="ascii-banner text-terminal-green text-xs leading-tight" aria-hidden="true">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

    <p class="compact-title text-terminal-green font-bold text-2xl tracking-[0.3em] leading-tight">
        TERMINAL<br class="title-break" /> STORIES
    </p>

    <p class="text-terminal-dim text-xs mt-2 tracking-widest">{subtitle}</p>
</div>

<style>
    .ascii-banner {
        display: none;
    }

    /* The banner overflows narrow phones and crowds the catalog under 1000px tall. */
    @media (min-width: 640px) and (min-height: 1001px) {
        .ascii-banner {
            display: block;
        }

        .compact-title {
            display: none;
        }
    }

    @media (min-width: 640px), (max-height: 700px) {
        .title-break {
            display: none;
        }
    }

    @media (max-height: 700px) {
        .compact-title {
            font-size: 1.25rem;
        }
    }
</style>
