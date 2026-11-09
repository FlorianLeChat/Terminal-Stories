<script lang="ts">
    import * as m from "#lib/locales/messages.js";
    import type { TerminalView } from "#lib/stores/terminal.ts";

    interface Props {
        /** Whether the dialog is shown; the parent owns this state. */
        open: boolean;
        /** The view whose shortcuts are listed. */
        view: TerminalView;
        /** Closes the dialog (button, ESC or backdrop). */
        onclose: () => void;
    }

    let { open, view, onclose }: Props = $props();

    /**
     * Native dialog mirroring `open`: showModal traps focus and closes on ESC,
     * and closing hands focus back to whatever had it before.
     *
     * @author Claude
     */
    let dialog: HTMLDialogElement;
    let filterInput: HTMLInputElement;

    /** Text typed in the help's own filter. */
    let filter = $state( "" );

    /** Shortcuts of each view, as "[KEY] Description" legend lines. */
    const VIEW_SHORTCUTS: Record<TerminalView, ( () => string )[]> = {
        "boot": [],
        "menu": [
            m.controls_navigate_up,
            m.controls_navigate_down,
            m.controls_menu_select,
            m.help_menu_number,
            m.controls_menu_search,
            m.help_menu_genre,
            m.help_menu_language,
            m.help_menu_reset,
            m.controls_menu_wiki,
            m.controls_menu_custom,
            m.controls_menu_ai,
            m.controls_menu_achievements
        ],
        "story-info": [
            m.help_info_enter,
            m.help_info_new,
            m.help_info_fork,
            m.help_share,
            m.controls_story_menu
        ],
        "story": [
            m.controls_story_choose,
            m.help_story_skip,
            m.help_story_restart,
            m.help_share,
            m.controls_story_menu
        ],
        "wiki": [
            m.controls_menu_search,
            m.controls_wiki_category,
            m.controls_navigate_up,
            m.controls_navigate_down,
            m.controls_wiki_consult,
            m.help_wiki_back
        ],
        "achievements": [ m.controls_story_menu ],
        "ai-setup": [ m.controls_story_menu ],
        "custom-stories": [
            m.controls_navigate_up,
            m.controls_navigate_down,
            m.controls_custom_open,
            m.help_custom_new,
            m.controls_story_menu
        ],
        "editor": [
            m.help_editor_save,
            m.help_editor_undo,
            m.help_editor_escape
        ]
    };

    /** Shortcuts that work on every view. */
    const GLOBAL_SHORTCUTS: ( () => string )[] = [ m.help_global_help, m.help_global_mute ];

    /** Task-oriented steps for a first read. */
    const HOW_TO_PLAY: ( () => string )[] = [ m.help_howto_1, m.help_howto_2, m.help_howto_3, m.help_howto_4 ];

    /** How a story is put together, for the views where one is written. */
    const WRITING_GUIDE: ( () => string )[] = [ m.help_writing_1, m.help_writing_2, m.help_writing_3 ];

    /** One section of the help: its id, its heading and its lines. */
    interface HelpSection {
        id: string;
        title: string;
        items: string[];
    }

    /**
     * The sections shown for the current view: the writing guide in the editor
     * and the custom story list, the playing guide everywhere else, then this
     * view's keys and the global ones.
     *
     * @author Claude
     */
    let sections = $derived.by( (): HelpSection[] =>
    {
        const isWriting = view === "editor" || view === "custom-stories";
        const guide: HelpSection = isWriting
            ? { id: "writing", title: m.help_section_writing(), items: WRITING_GUIDE.map( ( line ) => line() ) }
            : { id: "howto", title: m.help_section_howto(), items: HOW_TO_PLAY.map( ( line ) => line() ) };

        return [
            guide,
            { id: "view", title: m.help_section_view(), items: VIEW_SHORTCUTS[ view ].map( ( line ) => line() ) },
            { id: "global", title: m.help_section_global(), items: GLOBAL_SHORTCUTS.map( ( line ) => line() ) }
        ];
    } );

    /**
     * The sections restricted to the lines matching the filter (case and
     * accents ignored); empty sections are dropped.
     *
     * @author Claude
     */
    let visibleSections = $derived.by( (): HelpSection[] =>
    {
        const query = normalize( filter.trim() );

        return sections
            .map( ( section ) => ( { ...section, items: section.items.filter( ( item ) => normalize( item ).includes( query ) ) } ) )
            .filter( ( section ) => section.items.length > 0 );
    } );

    /**
     * Lowercases a text and strips its accents, so the filter matches
     * "entree" with "ENTRÉE".
     *
     * @param text - The text to normalize.
     * @returns The comparable text.
     * @author Claude
     */
    const normalize = ( text: string ): string =>
    {
        return text.normalize( "NFD" ).replace( /\p{Diacritic}/gu, "" ).toLowerCase();
    };

    $effect( () =>
    {
        if ( !dialog ) return;

        if ( open && !dialog.open )
        {
            filter = "";
            dialog.showModal();
            filterInput?.focus();
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
        if ( open ) onclose();
    };

    /**
     * Makes ESC close the help from its filter field too: a search input
     * otherwise spends the first ESC clearing its own text.
     *
     * @param event - The keydown event from the filter field.
     * @author Claude
     */
    const handleFilterKeydown = ( event: KeyboardEvent ) =>
    {
        const isEscape = event.key === "Escape";

        if ( isEscape )
        {
            event.preventDefault();
            dialog.close();
        }
    };
</script>

<dialog
    bind:this={dialog}
    aria-labelledby="help-title"
    class="bg-transparent backdrop:bg-black/70 m-auto max-w-[90vw] text-terminal-green"
    onclose={handleClose}
>
    <article class="w-96 max-w-full max-h-[80vh] overflow-y-auto border border-terminal-dim/60 rounded bg-terminal-bg p-5 flex flex-col gap-4 shadow-(--shadow-dialog)">
        <h2 id="help-title" class="text-terminal-white font-bold tracking-widest text-sm">
            {m.help_title()}
        </h2>

        <div class="space-y-1">
            <label for="help-filter" class="block text-terminal-dim text-xs select-none">{m.help_filter_label()}</label>
            <input
                bind:this={filterInput}
                bind:value={filter}
                id="help-filter"
                type="search"
                class="w-full min-h-11 sm:min-h-9 bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green placeholder-terminal-dim caret-terminal-green"
                placeholder={m.help_filter_placeholder()}
                autocomplete="off"
                spellcheck={false}
                onkeydown={handleFilterKeydown}
            />
        </div>

        <output class="contents" aria-live="polite">
            {#each visibleSections as section ( section.id )}
                <section aria-labelledby="help-{section.id}-title" class="space-y-2">
                    <h3 id="help-{section.id}-title" class="text-terminal-amber text-xs tracking-widest">{section.title}</h3>

                    <ul class="space-y-1">
                        {#each section.items as item ( item )}
                            <li class="text-terminal-text text-sm">{item}</li>
                        {/each}
                    </ul>
                </section>
            {:else}
                <p class="text-terminal-dim text-sm">{m.help_filter_empty()}</p>
            {/each}
        </output>

        <div class="flex justify-end">
            <button
                type="button"
                class="min-h-11 text-sm px-3 py-1.5 border border-terminal-dim rounded text-terminal-white hover:border-terminal-green motion-safe:transition-colors"
                onclick={onclose}
            >
                {m.help_close()}
            </button>
        </div>
    </article>
</dialog>
