<script lang="ts">
    interface Props {
        subtitle: string;
    }

    let { subtitle }: Props = $props();
</script>

<div class="mb-4 text-center select-none">
    <pre class="text-terminal-green text-xs leading-tight opacity-80" aria-hidden="true">
 _____ _____ ____  __  __ ___ _   _    _    _
|_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |
  | | |  _| | |_) | |\/| || ||  \| | / _ \ | |
     | | | |___|  _ &lt;| |  | || || |\  |/ ___ \| |___
      |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
       </pre>
    <pre class="text-terminal-green text-xs leading-tight opacity-80" aria-hidden="true">
     ____ _____ ___  ____  ___ _____ ____
    / ___|_   _/ _ \|  _ \|_ _| ____/ ___|
    \___ \ | || | | | |_) || ||  _| \___ \
      ___) || || |_| |  _ &lt; | || |___ ___) |
    |____/ |_| \___/|_| \_\___|_____|____/
        </pre>

    <p class="text-terminal-dim text-xs mt-2 tracking-widest">{subtitle}</p>
</div>
