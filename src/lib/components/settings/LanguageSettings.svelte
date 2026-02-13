<script lang="ts">
	import { appState } from '$lib/stores/AppState.svelte';

	// Language options that users can select from
	const LANGUAGE_OPTIONS: LanguageOption[] = [
		{ code: 'name', label: 'Local' },
		{ code: 'name:en', label: 'English' },
		{ code: 'name:fr', label: 'French' },
		{ code: 'name:de', label: 'German' },
		{ code: 'name:es', label: 'Spanish' },
		{ code: 'name:it', label: 'Italian' },
		{ code: 'name:pt', label: 'Portuguese' },
		{ code: 'name:zh', label: 'Chinese' },
		{ code: 'name:ja', label: 'Japanese' },
		{ code: 'name:ko', label: 'Korean' },
		{ code: 'name:ar', label: 'Arabic' },
		{ code: 'name:ru', label: 'Russian' }
	];

	// Ensure appState is initialized
	$effect(() => {
		appState.ensureInitialized();
	});

	// Get current language setting
	let currentLanguage = $derived(appState.language);

	// Handle language selection change
	function handleLanguageChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const selectedLanguage = target.value as LanguageCode;
		appState.updateLanguage(selectedLanguage);
	}
</script>

<div class="space-y-4">
	<div>
		<h4 class="mb-2 text-[20px] leading-none font-semibold tracking-[-0.01em]">Language</h4>
		<p class="text-muted-foreground mb-4 text-sm">
			Choose the language for displaying place names and feature labels on the map.
		</p>
	</div>

	<div class="space-y-3">
		<label for="language-select" class="block text-sm font-medium"> Display Language </label>
		<select
			id="language-select"
			class="bg-background border-muted focus:ring-foreground focus:ring-offset-background w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
			value={currentLanguage}
			onchange={handleLanguageChange}
		>
			{#each LANGUAGE_OPTIONS as option}
				<option value={option.code}>
					{option.label}
				</option>
			{/each}
		</select>

		<div class="text-muted-foreground mt-2 space-y-1 text-xs">
			<p><strong>Local:</strong> Uses the local name in the original language</p>
			<p>
				<strong>Other languages:</strong> Falls back to local name if translation is not available
			</p>
		</div>
	</div>
</div>
