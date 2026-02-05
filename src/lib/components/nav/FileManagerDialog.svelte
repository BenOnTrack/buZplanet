<script lang="ts">
	import { Dialog, Label, Separator, Tabs } from 'bits-ui';
	import Upload from 'phosphor-svelte/lib/Upload';
	import X from 'phosphor-svelte/lib/X';
	import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';
	import Download from 'phosphor-svelte/lib/Download';
	import CloudArrowDown from 'phosphor-svelte/lib/CloudArrowDown';
	import FileArchive from 'phosphor-svelte/lib/FileArchive';
	import { opfsManager } from '$lib/utils/opfs';

	interface R2File {
		key: string;
		size: number;
		lastModified: string;
	}

	interface FileComparisonResult {
		filename: string;
		isInOPFS: boolean;
		r2File: R2File;
	}

	// State for upload functionality
	let selectedFiles: FileList | null = $state(null);
	let isUploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state('');
	let dialogOpen = $state(false);

	// State for download functionality
	let r2Files: R2File[] = $state([]);
	let opfsFiles: string[] = $state([]);
	let fileComparison: FileComparisonResult[] = $state([]);
	let isLoadingFiles = $state(false);
	let downloadError = $state('');
	let downloadSuccess = $state('');
	let downloadingFiles = $state(new Set<string>());
	let selectedTab = $state('upload');

	// Handle file selection
	const handleFileChange = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			// Validate all files are .mbtiles
			const invalidFiles = Array.from(input.files).filter(
				(file) => !file.name.toLowerCase().endsWith('.mbtiles')
			);

			if (invalidFiles.length > 0) {
				uploadError = `Only .mbtiles files are allowed. Invalid files: ${invalidFiles.map((f) => f.name).join(', ')}`;
				selectedFiles = null;
				input.value = '';
				return;
			}

			selectedFiles = input.files;
			uploadError = '';
			uploadSuccess = '';
		}
	};

	// Handle file upload to OPFS
	const handleUpload = async (event: Event) => {
		event.preventDefault();

		if (!selectedFiles || selectedFiles.length === 0) {
			uploadError = 'Please select at least one .mbtiles file';
			return;
		}

		isUploading = true;
		uploadError = '';
		uploadSuccess = '';

		try {
			const uploadedFiles: string[] = [];
			const failedFiles: string[] = [];

			// Upload each file
			for (let i = 0; i < selectedFiles.length; i++) {
				const file = selectedFiles[i];
				try {
					const filePath = await opfsManager.saveFile(file);
					uploadedFiles.push(filePath);
				} catch (fileError) {
					failedFiles.push(file.name);
				}
			}

			// Show results
			if (uploadedFiles.length > 0 && failedFiles.length === 0) {
				uploadSuccess = `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} uploaded successfully`;
			} else if (uploadedFiles.length > 0 && failedFiles.length > 0) {
				uploadSuccess = `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} uploaded successfully`;
				uploadError = `Failed to upload: ${failedFiles.join(', ')}`;
			} else {
				uploadError = `Failed to upload all files: ${failedFiles.join(', ')}`;
			}

			// Reset form if all files uploaded successfully
			if (failedFiles.length === 0) {
				selectedFiles = null;
				const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
				if (fileInput) {
					fileInput.value = '';
				}

				// Close dialog after a short delay
				setTimeout(() => {
					dialogOpen = false;
					uploadSuccess = '';
				}, 2000);
			}
		} catch (error) {
			uploadError = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			isUploading = false;
		}
	};

	// Fetch files from R2 bucket
	const fetchR2Files = async (): Promise<R2File[]> => {
		try {
			const response = await fetch('/api/files?limit=1000');

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Failed to fetch files: ${response.status} ${response.statusText}. ${errorText}`
				);
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to fetch files');
			}

			return data.files || [];
		} catch (error) {
			console.error('Error fetching R2 files:', error);
			throw error;
		}
	};

	// Get files from OPFS
	const fetchOPFSFiles = async (): Promise<string[]> => {
		try {
			return await opfsManager.listFiles();
		} catch (error) {
			console.error('Error fetching OPFS files:', error);
			return [];
		}
	};

	// Compare R2 and OPFS files
	const compareFiles = async () => {
		isLoadingFiles = true;
		downloadError = '';
		downloadSuccess = '';

		try {
			const [r2FilesList, opfsFilesList] = await Promise.all([fetchR2Files(), fetchOPFSFiles()]);

			r2Files = r2FilesList;
			opfsFiles = opfsFilesList;

			// Create comparison result
			fileComparison = r2Files.map((r2File) => {
				const filename = r2File.key;
				const isInOPFS = opfsFiles.includes(filename);
				return {
					filename,
					isInOPFS,
					r2File
				};
			});
		} catch (error) {
			console.error('Error in compareFiles:', error);
			downloadError = error instanceof Error ? error.message : 'Failed to load files';
		} finally {
			isLoadingFiles = false;
		}
	};

	// Download a file from R2 to OPFS
	const downloadFile = async (file: FileComparisonResult) => {
		if (downloadingFiles.has(file.filename)) return;

		downloadingFiles.add(file.filename);
		downloadError = '';
		downloadSuccess = '';

		try {
			// Download from R2
			const response = await fetch(`/api/download?file=${encodeURIComponent(file.r2File.key)}`);
			if (!response.ok) {
				throw new Error(`Failed to download file: ${response.status}`);
			}

			// Convert response to File object
			const blob = await response.blob();
			const downloadedFile = new File([blob], file.filename, {
				type: 'application/x-sqlite3'
			});

			// Save to OPFS
			await opfsManager.saveFile(downloadedFile);

			// Update comparison state
			fileComparison = fileComparison.map((f) =>
				f.filename === file.filename ? { ...f, isInOPFS: true } : f
			);

			downloadSuccess = `Successfully downloaded ${file.filename}`;

			// Clear success message after delay
			setTimeout(() => {
				downloadSuccess = '';
			}, 3000);
		} catch (error) {
			downloadError = `Failed to download ${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			downloadingFiles.delete(file.filename);
		}
	};

	// Download all missing files
	const downloadAllMissing = async () => {
		const missingFiles = fileComparison.filter((f) => !f.isInOPFS);
		if (missingFiles.length === 0) return;

		downloadError = '';
		downloadSuccess = '';

		let successful = 0;
		let failed = 0;

		for (const file of missingFiles) {
			try {
				await downloadFile(file);
				successful++;
			} catch {
				failed++;
			}
		}

		if (successful > 0 && failed === 0) {
			downloadSuccess = `Successfully downloaded ${successful} file${successful > 1 ? 's' : ''}`;
		} else if (successful > 0 && failed > 0) {
			downloadSuccess = `Downloaded ${successful} file${successful > 1 ? 's' : ''}`;
			downloadError = `Failed to download ${failed} file${failed > 1 ? 's' : ''}`;
		} else {
			downloadError = `Failed to download all ${failed} file${failed > 1 ? 's' : ''}`;
		}
	};

	// Handle tab change
	const handleTabChange = (value: string) => {
		selectedTab = value;
		if (value === 'download' && fileComparison.length === 0) {
			compareFiles();
		}
	};

	// Reset state when dialog closes
	const handleOpenChange = (open: boolean) => {
		dialogOpen = open;
		if (!open) {
			// Reset upload state
			selectedFiles = null;
			uploadError = '';
			uploadSuccess = '';
			const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}

			// Reset download state
			downloadError = '';
			downloadSuccess = '';
			downloadingFiles.clear();
		}
	};

	// Format file size
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	// Format date
	const formatDate = (dateString: string): string => {
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return 'Unknown';
		}
	};
