<script lang="ts">
    import "../app.css";
    import { asset } from "$app/paths";
    import type { Snippet } from "svelte";
    import { PUBLIC_ANALYTICS_ENABLED, PUBLIC_ANALYTICS_ENDPOINT, PUBLIC_ANALYTICS_PROJECT_ID, PUBLIC_ANALYTICS_RESPECT_DNT } from "$app/env/public";

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <link rel="icon" href={asset( "assets/favicon.svg" )} type="image/svg+xml" sizes="any" />
    <link rel="manifest" href={asset( "manifest.webmanifest" )} crossorigin="use-credentials" />

    {#if PUBLIC_ANALYTICS_ENABLED}
        <script
            src={PUBLIC_ANALYTICS_ENDPOINT + "/script.js"}
            defer
            data-website-id={PUBLIC_ANALYTICS_PROJECT_ID}
            data-performance="true"
            data-do-not-track={PUBLIC_ANALYTICS_RESPECT_DNT}
            data-exclude-hash="true"
            data-exclude-search="true"
        ></script>

        <script
            src={PUBLIC_ANALYTICS_ENDPOINT + "/recorder.js"}
            defer
            data-website-id={PUBLIC_ANALYTICS_PROJECT_ID}
        ></script>
    {/if}
</svelte:head>

{@render children()}
