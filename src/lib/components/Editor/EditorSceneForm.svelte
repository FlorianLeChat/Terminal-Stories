<script lang="ts">
    import * as m from "$lib/locales/messages";
    import EditorChoiceForm from "./EditorChoiceForm.svelte";
    import type { MusicTheme, SceneSoundEffect, SceneTextEntry, StoryFile } from "$lib";
    import { MUSIC_THEMES, SCENE_SOUND_EFFECTS } from "$lib";

    interface Props {
        /** The story draft being edited (mutated in place). */
        draft: StoryFile;
        /** Id of the scene currently edited (updated on rename/delete). */
        selectedSceneId: string;
    }

    let { draft = $bindable(), selectedSceneId = $bindable() }: Props = $props();

    let scene = $derived( draft.scenes.find( ( s ) => s.id === selectedSceneId ) );

    /** Sentinel meaning "no explicit speaker" (i.e. the narrator). */
    const NO_SPEAKER = "";

    /**
     * Reads the text of a scene text entry, whatever its shape.
     *
     * @param entry - The entry to read.
     * @returns The entry's text.
     * @author Claude
     */
    const entryText = ( entry: SceneTextEntry ): string =>
    {
        return typeof entry === "string" ? entry : entry.text;
    };

    /**
     * Reads the explicit speaker of a scene text entry, or the "default"
     * sentinel for plain strings.
     *
     * @param entry - The entry to read.
     * @returns The entry's speaker override, or the empty sentinel.
     * @author Claude
     */
    const entrySpeaker = ( entry: SceneTextEntry ): string =>
    {
        return typeof entry === "string" ? NO_SPEAKER : entry.speaker;
    };

    /**
     * Resolves the display label for a speaker id, for use as a tooltip on
     * the (visually truncated) speaker select.
     *
     * @param speakerId - The speaker id, or the "no speaker" sentinel.
     * @returns The label shown to the user for that speaker.
     * @author Claude
     */
    const speakerLabel = ( speakerId: string ): string =>
    {
        if ( speakerId === NO_SPEAKER ) return m.editor_speaker_default();
        if ( speakerId === "narrator" ) return m.editor_speaker_narrator();

        const character = draft.characters.find( ( c ) => c.id === speakerId );

        return character?.name !== "" ? character?.name ?? speakerId : speakerId;
    };

    /**
     * Updates the text of the entry at the given position, preserving its
     * speaker override when present.
     *
     * @param index - The entry position.
     * @param event - The textarea input event.
     * @author Claude
     */
    const handleEntryTextInput = ( index: number, event: Event ) =>
    {
        if ( !scene ) return;

        const text = ( event.currentTarget as HTMLTextAreaElement ).value;
        const entry = scene.text[ index ];

        scene.text[ index ] = typeof entry === "string" ? text : { ...entry, text };
    };

    /**
     * Updates the speaker override of the entry at the given position,
     * collapsing back to a plain string when the default speaker is picked.
     *
     * @param index - The entry position.
     * @param event - The select change event.
     * @author Claude
     */
    const handleEntrySpeakerChange = ( index: number, event: Event ) =>
    {
        if ( !scene ) return;

        const speaker = ( event.currentTarget as HTMLSelectElement ).value;
        const text = entryText( scene.text[ index ] );

        scene.text[ index ] = speaker === NO_SPEAKER ? text : { speaker, text };
    };

    /**
     * Appends a blank text entry to the scene.
     *
     * @author Claude
     */
    const handleAddEntry = () =>
    {
        scene?.text.push( "" );
    };

    /**
     * Removes the text entry at the given position.
     *
     * @param index - The entry position.
     * @author Claude
     */
    const handleRemoveEntry = ( index: number ) =>
    {
        scene?.text.splice( index, 1 );
    };

    /**
     * Renames the scene (committed on change), propagating the new id to every
     * choice targeting it, to the start scene, and to the current selection.
     * Blank or already-used ids are refused and the input is reset.
     *
     * @param event - The input change event.
     * @author Claude
     */
    const handleRename = ( event: Event ) =>
    {
        if ( !scene ) return;

        const input = event.currentTarget as HTMLInputElement;
        const newId = input.value.trim();
        const oldId = scene.id;

        const isUsable = newId !== "" && newId !== oldId && !draft.scenes.some( ( s ) => s.id === newId );

        if ( !isUsable )
        {
            input.value = oldId;
            return;
        }

        scene.id = newId;

        for ( const other of draft.scenes )
        {
            for ( const choice of other.choices )
            {
                if ( choice.nextScene === oldId ) choice.nextScene = newId;
            }
        }

        if ( draft.startScene === oldId ) draft.startScene = newId;

        selectedSceneId = newId;
    };

    /**
     * Marks this scene as the story's start scene.
     *
     * @author Claude
     */
    const handleMakeStart = () =>
    {
        if ( scene ) draft.startScene = scene.id;
    };

    /**
     * Applies the scene's default speaker, removing the field entirely when
     * the narrator option is picked.
     *
     * @param event - The select change event.
     * @author Claude
     */
    const handleSpeakerChange = ( event: Event ) =>
    {
        if ( !scene ) return;

        const value = ( event.currentTarget as HTMLSelectElement ).value;

        if ( value === NO_SPEAKER )
        {
            delete scene.speaker;
        }
        else
        {
            scene.speaker = value;
        }
    };

    /**
     * Applies the scene's music override, removing the field entirely when
     * the default option is picked.
     *
     * @param event - The select change event.
     * @author Claude
     */
    const handleMusicChange = ( event: Event ) =>
    {
        if ( !scene ) return;

        const value = ( event.currentTarget as HTMLSelectElement ).value;

        if ( value === "" )
        {
            delete scene.music;
        }
        else
        {
            scene.music = value as MusicTheme;
        }
    };

    /**
     * Applies the scene's one-shot sound effect, removing the field entirely
     * when the "none" option is picked.
     *
     * @param event - The select change event.
     * @author Claude
     */
    const handleSoundChange = ( event: Event ) =>
    {
        if ( !scene ) return;

        const value = ( event.currentTarget as HTMLSelectElement ).value;

        if ( value === "" )
        {
            delete scene.sound;
        }
        else
        {
            scene.sound = value as SceneSoundEffect;
        }
    };

    /**
     * Toggles whether this scene is an ending, seeding a neutral ending type
     * when enabling and clearing both fields when disabling.
     *
     * @param event - The checkbox change event.
     * @author Claude
     */
    const handleEndingToggle = ( event: Event ) =>
    {
        if ( !scene ) return;

        const checked = ( event.currentTarget as HTMLInputElement ).checked;

        if ( checked )
        {
            scene.isEnding = true;
            scene.endingType = scene.endingType ?? "neutral";
        }
        else
        {
            delete scene.isEnding;
            delete scene.endingType;
        }
    };

    /**
     * Appends a new choice targeting the start scene (an always-valid target
     * the author then repoints).
     *
     * @author Claude
     */
    const handleAddChoice = () =>
    {
        if ( !scene ) return;

        scene.choices.push( {
            id: `choice-${ scene.choices.length + 1 }`,
            text: "",
            action: "",
            consequence: "",
            nextScene: draft.startScene
        } );
    };

    /**
     * Deletes this scene after confirmation, pruning every choice that pointed
     * to it and moving the selection (and start scene if needed) elsewhere.
     * The last remaining scene cannot be deleted.
     *
     * @author Claude
     */
    const handleDeleteScene = () =>
    {
        if ( !scene || draft.scenes.length <= 1 ) return;

        const confirmed = confirm( m.editor_scene_delete_confirm( { id: scene.id } ) );
        if ( !confirmed ) return;

        const deletedId = scene.id;

        draft.scenes = draft.scenes.filter( ( s ) => s.id !== deletedId );

        for ( const other of draft.scenes )
        {
            other.choices = other.choices.filter( ( choice ) => choice.nextScene !== deletedId );
        }

        if ( draft.startScene === deletedId ) draft.startScene = draft.scenes[ 0 ].id;

        selectedSceneId = draft.startScene;
    };
