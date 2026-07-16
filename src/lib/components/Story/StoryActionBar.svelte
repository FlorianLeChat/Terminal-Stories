<script lang="ts">
    import * as m from "$lib/locales/messages";
    import { terminal } from "$lib/stores/terminal";
    import { isCustomStoryId } from "$lib";

    interface Props {
        /** Either the story-info preview screen or active playback. */
        view: "story-info" | "story";
        /** True when the current story has a save in localStorage. */
        hasSave: boolean;
        /** True while the typewriter animation is running. */
        isAnimating: boolean;
        /** True when playing a generated story and sitting on an ending scene. */
        atGeneratedEnding: boolean;
        /** True when playing a catalog story and sitting on an ending scene. */
        atStandardEnding: boolean;
        /** Skips the running typewriter animation (owned by the parent terminal). */
        onSkip: () => void;
        /** Forks the currently previewed catalog story into the editor. */
        onFork: () => void;
    }

    let { view, hasSave, isAnimating, atGeneratedEnding, atStandardEnding, onSkip, onFork }: Props = $props();

    let currentStory = $derived( $terminal.currentStory );

    // Generated stories are ephemeral and have no shareable URL, so the share
    // action is offered for catalog stories only.
    let isGenerated = $derived( $terminal.currentStoryIsGenerated );

    // Custom stories are private: no share action, and no fork action (they are
    // already editable copies).
    let isCustomStory = $derived( currentStory !== null && isCustomStoryId( currentStory.id ) );

    // Share and fork only make sense for bundled catalog stories.
    let isCatalogStory = $derived( currentStory !== null && !isGenerated && !isCustomStory );

    // At an ending the restart action replaces the skip action; both are
    // exclusive to the playback view.
    let atEnding = $derived( atGeneratedEnding || atStandardEnding );

    // The info screen always offers start/resume; during playback the bar only
    // appears when there is a contextual action to show (skip, restart, share),
    // so mid-story reading of an unshareable story never leaves an empty bar.
    let hasContent = $derived(
        view === "story-info" || isAnimating || atEnding || isCatalogStory
    );

    /**
     * Starts a fresh playthrough of the currently previewed story.
     *
     * @author Claude
     */
    const handleStart = () =>
    {
        if ( currentStory ) terminal.startStory( currentStory.id );
    };

    /**
     * Resumes the currently previewed story from its save.
     *
     * @author Claude
     */
    const handleResume = () =>
    {
        if ( currentStory ) terminal.resumeStory( currentStory.id );
    };

    /**
     * Restarts the current story from the start, using the right path for
     * generated versus catalog stories.
     *
     * @author Claude
     */
    const handleRestart = () =>
    {
        if ( atGeneratedEnding )
        {
            terminal.restartGeneratedStory();
        }
        else
        {
            terminal.restartStory();
        }
    };
</script>

<!--
    Secondary action bar sitting between the terminal output and the footer.
    Unlike the footer (which is a keyboard-shortcut legend on desktop), every
    button here is a primary, touch-friendly control so the story can be
    started, skipped, restarted, shared or forked without the footer.
-->
{#snippet action( label: string, onclick: () => void, primary: boolean = false )}
    {@const variant = primary
        ? "border-terminal-green bg-terminal-green/15 text-terminal-white hover:bg-terminal-green/25"
        : "border-terminal-dim/40 text-terminal-dim hover:text-terminal-white hover:border-terminal-dim active:bg-terminal-green/15 active:text-terminal-white"}

    <button
        type="button"
        class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-9 px-3 py-1.5 rounded border whitespace-nowrap motion-safe:transition-colors motion-safe:duration-100 {variant}"
        {onclick}
    >
        {label}
    </button>
{/snippet}

{#if hasContent}
<div class="shrink-0 border-t border-terminal-dim/30 px-4 py-2 bg-[rgba(0,20,0,0.35)] flex flex-wrap items-center gap-2">
    {#if view === "story-info"}
        {#if hasSave}
            {@render action( m.action_resume(), handleResume, true )}
            {@render action( m.action_new_game(), handleStart )}
        {:else}
            {@render action( m.action_start(), handleStart, true )}
        {/if}

        {#if isCatalogStory}
            {@render action( m.action_fork(), onFork )}
            {@render action( m.action_share(), () => terminal.openShare() )}
        {/if}
    {:else}
        {#if isAnimating}
            {@render action( m.action_skip(), onSkip, true )}
        {:else if atEnding}
            {@render action( m.action_restart(), handleRestart, true )}
        {/if}

        {#if isCatalogStory}
            {@render action( m.action_share(), () => terminal.openShare() )}
        {/if}
    {/if}
</div>
{/if}
