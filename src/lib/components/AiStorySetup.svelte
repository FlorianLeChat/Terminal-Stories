<script lang="ts">
    import { onMount } from "svelte";
    import * as m from "#lib/locales/messages.js";
    import { terminal } from "#lib/stores/terminal.ts";
    import ViewTitle from "./Terminal/ViewTitle.svelte";
    import type { AiGenerationParams, AiModelOption } from "#lib";
    import { loadAiSettings, saveAiKey, saveAiModel, listModels, aiErrorMessage, availableGenres, availableLanguages, genreLabel } from "#lib";

    /**
     * Settings stored by a previous visit. The key and model are remembered
     * across sessions; the generation parameters always start fresh.
     *
     * @author Claude
     */
    const stored = loadAiSettings();

    let apiKey = $state( stored.apiKey );
    let model = $state( stored.model );
    let premise = $state( "" );
    let genre = $state( "" );

    const localeLanguage = m.language_self_name();
    const isLocaleOffered = availableLanguages.includes( localeLanguage );
    let language = $state( isLocaleOffered ? localeLanguage : availableLanguages[ 0 ] );
    let sceneCount = $state( 10 );

    /**
     * True once the key passed the Models API check. The whole form stays locked
     * until then, and the model list only ever comes from that call.
     *
     * @author Claude
     */
    let keyValid = $state( false );
    let validating = $state( false );
    let keyError = $state<string | null>( null );
    let models = $state<AiModelOption[]>( [] );

    let status = $derived( $terminal.aiStatus );
    let isGenerating = $derived( status === "generating" );
    let fieldsLocked = $derived( !keyValid || isGenerating );
    let displayError = $derived( $terminal.aiError );

    let keyInputEl: HTMLInputElement | undefined = $state();

    /** Shape of an Anthropic API key, checked before any network call. */
    const KEY_FORMAT = /^sk-ant-[\w-]+$/;

    /**
     * Status line saying where the key stands: empty, typed but unchecked,
     * checking, valid or refused.
     *
     * @author Claude
     */
    let keyStatus = $derived.by( (): { text: string; tone: "dim" | "ok" | "error" } =>
    {
        if ( keyError ) return { text: keyError, tone: "error" };
        if ( validating ) return { text: m.ai_key_status_checking(), tone: "dim" };
        if ( keyValid ) return { text: m.ai_key_valid(), tone: "ok" };

        const isEmpty = apiKey.trim() === "";

        return { text: isEmpty ? m.ai_key_status_empty() : m.ai_key_status_unchecked(), tone: "dim" };
    } );

    /** Text color of each key status tone. */
    const KEY_STATUS_CLASS = { dim: "text-terminal-dim", ok: "text-terminal-green", error: "text-terminal-error" };

    /**
     * Validates the entered key, on explicit request only (the button, ENTER,
     * or a key stored by a previous visit). The key's format is checked first
     * so an obvious typo never reaches the network; then the models it can
     * access are listed. On success the form unlocks and the model picker is
     * populated, keeping the stored model when still offered, otherwise the
     * newest. On failure the reason is shown and the form stays locked.
     *
     * @author Claude
     */
    const validateKey = async () =>
    {
        const trimmedKey = apiKey.trim();
        if ( trimmedKey === "" || validating ) return;

        const hasKeyFormat = KEY_FORMAT.test( trimmedKey );

        if ( !hasKeyFormat )
        {
            keyError = m.ai_key_format_invalid();
            return;
        }

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
    <ViewTitle title={m.ai_subtitle()} />

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
                    class="flex-1 min-w-0 min-h-11 bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green placeholder-terminal-dim caret-terminal-green"
                    placeholder="sk-ant-..."
                    autocomplete="off"
                    spellcheck={false}
                    aria-describedby="ai-key-status ai-key-help"
                    aria-invalid={keyError ? "true" : undefined}
                    oninput={handleKeyInput}
                />

                <button
                    type="button"
                    class="min-h-11 px-3 py-1 rounded border border-terminal-cyan/50 text-terminal-cyan text-xs hover:bg-terminal-cyan/10 disabled:text-terminal-dim disabled:border-terminal-dim/50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    onclick={validateKey}
                    disabled={apiKey.trim() === "" || validating || keyValid}
                >
                    {m.ai_key_validate()}
                </button>
            </div>

            <p id="ai-key-status" class="text-xs {KEY_STATUS_CLASS[ keyStatus.tone ]}" aria-live="polite">{keyStatus.text}</p>

            <p id="ai-key-help" class="text-terminal-dim text-xs">
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
        </div>

        {#if !keyValid}
            <p class="text-terminal-dim text-xs">{m.ai_locked_hint()}</p>
        {/if}

        <fieldset class="space-y-3" disabled={fieldsLocked}>
            <legend class="sr-only">{m.ai_subtitle()}</legend>

            <div class="space-y-1">
                <label for="ai-model" class="block text-terminal-dim text-xs select-none">{m.ai_model_label()}</label>
                <select
                    bind:value={model}
                    id="ai-model"
                    class="w-full bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green disabled:text-terminal-dim"
                >
                    {#each models as option ( option.id )}
                        <option value={option.id}>{option.label}</option>
                    {:else}
                        <option value={model}>{m.ai_model_placeholder()}</option>
                    {/each}
                </select>
            </div>

            <div class="space-y-1">
                <label for="ai-premise" class="block text-terminal-dim text-xs select-none">{m.ai_premise_label()}</label>
                <textarea
                    bind:value={premise}
                    id="ai-premise"
                    rows="3"
                    class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green placeholder-terminal-dim caret-terminal-green resize-none"
                    placeholder={m.ai_premise_placeholder()}
                ></textarea>
            </div>

            <div class="flex gap-3 flex-wrap">
                <div class="space-y-1 flex-1 min-w-32">
                    <label for="ai-genre" class="block text-terminal-dim text-xs select-none">{m.ai_genre_label()}</label>
                    <select
                        bind:value={genre}
                        id="ai-genre"
                        class="w-full bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green disabled:text-terminal-dim"
                    >
                        <option value="">{m.ai_genre_any()}</option>

                        {#each availableGenres as option ( option )}
                            <option value={option}>{genreLabel( option )}</option>
                        {/each}
                    </select>
                </div>

                <div class="space-y-1 flex-1 min-w-32">
                    <label for="ai-language" class="block text-terminal-dim text-xs select-none">{m.ai_language_label()}</label>
                    <select
                        bind:value={language}
                        id="ai-language"
                        class="w-full bg-terminal-bg border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green disabled:text-terminal-dim"
                    >
                        {#each availableLanguages as option ( option )}
                            <option value={option}>{option}</option>
                        {/each}
                    </select>
                </div>

                <div class="space-y-1 w-24">
                    <label for="ai-length" class="block text-terminal-dim text-xs select-none">{m.ai_length_label()}</label>
                    <input
                        bind:value={sceneCount}
                        id="ai-length"
                        type="number"
                        min="4"
                        max="20"
                        class="w-full bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-green text-sm focus:border-terminal-green caret-terminal-green"
                    />
                </div>
            </div>
        </fieldset>

        {#if displayError}
            <p class="border border-terminal-error/60 text-terminal-error text-xs rounded px-3 py-2" role="alert">
                {m.ai_error_label()} : {displayError}
            </p>
        {/if}

        <div class="flex items-center gap-3">
            <button
                type="submit"
                class="min-h-11 px-4 py-1 rounded border border-terminal-green text-terminal-green text-sm hover:bg-terminal-green/15 disabled:text-terminal-dim disabled:border-terminal-dim/50 disabled:hover:bg-transparent disabled:cursor-not-allowed motion-safe:transition-colors motion-safe:duration-100"
                disabled={fieldsLocked}
            >
                {m.ai_generate()}
            </button>

            {#if isGenerating}
                <button
                    type="button"
                    class="min-h-11 px-4 py-1 rounded border border-terminal-dim/60 text-terminal-dim text-sm hover:text-terminal-white hover:border-terminal-white/60 motion-safe:transition-colors motion-safe:duration-100"
                    onclick={terminal.cancelGeneration}
                >
                    {m.ai_cancel()}
                </button>

                <output class="text-terminal-amber text-xs motion-safe:animate-pulse">{m.ai_generating()}</output>
            {/if}
        </div>

        <p class="text-terminal-dim text-xs text-center">{m.ai_ephemeral_note()}</p>
    </form>
</div>