</script>

{#if scene}
    <section class="border border-terminal-dim/40 rounded px-4 py-3 space-y-3 flex-1 min-w-0" aria-label={m.editor_scene_form_aria()}>
        <div class="flex gap-2 items-end flex-wrap">
            <div class="space-y-1 flex-1 min-w-32">
                <label for="editor-scene-id" class="block text-terminal-dim text-xs select-none">{m.editor_scene_id_label()}</label>
                <input
                    id="editor-scene-id"
                    type="text"
                    value={scene.id}
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    autocomplete="off"
                    spellcheck={false}
                    onchange={handleRename}
                />
            </div>

            {#if draft.startScene === scene.id}
                <p class="text-terminal-cyan text-xs px-2 py-1 border border-terminal-cyan/40 rounded select-none">
                    {m.editor_scene_is_start()}
                </p>
            {:else}
                <button
                    type="button"
                    class="text-xs px-2 py-1 rounded border border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 motion-safe:transition-colors motion-safe:duration-100"
                    onclick={handleMakeStart}
                >
                    {m.editor_scene_make_start()}
                </button>
            {/if}

            <button
                type="button"
                class="text-xs px-2 py-1 rounded border border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10 disabled:opacity-50 disabled:cursor-not-allowed motion-safe:transition-colors motion-safe:duration-100"
                disabled={draft.scenes.length <= 1}
                onclick={handleDeleteScene}
            >
                {m.editor_scene_delete()}
            </button>
        </div>

        <div class="flex gap-3 flex-wrap">
            <div class="space-y-1 flex-1 min-w-32">
                <label for="editor-scene-speaker" class="block text-terminal-dim text-xs select-none">{m.editor_scene_speaker_label()}</label>
                <select
                    id="editor-scene-speaker"
                    value={scene.speaker ?? NO_SPEAKER}
                    class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                    onchange={handleSpeakerChange}
                >
                    <option value={NO_SPEAKER}>{m.editor_speaker_narrator()}</option>

                    {#each draft.characters as character ( character.id )}
                        <option value={character.id}>{character.name !== "" ? character.name : character.id}</option>
                    {/each}
                </select>
            </div>

            <div class="space-y-1 flex-1 min-w-32">
                <label for="editor-scene-music" class="block text-terminal-dim text-xs select-none">{m.editor_music_label()}</label>
                <select
                    id="editor-scene-music"
                    value={scene.music ?? ""}
                    class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                    onchange={handleMusicChange}
                >
                    <option value="">{m.editor_music_none()}</option>

                    {#each MUSIC_THEMES as theme ( theme )}
                        <option value={theme}>{theme}</option>
                    {/each}
                </select>
            </div>

            <div class="space-y-1 flex-1 min-w-32">
                <label for="editor-scene-sound" class="block text-terminal-dim text-xs select-none">{m.editor_scene_sound_label()}</label>
                <select
                    id="editor-scene-sound"
                    value={scene.sound ?? ""}
                    class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                    onchange={handleSoundChange}
                >
                    <option value="">{m.editor_sound_none()}</option>

                    {#each SCENE_SOUND_EFFECTS as effect ( effect )}
                        <option value={effect}>{effect}</option>
                    {/each}
                </select>
            </div>
        </div>

        <fieldset class="space-y-2">
            <legend class="text-terminal-dim text-xs select-none pb-1">{m.editor_scene_text_legend()}</legend>

            <ul class="space-y-2">
                {#each scene.text as entry, i ( i )}
                    <li class="flex gap-2 items-start">
                        <select
                            value={entrySpeaker( entry )}
                            class="w-36 shrink-0 truncate bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                            aria-label={m.editor_entry_speaker_aria()}
                            title={speakerLabel( entrySpeaker( entry ) )}
                            onchange={( e ) => handleEntrySpeakerChange( i, e )}
                        >
                            <option value={NO_SPEAKER}>{m.editor_speaker_default()}</option>
                            <option value="narrator">{m.editor_speaker_narrator()}</option>

                            {#each draft.characters as character ( character.id )}
                                <option value={character.id}>{character.name !== "" ? character.name : character.id}</option>
                            {/each}
                        </select>

                        <textarea
                            value={entryText( entry )}
                            rows="2"
                            class="flex-1 bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green resize-y"
                            aria-label={m.editor_entry_text_aria()}
                            oninput={( e ) => handleEntryTextInput( i, e )}
                        ></textarea>

                        <button
                            type="button"
                            class="text-terminal-amber text-xs px-1.5 py-1 rounded border border-terminal-amber/50 hover:bg-terminal-amber/10 motion-safe:transition-colors motion-safe:duration-100"
                            aria-label={m.editor_text_remove()}
                            onclick={() => handleRemoveEntry( i )}
                        >
                            ✕
                        </button>
                    </li>
                {/each}
            </ul>

            <button
                type="button"
                class="text-xs px-2 py-1 rounded border border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                onclick={handleAddEntry}
            >
                {m.editor_text_add()}
            </button>
        </fieldset>

        <div class="flex items-center gap-3 flex-wrap">
            <label class="flex items-center gap-2 text-terminal-dim text-xs select-none">
                <input
                    type="checkbox"
                    checked={scene.isEnding === true}
                    class="accent-terminal-green"
                    onchange={handleEndingToggle}
                />
                {m.editor_scene_ending_label()}
            </label>

            {#if scene.isEnding}
                <label class="flex items-center gap-2 text-terminal-dim text-xs select-none" for="editor-ending-type">
                    {m.editor_ending_type_label()}
                </label>
                <select
                    bind:value={scene.endingType}
                    id="editor-ending-type"
                    class="bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green"
                >
                    <option value="good">{m.editor_ending_good()}</option>
                    <option value="bad">{m.editor_ending_bad()}</option>
                    <option value="neutral">{m.editor_ending_neutral()}</option>
                </select>
            {/if}
        </div>

        <fieldset class="space-y-2">
            <legend class="text-terminal-dim text-xs select-none pb-1">{m.editor_choices_legend()}</legend>

            {#if scene.choices.length > 0}
                <ul class="space-y-2">
                    {#each scene.choices.keys() as i ( i )}
                        <EditorChoiceForm bind:draft sceneId={scene.id} index={i} />
                    {/each}
                </ul>
            {/if}

            <button
                type="button"
                class="text-xs px-2 py-1 rounded border border-terminal-dim/40 text-terminal-dim hover:border-terminal-dim hover:text-terminal-white motion-safe:transition-colors motion-safe:duration-100"
                onclick={handleAddChoice}
            >
                {m.editor_choice_add()}
            </button>
        </fieldset>
    </section>
{/if}
