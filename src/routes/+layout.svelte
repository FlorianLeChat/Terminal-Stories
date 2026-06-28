<script lang="ts">
    import "../app.css";
    import { env } from "$env/dynamic/public";
    import { asset } from "$app/paths";
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <link rel="icon" href={asset( "/assets/favicon.svg" )} type="image/svg+xml" sizes="any" />
    <link rel="manifest" href={asset( "/manifest.webmanifest" )} crossorigin="use-credentials" />

    {#if env.PUBLIC_ANALYTICS_ENABLED === "true"}
        <script
            src={env.PUBLIC_ANALYTICS_ENDPOINT}
            defer
            data-website-id={env.PUBLIC_ANALYTICS_PROJECT_ID}
            data-performance="true"
            data-do-not-track={env.PUBLIC_ANALYTICS_RESPECT_DNT}
            data-exclude-hash="true"
            data-exclude-search="true"
        ></script>
    {/if}
</svelte:head>

{@render children()}
