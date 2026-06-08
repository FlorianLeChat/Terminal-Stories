<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		ondone: () => void;
	}

	let { ondone }: Props = $props();

	const bootLines: { text: string; delay: number; blink?: boolean }[] = [
		{ text: 'TERMINAL-STORIES OS v1.0.0', delay: 0 },
		{ text: 'Copyright (c) 2024 — Tous droits réservés', delay: 120 },
		{ text: '', delay: 200 },
		{ text: 'Initialisation du système narratif...', delay: 350 },
		{ text: '[OK] Chargement du moteur d\'histoires', delay: 600 },
		{ text: '[OK] Lecture des données de scénario', delay: 800 },
		{ text: '[OK] Validation des arbres de choix', delay: 950 },
		{ text: '[OK] Chargement des personnages', delay: 1100 },
		{ text: '', delay: 1200 },
		{ text: '3 histoires chargées.', delay: 1350 },
		{ text: '', delay: 1450 },
		{ text: 'Appuyez sur ENTRÉE pour commencer.', delay: 1600, blink: true }
	];

	let visible = $state(bootLines.map(() => false));
	let done = $state(false);

	onMount(() => {
		bootLines.forEach((_line, i) => {
			setTimeout(() => {
				visible[i] = true;
				if (i === bootLines.length - 1) {
					done = true;
				}
			}, bootLines[i].delay);
		});
	});

	function handleKey(e: KeyboardEvent) {
		if (done && e.key === 'Enter') ondone();
	}

	function handleClick() {
		if (done) ondone();
	}
</script>

<svelte:window onkeydown={handleKey} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="flex-1 flex flex-col justify-center px-8 font-mono cursor-pointer select-none"
	onclick={handleClick}
>
	{#each bootLines as line, i}
		{#if visible[i]}
			<div
				class="leading-relaxed animate-fadein text-sm"
				class:text-terminal-green={!line.blink}
				class:text-terminal-amber={line.blink}
				class:blink-text={line.blink}
			>
				{#if line.text === ''}
					&nbsp;
				{:else}
					{line.text}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.animate-fadein {
		animation: fadein 0.2s ease-in;
	}
	@keyframes fadein {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	.blink-text {
		animation: fadein 0.2s ease-in, blink 1.2s step-end infinite;
	}
	@keyframes blink {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.2; }
	}
</style>
