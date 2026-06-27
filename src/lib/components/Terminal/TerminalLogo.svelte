<script lang="ts">
    interface Props {
        subtitle: string;
    }

    let { subtitle }: Props = $props();
</script>

<div class="mt-2 text-center select-none">
    <!-- ASCII banner for wide screens; it overflows on narrow phones, so it is
         hidden there in favour of the plain title below. -->
    <pre class="hidden sm:block text-terminal-green text-xs leading-tight opacity-80" aria-hidden="true">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
    <pre class="hidden sm:block text-terminal-green text-xs leading-tight opacity-80" aria-hidden="true">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

    <!-- Plain, responsive title shown on small screens in place of the ASCII art. -->
    <p class="sm:hidden text-terminal-green font-bold text-2xl tracking-[0.3em] leading-tight">
        TERMINAL<br />STORIES
    </p>

    <p class="text-terminal-dim text-xs mt-2 tracking-widest">{subtitle}</p>
</div>
