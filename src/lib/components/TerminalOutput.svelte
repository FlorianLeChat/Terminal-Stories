<script lang="ts">
	import type { TerminalLine } from '$lib/stores/terminal';

	interface Props {
		lines?: TerminalLine[];
	}

	let { lines = [] }: Props = $props();

	let container: HTMLElement;

	$effect(() => {
		// Depend on lines length to scroll after each new line
		void lines.length;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	});

	function lineClass(type: TerminalLine['type']): string {
		const map: Record<TerminalLine['type'], string> = {
			system:      'text-terminal-dim',
			narrator:    'text-terminal-green',
			speaker:     'text-terminal-amber font-bold',
			choice:      'text-terminal-cyan cursor-pointer hover:text-terminal-white',
			action:      'text-terminal-dim italic',
			consequence: 'text-terminal-green italic',
			ending:      'text-terminal-amber',
			error:       'text-red-500',
			title:       'text-terminal-white text-xl font-bold tracking-widest',
			separator:   'text-terminal-dim'
		};
		return map[type] ?? 'text-terminal-green';
	}
</script>

<div
	bind:this={container}
	class="flex-1 overflow-y-auto px-4 py-2 font-mono text-sm leading-relaxed scrollbar-terminal"
>
	{#each lines as line (line.id)}
		{#if line.text === ''}
			<div class="h-3"></div>
		{:else}
			<div class="line {lineClass(line.type)} animate-fadein">
				{#if line.type === 'separator'}
					<span class="select-none opacity-40">{line.text}</span>
				{:else}
					{line.text}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.line {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.animate-fadein {
		animation: fadein 0.15s ease-in;
	}

	@keyframes fadein {
		from { opacity: 0; transform: translateY(2px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.scrollbar-terminal::-webkit-scrollbar {
		width: 4px;
	}
	.scrollbar-terminal::-webkit-scrollbar-track {
		background: transparent;
	}
	.scrollbar-terminal::-webkit-scrollbar-thumb {
		background: #1a4a1a;
		border-radius: 2px;
	}
</style>
