<script lang="ts">
	import { onMount } from 'svelte';
	import { terminal } from '$lib/stores/terminal';
	import { storiesMeta } from '$lib/data';
	import BootSequence from './BootSequence.svelte';
	import StoryMenu from './StoryMenu.svelte';
	import TerminalOutput from './TerminalOutput.svelte';

	// Derive reactive values from the store
	let view         = $derived($terminal.view);
	let lines        = $derived($terminal.lines);
	let selectedIndex = $derived($terminal.selectedStoryIndex);

	// ── Event handlers ────────────────────────────────────────────────

	function handleBoot() {
		terminal.startMenu();
	}

	function handleMenuSelect(id: string) {
		terminal.selectStory(id);
	}

	function handleMenuNavigate(index: number) {
		terminal.update(s => ({ ...s, selectedStoryIndex: index }));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (view === 'boot') return;
		if (view === 'menu')       { handleMenuKey(e); return; }
		if (view === 'story-info') { handleInfoKey(e); return; }
		if (view === 'story')      { handleStoryKey(e); return; }
	}

	function handleMenuKey(e: KeyboardEvent) {
		const count = storiesMeta.length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			terminal.update(s => ({ ...s, selectedStoryIndex: (s.selectedStoryIndex + 1) % count }));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			terminal.update(s => ({ ...s, selectedStoryIndex: (s.selectedStoryIndex - 1 + count) % count }));
		} else if (e.key === 'Enter') {
			terminal.selectStory(storiesMeta[$terminal.selectedStoryIndex].id);
		} else {
			const num = parseInt(e.key);
			if (!isNaN(num) && num >= 1 && num <= count) {
				terminal.selectStory(storiesMeta[num - 1].id);
			}
		}
	}

	function handleInfoKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && $terminal.currentStory) {
			terminal.startStory($terminal.currentStory.id);
		} else if (e.key === 'Escape') {
			terminal.startMenu();
		}
	}

	function handleStoryKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			terminal.goBack();
			return;
		}
		const num = parseInt(e.key);
		if (!isNaN(num) && num >= 1 && num <= 9) {
			terminal.makeChoice(num);
		}
		if (e.key === 'Enter') {
			const scene = $terminal.currentStory?.scenes[$terminal.gameState?.currentScene ?? ''];
			if (scene?.isEnding) terminal.goBack();
		}
	}

	onMount(() => { window.focus(); });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- CRT screen wrapper -->
<div class="crt-wrapper h-screen w-screen flex items-center justify-center bg-black overflow-hidden">
	<div class="monitor relative w-full max-w-4xl h-full max-h-screen flex flex-col">

		<!-- Scanlines overlay -->
		<div class="scanlines pointer-events-none"></div>

		<!-- Screen -->
		<div class="screen flex flex-col h-full overflow-hidden">

			<!-- Status bar -->
			<div class="status-bar flex items-center justify-between px-4 py-1 text-xs font-mono text-terminal-dim border-b border-terminal-dim border-opacity-30 select-none shrink-0">
				<span>TERMINAL-STORIES OS</span>
				<span class="flex items-center gap-4">
					{#if view === 'story' && $terminal.currentStory}
						<span class="text-terminal-amber">{$terminal.currentStory.title}</span>
						<span>|</span>
					{/if}
					<span class="text-terminal-green">
						{#if view === 'boot'}DÉMARRAGE{/if}
						{#if view === 'menu'}MENU PRINCIPAL{/if}
						{#if view === 'story-info'}INFO HISTOIRE{/if}
						{#if view === 'story'}LECTURE EN COURS{/if}
					</span>
				</span>
				<span class="cursor-blink">█</span>
			</div>

			<!-- Main area -->
			<div class="flex-1 flex flex-col overflow-hidden">
				{#if view === 'boot'}
					<BootSequence ondone={handleBoot} />

				{:else if view === 'menu'}
					<StoryMenu
						{selectedIndex}
						onselect={handleMenuSelect}
						onnavigate={handleMenuNavigate}
					/>

				{:else if view === 'story-info' || view === 'story'}
					<TerminalOutput {lines} />
				{/if}
			</div>

			<!-- Bottom bar -->
			<div class="shrink-0 border-t border-terminal-dim border-opacity-30 px-4 py-1 text-xs font-mono text-terminal-dim flex justify-between select-none">
				<span>
					{#if view === 'story'}
						Touches : [1-9] Choix &nbsp;|&nbsp; [ÉCHAP] Menu
					{:else if view === 'story-info'}
						[ENTRÉE] Commencer &nbsp;|&nbsp; [ÉCHAP] Retour
					{:else if view === 'menu'}
						[↑↓] Naviguer &nbsp;|&nbsp; [ENTRÉE] Sélectionner &nbsp;|&nbsp; [1-{storiesMeta.length}] Accès direct
					{/if}
				</span>
				<span class="opacity-40">v1.0.0</span>
			</div>

		</div>
	</div>
</div>

<style>
	.crt-wrapper { background: #000; }

	.monitor {
		background: #0a0f0a;
		box-shadow:
			0 0 60px rgba(0, 255, 70, 0.08),
			inset 0 0 60px rgba(0, 0, 0, 0.8);
	}

	.screen {
		position: relative;
		background: #050e05;
	}

	.scanlines {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			transparent 0px,
			transparent 2px,
			rgba(0, 0, 0, 0.08) 2px,
			rgba(0, 0, 0, 0.08) 4px
		);
		z-index: 10;
	}

	.status-bar { background: rgba(0, 20, 0, 0.8); }

	.cursor-blink {
		animation: blink 1s step-end infinite;
		color: #00ff46;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0; }
	}
</style>