</script>

<Dialog.Root bind:open={dialogOpen} onOpenChange={handleOpenChange}>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-20 left-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		onclick={(e) => {
			dialogOpen = true;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.currentTarget.click();
			}
		}}
		aria-label="Open upload dialog"
	>
		<Upload class="size-5" />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-5 outline-hidden sm:max-w-[490px] md:w-full"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				File Manager
			</Dialog.Title>

			<div class="pt-6">
				<Tabs.Root
					value={selectedTab}
					onValueChange={handleTabChange}
					class="rounded-card border-muted bg-background-alt shadow-card w-full border p-3"
				>
					<Tabs.List
						class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full grid-cols-2 gap-1 p-1 text-sm leading-[0.01em] font-semibold dark:border dark:border-neutral-600/30"
					>
						<Tabs.Trigger
							value="upload"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Upload</Tabs.Trigger
						>
						<Tabs.Trigger
							value="download"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Download</Tabs.Trigger
						>
					</Tabs.List>
					<Tabs.Content value="upload" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<Dialog.Description class="text-foreground-alt mb-6 text-sm">
								Upload .mbtiles files to your storage. You can select multiple .mbtiles files at
								once.
							</Dialog.Description>
							<div class="flex flex-col items-start gap-1 pb-6">
								<Label.Root for="fileUpload" class="text-sm font-medium"
									>Choose .mbtiles Files</Label.Root
								>
								<div class="relative w-full">
									<input
										id="fileUpload"
										type="file"
										class="h-input rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background inline-flex w-full items-center border px-4 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:text-sm"
										name="file"
										accept=".mbtiles"
										multiple
										onchange={handleFileChange}
									/>
									<CloudArrowUp
										class="text-dark/30 pointer-events-none absolute top-[14px] right-4 size-[22px]"
									/>
								</div>
							</div>

							<!-- Upload Status Messages -->
							{#if uploadError}
								<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
									<p class="text-sm text-red-800">{uploadError}</p>
								</div>
							{/if}

							{#if uploadSuccess}
								<div class="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
									<p class="text-sm text-green-800">{uploadSuccess}</p>
								</div>
							{/if}

							<div class="flex w-full justify-end">
								<button
									type="button"
									class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-dark focus-visible:ring-offset-background inline-flex items-center justify-center px-[50px] text-[15px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
									disabled={!selectedFiles || selectedFiles.length === 0 || isUploading}
									onclick={handleUpload}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleUpload(e);
										}
									}}
									aria-label="Upload selected .mbtiles files to storage"
								>
									{#if isUploading}
										Uploading...
									{:else}
										Upload
									{/if}
								</button>
							</div>
						</div>
					</Tabs.Content>
					<Tabs.Content value="download" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<Dialog.Description class="text-foreground-alt mb-6 text-sm">
								Download .mbtiles files from your cloud storage to local storage. Files already
								stored locally are marked with a checkmark.
							</Dialog.Description>

							<!-- Loading State -->
							{#if isLoadingFiles}
								<div class="flex items-center justify-center py-8">
									<div class="text-foreground-alt flex items-center gap-2 text-sm">
										<div class="border-dark h-4 w-4 animate-spin rounded-full border-b-2"></div>
										Loading files...
									</div>
								</div>
							{/if}

							<!-- Download Status Messages -->
							{#if downloadError}
								<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
									<p class="text-sm text-red-800">{downloadError}</p>
								</div>
							{/if}

							{#if downloadSuccess}
								<div class="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
									<p class="text-sm text-green-800">{downloadSuccess}</p>
								</div>
							{/if}

							<!-- File List -->
							{#if !isLoadingFiles && fileComparison.length > 0}
								<div class="mb-6 space-y-2">
									{#each fileComparison as file}
										<div
											class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
										>
											<div class="flex min-w-0 flex-1 items-center gap-3">
												<FileArchive
													class={`size-5 flex-shrink-0 ${file.isInOPFS ? 'text-green-600' : 'text-gray-400'}`}
												/>
												<div class="min-w-0 flex-1">
													<div class="flex items-center gap-2">
														<p class="truncate text-sm font-medium text-gray-900">
															{file.filename}
														</p>
														{#if file.isInOPFS}
															<span
																class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
															>
																✓ Local
															</span>
														{/if}
													</div>
													<div class="flex items-center gap-4 text-xs text-gray-500">
														<span>{formatFileSize(file.r2File.size)}</span>
														<span>{formatDate(file.r2File.lastModified)}</span>
													</div>
												</div>
											</div>
											{#if !file.isInOPFS}
												<button
													type="button"
													class="bg-dark hover:bg-dark/95 focus-visible:outline-dark inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
													disabled={downloadingFiles.has(file.filename)}
													onclick={() => downloadFile(file)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															downloadFile(file);
														}
													}}
													aria-label={`Download ${file.filename} to local storage`}
												>
													{#if downloadingFiles.has(file.filename)}
														<div
															class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"
														></div>
														Downloading...
													{:else}
														<CloudArrowDown class="size-4" />
														Download
													{/if}
												</button>
											{:else}
												<span class="text-sm font-medium text-green-600">Downloaded</span>
											{/if}
										</div>
									{/each}
								</div>

								<!-- Download All Missing Button -->
								{@const missingFiles = fileComparison.filter((f) => !f.isInOPFS)}
								{#if missingFiles.length > 0}
									<div
										class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
									>
										<div>
											<p class="text-sm font-medium text-blue-900">
												{missingFiles.length} file{missingFiles.length > 1 ? 's' : ''} not downloaded
												yet
											</p>
											<p class="text-xs text-blue-700">
												Download all missing files to local storage
											</p>
										</div>
										<button
											type="button"
											class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
											disabled={downloadingFiles.size > 0}
											onclick={downloadAllMissing}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													downloadAllMissing();
												}
											}}
											aria-label="Download all missing files to local storage"
										>
											<CloudArrowDown class="size-4" />
											Download All ({missingFiles.length})
										</button>
									</div>
								{/if}

								<!-- Refresh Button -->
								<div class="flex w-full justify-center pt-4">
									<button
										type="button"
										class="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
										onclick={compareFiles}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												compareFiles();
											}
										}}
										aria-label="Refresh file list"
									>
										Refresh Files
									</button>
								</div>
							{:else if !isLoadingFiles}
								<div class="py-8 text-center text-sm text-gray-500">
									<FileArchive class="mx-auto mb-4 size-12 text-gray-300" />
									<p class="mb-2">No .mbtiles files found in cloud storage</p>
									<p class="mb-4 text-xs">
										Check your Cloudflare R2 bucket or upload some .mbtiles files first
									</p>
									<button
										type="button"
										class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
										onclick={compareFiles}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												compareFiles();
											}
										}}
									>
										Try Again
									</button>
								</div>
							{/if}
						</div>
					</Tabs.Content>
				</Tabs.Root>
			</div>
			<Dialog.Close
				class="focus-visible:ring-foreground focus-visible:ring-offset-background absolute top-5 right-5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
			>
				<div>
					<X class="text-foreground size-5" />
					<span class="sr-only">Close</span>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
