<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { page } from "$app/state";
    import { resolve } from "$app/paths";
    import { terminal } from "$lib/stores/terminal";
    import { deepLinkSearch } from "$lib";

    let dialog: HTMLDialogElement;

    /** Data-URL of the generated QR code image, empty until the first render. */
    let qrDataUrl = $state( "" );
    /** Generation lifecycle of the QR code. */
    let status = $state<"loading" | "ready" | "error">( "loading" );
    /** True for a short moment after the link is copied, to confirm the action. */
    let copied = $state( false );
    /** True when the browser exposes the native Web Share API (navigator.share). */
    const nativeShareAvailable = typeof navigator !== "undefined" && "share" in navigator;

    // The absolute, shareable URL of the story currently being read. Built from
    // the page origin so a phone scanning the code reaches the same deployment.
    let shareUrl = $derived.by( (): string =>
    {
        const story = $terminal.currentStory;
        if ( !story ) return "";

        const search = deepLinkSearch( { type: "story", id: story.id } );

        return page.url.origin + resolve( `/${ search }` );
    } );

    // Keep the native <dialog> in sync with the store: open it modally when the
    // store requests sharing, close it otherwise. showModal traps focus and
    // enables native ESC-to-close.
    $effect( () =>
    {
        if ( !dialog ) return;

        if ( $terminal.shareOpen && !dialog.open )
        {
            dialog.showModal();
        }
        else if ( !$terminal.shareOpen && dialog.open )
        {
            dialog.close();
        }
    } );

    // Regenerate the QR code whenever the overlay opens or the target URL changes.
    $effect( () =>
    {
        const isOpen = $terminal.shareOpen;
        const url = shareUrl;

        if ( !isOpen || url === "" ) return;

        // Guards against a stale async result overwriting a newer one.
        let cancelled = false;
        status = "loading";

        // Loaded lazily so the QR library (which pulls a Node build server-side)
        // never enters the SSR/prerender bundle — it is only needed in the browser.
        import( "qrcode" )
            .then( ( { default: QRCode } ) => QRCode.toDataURL( url, {
                margin: 2,
                width: 512,
                color: { dark: "#000000", light: "#ffffff" }
            } ) )
            .then( ( result ) =>
            {
                if ( cancelled ) return;

                qrDataUrl = result;
                status = "ready";
            } )
            .catch( () =>
            {
                if ( !cancelled ) status = "error";
            } );

        return () =>
        {
            cancelled = true;
        };
    } );

    /**
     * Copies the shareable URL to the clipboard and briefly flags success.
     *
     * @author Claude
     */
    const copyLink = async () =>
    {
        try
        {
            await navigator.clipboard.writeText( shareUrl );
            copied = true;

            // Revert the confirmation label after a short delay.
            const resetCopiedFlag = () =>
            {
                copied = false;
            };

            setTimeout( resetCopiedFlag, 2000 );
        }
        catch
        {
            // Clipboard access can be denied; the URL stays visible for manual copy.
        }
    };

    /**
     * Opens the OS-level share sheet via the Web Share API, letting the user pick
     * a target app (messaging, mail, social...) for the story link.
     *
     * @author Claude
     */
    const shareNatively = async () =>
    {
        try
        {
            await navigator.share( { title: $terminal.currentStory?.title, url: shareUrl } );
        }
        catch
        {
            // The user cancelled the share sheet, or the platform rejected it; nothing to recover.
        }
    };

    /**
     * Closes the overlay when the backdrop (the dialog element itself) is clicked,
     * leaving clicks on the inner content untouched.
     *
     * @param event - The click event on the dialog.
     * @author Claude
     */
    const handleBackdropClick = ( event: MouseEvent ) =>
    {
        const clickedBackdrop = event.target === dialog;
        if ( clickedBackdrop ) terminal.closeShare();
    };
</script>

<!--
    Share overlay — a native <dialog> shown modally over the terminal. It offers
    a scannable QR code plus the raw link, and warns that progress is local to
    the device. Closing is possible via ESC (native), the backdrop, or the
    close button; each path funnels through the store's closeShare.
-->
<dialog
    bind:this={dialog}
    onclose={() => terminal.closeShare()}
    onclick={handleBackdropClick}
    aria-labelledby="share-title"
    class="bg-transparent backdrop:bg-black/70 m-auto max-w-[90vw] text-terminal-green"
>
    <article class="w-80 max-w-full border border-terminal-dim/60 rounded bg-terminal-bg p-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(0,255,70,0.12)]">
        <header class="flex items-center justify-between gap-3">
            <h2 id="share-title" class="text-terminal-white font-bold tracking-widest text-sm">
                {m.share_title()}
            </h2>

            <button
                type="button"
                class="text-terminal-dim hover:text-terminal-white text-lg leading-none px-1 motion-safe:transition-colors"
                aria-label={m.share_close()}
                onclick={() => terminal.closeShare()}
            >
                ✕
            </button>
        </header>

        <p class="text-terminal-dim text-xs leading-relaxed">
            {m.share_scan_hint()}
        </p>

        <!-- White card guarantees the high contrast QR scanners rely on. -->
        <figure class="self-center bg-white rounded p-3 w-52 h-52 flex items-center justify-center">
            {#if status === "ready"}
                <img src={qrDataUrl} alt={m.share_qr_aria()} class="w-full h-full" />
            {:else if status === "error"}
                <p class="text-red-600 text-xs text-center px-2">{m.share_error()}</p>
            {:else}
                <p class="text-terminal-bg/70 text-xs text-center px-2">{m.share_generating()}</p>
            {/if}
        </figure>

        <div class="flex flex-col gap-1">
            <span class="text-terminal-dim text-[0.65rem] tracking-widest">{m.share_link_label()}</span>

            <div class="flex items-stretch gap-2">
                <output class="flex-1 min-w-0 truncate text-terminal-cyan text-xs border border-terminal-dim/40 rounded px-2 py-1.5 bg-black/30">
                    {shareUrl}
                </output>

                <button
                    type="button"
                    class="shrink-0 text-xs px-2 py-1.5 border border-terminal-dim/40 rounded text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 motion-safe:transition-colors"
                    onclick={copyLink}
                >
                    {copied ? m.share_copied() : m.share_copy()}
                </button>
            </div>

            {#if nativeShareAvailable}
                <button
                    type="button"
                    class="text-xs px-2 py-1.5 border border-terminal-dim/40 rounded text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 motion-safe:transition-colors"
                    onclick={shareNatively}
                >
                    {m.share_native()}
                </button>
            {/if}
        </div>

        <p class="text-terminal-amber/90 text-xs leading-relaxed border-t border-terminal-dim/30 pt-3">
            {m.share_progress_note()}
        </p>
    </article>
</dialog>
