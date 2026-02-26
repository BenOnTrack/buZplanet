<script lang="ts">
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CheckSquare from 'phosphor-svelte/lib/CheckSquare';
	import Square from 'phosphor-svelte/lib/Square';
	import MinusSquare from 'phosphor-svelte/lib/MinusSquare';
	import FileHierarchyNode from './FileHierarchyNode.svelte';

	interface Props {
		node: any; // Can be continent, country, region, or type node
		expandedNodes: Set<string>;
		selectedFiles: Set<string>;
		downloadingFiles: Set<string>;
		level: number;
		onToggleExpansion: (path: string[]) => void;
		onToggleSelection: (path: string[], selectAll: boolean) => void;
		onDownloadFile?: (file: FileComparisonResult) => void;
		onFileSelectionChange?: () => void;
		downloadProgress?: number;
		currentDownloadFile?: string;
	}

	let {
		node,
		expandedNodes,
		selectedFiles,
		downloadingFiles,
		level,
		onToggleExpansion,
		onToggleSelection,
		onDownloadFile,
		onFileSelectionChange,
		downloadProgress = 0,
		currentDownloadFile = ''
	}: Props = $props();

	const pathKey = $derived(node.path.join('/'));
	const isExpanded = $derived(expandedNodes.has(pathKey));
	const hasChildren = $derived(
		Object.keys(node.children || {}).length > 0 || (node.files && node.files.length > 0)
	);

	// Determine checkbox state
	const checkboxState = $derived.by(() => {
		if (node.fullySelected) return 'checked';
		if (node.partiallySelected) return 'indeterminate';
		return 'unchecked';
	});

	// Handle checkbox click
	const handleCheckboxClick = () => {
		const shouldSelect = checkboxState !== 'checked';
		onToggleSelection(node.path, shouldSelect);
	};

	// Handle expansion toggle
	const handleExpansionToggle = () => {
		if (hasChildren) {
			onToggleExpansion(node.path);
		}
	};

	// Handle individual file selection
	const handleFileSelection = (filename: string, isInOPFS: boolean) => {
		if (selectedFiles.has(filename)) {
			selectedFiles.delete(filename);
		} else if (!isInOPFS) {
			selectedFiles.add(filename);
		}
		// Trigger parent update
		onFileSelectionChange?.();
	};

	// Format node display name and stats
	const displayText = $derived.by(() => {
		const name = node.name.charAt(0).toUpperCase() + node.name.slice(1).replace(/_/g, ' ');
		if (node.totalFiles) {
			const missing = node.missingFiles;
			const downloaded = node.totalFiles - missing;
			return `${name} (${downloaded}/${node.totalFiles})`;
		}
		return name;
	});

	// Indentation based on level
	const indentStyle = $derived(`padding-left: ${level * 1}rem;`);
</script>

<div class="space-y-1">
	<!-- Current Node -->
	<div class="flex items-center gap-2 py-1" style={indentStyle}>
		<!-- Expansion Toggle -->
		{#if hasChildren}
			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100"
				onclick={handleExpansionToggle}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleExpansionToggle();
					}
				}}
				aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
			>
				{#if isExpanded}
					<CaretDown class="h-3 w-3 text-gray-600" />
				{:else}
					<CaretRight class="h-3 w-3 text-gray-600" />
				{/if}
			</button>
		{:else}
			<div class="w-5"></div>
		{/if}

		<!-- Checkbox -->
		<button
			type="button"
			class="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100"
			onclick={handleCheckboxClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleCheckboxClick();
				}
			}}
			aria-label={`Select ${node.name}`}
		>
			{#if checkboxState === 'checked'}
				<CheckSquare class="h-4 w-4 text-blue-600" />
			{:else if checkboxState === 'indeterminate'}
				<MinusSquare class="h-4 w-4 text-blue-600" />
			{:else}
				<Square class="h-4 w-4 text-gray-400" />
			{/if}
		</button>

		<!-- Node Label -->
		<div class="flex-1">
			<span
				class={`text-sm font-medium ${
					level === 0
						? 'text-gray-900'
						: level === 1
							? 'text-gray-800'
							: level === 2
								? 'text-gray-700'
								: 'text-gray-600'
				}`}
			>
				{displayText}
			</span>
			{#if node.allFilesDownloaded && node.totalFiles > 0}
				<span
					class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
				>
					✓ Complete
				</span>
			{/if}
		</div>
	</div>

	<!-- Children (when expanded) -->
	{#if isExpanded && hasChildren}
		{#if node.children}
			<!-- Render child nodes -->
			{#each Object.values(node.children) as childNode}
				<FileHierarchyNode
					node={childNode}
					{expandedNodes}
					{selectedFiles}
					{downloadingFiles}
					level={level + 1}
					{onToggleExpansion}
					{onToggleSelection}
					{onDownloadFile}
					{onFileSelectionChange}
					{downloadProgress}
					{currentDownloadFile}
				/>
			{/each}
		{/if}

		{#if node.files}
			<!-- Render individual files for type nodes -->
			{#each node.files as file}
				<div class="flex items-center gap-2 py-1" style={`padding-left: ${(level + 1) * 1}rem;`}>
					<div class="w-5"></div>

					<!-- File checkbox -->
					<button
						type="button"
						class="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100"
						onclick={() => handleFileSelection(file.filename, file.status)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								e.currentTarget.click();
							}
						}}
						disabled={file.status === 'up-to-date'}
						aria-label={`Select ${file.filename}`}
					>
						{#if file.status === 'up-to-date'}
							<CheckSquare class="h-4 w-4 text-green-600" />
						{:else if selectedFiles.has(file.filename)}
							<CheckSquare class="h-4 w-4 text-blue-600" />
						{:else}
							<Square class="h-4 w-4 text-gray-400" />
						{/if}
					</button>

					<!-- File info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate text-sm text-gray-900">{file.filename}</span>
							{#if file.status === 'up-to-date'}
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
								>
									✓ Up to date
								</span>
							{:else if file.status === 'needs-update'}
								<span
									class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
								>
									↻ Needs update
								</span>
							{:else}
								<span
									class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
								>
									⚬ Not downloaded
								</span>
							{/if}
						</div>
						<div class="text-xs text-gray-500">
							{(file.r2File.size / 1024 / 1024).toFixed(1)} MB
						</div>
					</div>

					<!-- Download button for individual files -->
					{#if file.status !== 'up-to-date' && onDownloadFile}
						<div class="flex min-w-[90px] flex-col items-end gap-1">
							<button
								type="button"
								class="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
								disabled={downloadingFiles.has(file.filename)}
								onclick={() => onDownloadFile?.(file)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onDownloadFile?.(file);
									}
								}}
								aria-label={`Download ${file.filename}`}
							>
								{#if downloadingFiles.has(file.filename)}
									<div class="flex items-center justify-center gap-1">
										<div
											class="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
										></div>
										<span class="text-xs">
											{#if currentDownloadFile === file.filename && downloadProgress > 0}
												{downloadProgress}%
											{:else}
												...
											{/if}
										</span>
									</div>
								{:else}
									Download
								{/if}
							</button>

							<!-- Individual Download Progress Bar -->
							{#if downloadingFiles.has(file.filename) && currentDownloadFile === file.filename && downloadProgress > 0}
								<div class="h-1.5 w-full rounded-full bg-gray-200">
									<div
										class="h-1.5 rounded-full bg-blue-600 transition-all duration-300 ease-out"
										style="width: {downloadProgress}%"
									></div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	{/if}
</div>
