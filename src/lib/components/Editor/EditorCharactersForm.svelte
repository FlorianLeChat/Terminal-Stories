<script lang="ts">
    import * as m from "$lib/locales/messages";
    import type { CharacterRole, StoryFile } from "$lib";

    interface Props {
        /** The story draft being edited (mutated in place). */
        draft: StoryFile;
    }

    let { draft = $bindable() }: Props = $props();

    /** Roles offered by the picker, in display order. */
    const ROLES: CharacterRole[] = [ "protagonist", "antagonist", "ally", "npc", "narrator" ];

    /**
     * Resolves the localized label of a character role.
     *
     * @param role - The role code to label.
     * @returns The translated label.
     * @author Claude
     */
    const roleLabel = ( role: CharacterRole ): string =>
    {
        switch ( role )
        {
            case "protagonist": return m.editor_role_protagonist();
            case "antagonist": return m.editor_role_antagonist();
            case "ally": return m.editor_role_ally();
            case "narrator": return m.editor_role_narrator();
            default: return m.editor_role_npc();
        }
    };

    /**
     * Appends a new character with a unique id and the default role.
     *
     * @author Claude
     */
    const handleAddCharacter = () =>
    {
        // Walk the counter past any existing "character-N" id to stay unique.
        let counter = draft.characters.length + 1;
        let id = `character-${ counter }`;

        while ( draft.characters.some( ( character ) => character.id === id ) )
        {
            counter += 1;
            id = `character-${ counter }`;
        }

        draft.characters.push( { id, name: "", role: "npc" } );
    };

    /**
     * Removes the character at the given position.
     *
     * @param index - The position of the character to remove.
     * @author Claude
     */
    const handleRemoveCharacter = ( index: number ) =>
    {
        draft.characters.splice( index, 1 );
    };
</script>

<fieldset class="border border-terminal-dim/40 rounded px-4 py-3 space-y-3 mb-3">
    <legend class="text-terminal-dim text-xs px-1 select-none">{m.editor_characters_legend()}</legend>

    {#if draft.characters.length > 0}
        <ul class="space-y-2">
            {#each draft.characters as character, i ( character.id )}
                <li class="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div class="space-y-1 flex-1 min-w-0">
                        <label for={`editor-character-name-${ i }`} class="block text-terminal-dim text-xs select-none">
                            {m.editor_character_name_label()}
                        </label>
                        <input
                            bind:value={character.name}
                            id={`editor-character-name-${ i }`}
                            type="text"
                            class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                            autocomplete="off"
                        />
                    </div>

                    <!-- Role select and remove keep together below the name on mobile. -->
                    <div class="flex gap-2 items-end">
                        <div class="space-y-1 flex-1 min-w-0 sm:flex-none sm:w-36">
                            <label for={`editor-character-role-${ i }`} class="block text-terminal-dim text-xs select-none">
                                {m.editor_character_role_label()}
                            </label>
                            <select
                                bind:value={character.role}
                                id={`editor-character-role-${ i }`}
                                class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                            >
                                {#each ROLES as role ( role )}
                                    <option value={role}>{roleLabel( role )}</option>
                                {/each}
                            </select>
                        </div>

                        <button
                            type="button"
                            class="shrink-0 text-xs px-2 py-1 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100"
                            onclick={() => handleRemoveCharacter( i )}
                        >
                            {m.editor_character_remove()}
                        </button>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}

    <button
        type="button"
        class="text-xs px-2 py-1 rounded border border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
        onclick={handleAddCharacter}
    >
        {m.editor_character_add()}
    </button>
</fieldset>
