<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { onMount } from "svelte";
    import { terminal } from "$lib/stores/terminal";
    import TerminalLogo from "./Terminal/TerminalLogo.svelte";
    import type { AiGenerationParams, AiModelOption } from "$lib";
    import { loadAiSettings, saveAiKey, saveAiModel, listModels, aiErrorMessage } from "$lib";

    // Seed the form from any previously stored settings (the key is remembered
    // across sessions; the generation parameters always start fresh).
    const stored = loadAiSettings();

    let apiKey = $state( stored.apiKey );
    let model = $state( stored.model );
    let premise = $state( "" );
    let genre = $state( "" );
    let language = $state( "English" );
    let sceneCount = $state( 10 );

    // The whole form stays locked until the key is validated against the Models
    // API. The model list is populated exclusively from that call — no fallback.
    let keyValid = $state( false );
    let validating = $state( false );
    let keyError = $state<string | null>( null );
    let models = $state<AiModelOption[]>( [] );

    let status = $derived( $terminal.aiStatus );
    let isGenerating = $derived( status === "generating" );
    let fieldsLocked = $derived( !keyValid || isGenerating );
    let displayError = $derived( $terminal.aiError );

    let keyInputEl: HTMLInputElement | undefined = $state();

    /**
     * Validates the entered key by listing the models it can access. On success
     * the form unlocks and the model picker is populated; on failure an error is
     * shown and the form stays locked.
     *
     * @author Claude
     */
    const validateKey = async () =>
    {
        const trimmedKey = apiKey.trim();
        if ( trimmedKey === "" || validating ) return;

        validating = true;
        keyError = null;

        try
        {
            const fetched = await listModels( { apiKey: trimmedKey, model } );
            if ( fetched.length === 0 )
            {
                keyError = m.ai_key_invalid();
                return;
            }

            models = fetched;

            // Keep the stored model when still offered, otherwise pick the newest.
            const hasStored = fetched.some( ( option ) => option.id === model );
            if ( !hasStored ) model = fetched[ 0 ].id;

            keyValid = true;
            saveAiKey( trimmedKey );
        }
        catch ( error )
        {
            keyError = aiErrorMessage( error );
            keyValid = false;
        }
        finally
        {
            validating = false;
        }
    };

    /**
     * Invalidates the current validation whenever the key is edited, so the form
     * cannot be used with a stale or changed key.
     *
     * @author Claude
     */
    const handleKeyInput = () =>
    {
        keyValid = false;
        keyError = null;
        models = [];
    };

    // On open, focus the key field when empty; otherwise validate the stored key.
    onMount( () =>
    {
        if ( stored.apiKey === "" ) keyInputEl?.focus();
        else validateKey();
    } );

    /**
     * Submits the form: validates the key first while the form is locked,
     * otherwise persists the model choice and starts generation.
     *
     * @param event - The form submit event.
     * @author Claude
     */
    const handleSubmit = ( event: Event ) =>
    {
        event.preventDefault();
        if ( isGenerating ) return;

        // Enter while the form is still locked acts as "validate the key".
        if ( !keyValid )
        {
            validateKey();
            return;
        }

        saveAiModel( model );

        const params: AiGenerationParams = { premise, genre, language, sceneCount };

        terminal.generateAndPlay( params );
    };
</script>

