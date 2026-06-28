<script lang="ts">
    import "../app.css";
    import { asset } from "$app/paths";
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <link rel="icon" href={asset( "/assets/favicon.svg" )} type="image/svg+xml" sizes="any" />
    <link rel="manifest" href={asset( "/manifest.webmanifest" )} crossorigin="use-credentials" />
</svelte:head>

{@render children()}
