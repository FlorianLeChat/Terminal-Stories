<script lang="ts">
    interface Props {
        /** Whether the dialog is shown; the parent owns this state. */
        open: boolean;
        /** Unique id used to label the dialog by its heading. */
        id: string;
        /** Short question naming the destructive action. */
        title: string;
        /** What will be lost if the user confirms. */
        description: string;
        /** Label of the destructive button; names the action, not "OK". */
        confirmLabel: string;
        /** Label of the safe button that keeps things as they are. */
        cancelLabel: string;
        /** Runs the destructive action. */
        onconfirm: () => void;
        /** Dismisses the dialog without acting (button, ESC or backdrop close). */
        oncancel: () => void;
    }

    let { open, id, title, description, confirmLabel, cancelLabel, onconfirm, oncancel }: Props = $props();

    /**
     * Native dialog mirroring `open`: showModal traps focus and closes on ESC.
     *
     * @author Claude
     */
    let dialog: HTMLDialogElement;

    /**
     * Safe button, focused on open so a reflexive ENTER never confirms the
     * destructive action.
     *
     * @author Claude
     */
    let cancelButton: HTMLButtonElement;

    $effect( () =>
    {
        if ( !dialog ) return;

        if ( open && !dialog.open )
        {
            dialog.showModal();
            cancelButton?.focus();
        }
        else if ( !open && dialog.open )
        {
            dialog.close();
        }
    } );

    /**
     * Reports a native close (ESC) back to the parent so its state stays in
     * sync; closes triggered by the parent itself are ignored.
     *
     * @author Claude
     */
    const handleClose = () =>
    {
        if ( open ) oncancel();
    };
</script>

<!--
    Shared confirmation step for every destructive action (new game over a
    save, leaving the editor with unsaved changes, deleting a story, resetting
    achievements), so they all look and behave the same.
-->
<dialog
    bind:this={dialog}
    aria-labelledby="{id}-title"
    aria-describedby="{id}-desc"
    class="bg-transparent backdrop:bg-black/70 m-auto max-w-[90vw] text-terminal-green"
    onclose={handleClose}
>
    <article class="w-80 max-w-full border border-terminal-dim/60 rounded bg-terminal-bg p-5 flex flex-col gap-4 shadow-(--shadow-dialog)">
        <h2 id="{id}-title" class="text-terminal-white font-bold tracking-widest text-sm">
            {title}
        </h2>

        <p id="{id}-desc" class="text-terminal-amber text-sm leading-relaxed">
            {description}
        </p>

        <div class="flex flex-wrap justify-end gap-2">
            <button
                bind:this={cancelButton}
                type="button"
                class="min-h-11 text-sm px-3 py-1.5 border border-terminal-dim rounded text-terminal-white hover:border-terminal-green motion-safe:transition-colors"
                onclick={oncancel}
            >
                {cancelLabel}
            </button>

            <button
                type="button"
                class="min-h-11 text-sm px-3 py-1.5 border border-terminal-amber/60 rounded text-terminal-amber hover:text-terminal-white hover:border-terminal-amber motion-safe:transition-colors"
                onclick={onconfirm}
            >
                {confirmLabel}
            </button>
        </div>
    </article>
</dialog>