<div class="flex-1 overflow-y-auto px-4 py-2">
    <TerminalLogo subtitle={m.ai_subtitle()} />

    <p class="text-terminal-dim text-xs text-center my-4">{m.ai_intro()}</p>

    <form class="border border-terminal-dim/40 rounded px-4 py-3 space-y-4 mb-3" onsubmit={handleSubmit}>
        <div class="space-y-1">
            <label for="ai-key" class="block text-terminal-dim text-xs select-none">{m.ai_key_label()}</label>

            <div class="flex items-center gap-2">
                <input
                    bind:this={keyInputEl}
                    bind:value={apiKey}
                    id="ai-key"
                    type="password"
                    class="flex-1 bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green placeholder-terminal-dim/50 caret-terminal-green"
                    placeholder="sk-ant-..."
                    autocomplete="off"
                    spellcheck={false}
                    oninput={handleKeyInput}
                    onblur={validateKey}
                />

                <button
                    type="button"
                    class="px-2 py-1 rounded border border-terminal-cyan/50 text-terminal-cyan text-xs hover:bg-terminal-cyan/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    onclick={validateKey}
                    disabled={apiKey.trim() === "" || validating || keyValid}
                >
                    {validating ? "..." : m.ai_key_validate()}
                </button>
            </div>

            <p class="text-terminal-dim/70 text-[0.7rem]">
                {m.ai_key_help()}
                <br />
                <a
                    href="https://platform.claude.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline underline-offset-2 hover:text-terminal-cyan"
                >{m.ai_key_console_link()}</a>
                 ·
                <a
                    href="https://platform.claude.com/docs/en/api/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline underline-offset-2 hover:text-terminal-cyan"
                >{m.ai_key_docs_link()}</a>
            </p>

            {#if keyError}
                <p class="text-terminal-amber text-[0.7rem]" role="alert">{keyError}</p>
            {:else if keyValid}
                <p class="text-terminal-green text-[0.7rem]">{m.ai_key_valid()}</p>
            {/if}
        </div>

        {#if !keyValid}
            <p class="text-terminal-dim/60 text-[0.7rem]">{m.ai_locked_hint()}</p>
        {/if}

        <fieldset class="space-y-3" disabled={fieldsLocked}>
            <legend class="sr-only">{m.ai_subtitle()}</legend>

            <div class="space-y-1">
                <label for="ai-model" class="block text-terminal-dim text-xs select-none">{m.ai_model_label()}</label>
                <select
                    bind:value={model}
                    id="ai-model"
                    class="w-full bg-terminal-bg border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green disabled:opacity-60"
                >
                    {#each models as option ( option.id )}
                        <option value={option.id}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="space-y-1">
                <label for="ai-premise" class="block text-terminal-dim text-xs select-none">{m.ai_premise_label()}</label>
                <textarea
                    bind:value={premise}
                    id="ai-premise"
                    rows="3"
                    class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green placeholder-terminal-dim/50 caret-terminal-green resize-none"
                    placeholder={m.ai_premise_placeholder()}
                ></textarea>
            </div>

            <div class="flex gap-3 flex-wrap">
                <div class="space-y-1 flex-1 min-w-32">
                    <label for="ai-genre" class="block text-terminal-dim text-xs select-none">{m.ai_genre_label()}</label>
                    <input
                        bind:value={genre}
                        id="ai-genre"
                        type="text"
                        class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                        autocomplete="off"
                    />
                </div>

                <div class="space-y-1 flex-1 min-w-32">
                    <label for="ai-language" class="block text-terminal-dim text-xs select-none">{m.ai_language_label()}</label>
                    <input
                        bind:value={language}
                        id="ai-language"
                        type="text"
                        class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                        autocomplete="off"
                    />
                </div>

                <div class="space-y-1 w-24">
                    <label for="ai-length" class="block text-terminal-dim text-xs select-none">{m.ai_length_label()}</label>
                    <input
                        bind:value={sceneCount}
                        id="ai-length"
                        type="number"
                        min="4"
                        max="20"
                        class="w-full bg-transparent border border-terminal-dim/40 rounded px-2 py-1 text-terminal-green text-xs outline-none focus:border-terminal-green caret-terminal-green"
                    />
                </div>
            </div>
        </fieldset>

        {#if displayError}
            <p class="border border-terminal-amber/60 text-terminal-amber text-xs rounded px-3 py-2" role="alert">
                {m.ai_error_label()} : {displayError}
            </p>
        {/if}

        <div class="flex items-center gap-3">
            <button
                type="submit"
                class="px-3 py-1 rounded border border-terminal-green text-terminal-green text-xs hover:bg-terminal-green/15 disabled:opacity-60 disabled:cursor-not-allowed motion-safe:transition-colors motion-safe:duration-100"
                disabled={fieldsLocked}
            >
                {m.ai_generate()}
            </button>

            {#if isGenerating}
                <output class="text-terminal-amber text-xs animate-pulse">{m.ai_generating()}</output>
            {/if}
        </div>

        <p class="text-terminal-dim/60 text-[0.7rem] text-center">{m.ai_ephemeral_note()}</p>
    </form>
</div>
