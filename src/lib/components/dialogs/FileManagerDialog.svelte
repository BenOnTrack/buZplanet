<script lang="ts">
	import { Dialog, Label, Tabs } from 'bits-ui';
	import CloudArrowUp from 'phosphor-svelte/lib/CloudArrowUp';
	import CloudArrowDown from 'phosphor-svelte/lib/CloudArrowDown';
	import FileArchive from 'phosphor-svelte/lib/FileArchive';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CheckSquare from 'phosphor-svelte/lib/CheckSquare';
	import Square from 'phosphor-svelte/lib/Square';
	import MinusSquare from 'phosphor-svelte/lib/MinusSquare';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import FileHierarchyNode from './FileHierarchyNode.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	// Dynamic import to avoid code splitting issues
	let workerModule: any = null;

	// State for upload functionality
	let selectedFiles: FileList | null = $state(null);
	let isUploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state('');
	let dialogOpen = $state(false);
	let uploadProgress = $state(0);
	let currentUploadFile = $state('');

	// State for download functionality
	let r2Files: R2File[] = $state([]);
	let opfsFiles: OPFSFileInfo[] = $state([]);
	let fileComparison: FileComparisonResult[] = $state([]);
	let isLoadingFiles = $state(false);
	let downloadError = $state('');
	let downloadSuccess = $state('');
	let downloadingFiles = $state(new Set<string>());
	let selectedTab = $state('downloadLocal');
	let downloadProgress = $state(0);
	let currentDownloadFile = $state('');
	let allDownloadProgress = $state(0);

	// State for hierarchical file structure
	let fileHierarchy: FileHierarchy = $state({});
	let selectedFilesForDownload = $state(new Set<string>());
	let expandedNodes = $state(new Set<string>());

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

	// Dynamically import and get worker
	const getWorker = async () => {
		if (!workerModule) {
			workerModule = await import('$lib/utils/worker/index');
		}
		return workerModule.getWorker();
	};

	// Refresh worker after upload/download
	const refreshWorkerDatabases = async () => {
		try {
			const worker = await getWorker();
			await worker.sendMessage('scan-databases');
			console.log('✅ Worker databases refreshed successfully');
		} catch (error) {
			console.error('❌ Failed to refresh worker databases:', error);
		}
	};

	// Refresh the entire app to ensure tiles reload properly
	const refreshApp = () => {
		window.location.reload();
	};

	// Handle file upload to OPFS via worker
	const handleUpload = async (event: Event) => {
		event.preventDefault();

		if (!selectedFiles || selectedFiles.length === 0) {
			uploadError = 'Please select at least one .mbtiles file';
			return;
		}

		isUploading = true;
		uploadError = '';
		uploadSuccess = '';
		uploadProgress = 0;
		currentUploadFile = '';

		try {
			const worker = await getWorker();
			const uploadedFiles: string[] = [];
			const failedFiles: string[] = [];
			const totalFiles = selectedFiles.length;

			// Upload each file with progress tracking
			for (let i = 0; i < selectedFiles.length; i++) {
				const file = selectedFiles[i];
				currentUploadFile = file.name;
				uploadProgress = Math.round((i / totalFiles) * 100);

				try {
					// Convert file to ArrayBuffer for transfer
					const arrayBuffer = await file.arrayBuffer();

					// Send to worker for OPFS storage
					const savedPath = await worker.saveFileToOPFS(file.name, arrayBuffer);
					uploadedFiles.push(savedPath);
				} catch (fileError) {
					console.error(`Failed to upload ${file.name}:`, fileError);
					failedFiles.push(file.name);
				}
			}

			// Complete progress
			uploadProgress = 100;
			currentUploadFile = '';

			// Refresh worker databases if any files uploaded successfully
			if (uploadedFiles.length > 0) {
				await refreshWorkerDatabases();
				// Refresh app to ensure tiles reload properly
				setTimeout(() => {
					refreshApp();
				}, 1000);
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

				// Close dialog after a short delay (app will refresh anyway)
				setTimeout(() => {
					dialogOpen = false;
					uploadSuccess = '';
					uploadProgress = 0;
				}, 1500);
			}
		} catch (error) {
			uploadError = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			isUploading = false;
			uploadProgress = 0;
			currentUploadFile = '';
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

	// Get files from OPFS via worker with metadata
	const fetchOPFSFiles = async (): Promise<OPFSFileInfo[]> => {
		try {
			const worker = await getWorker();
			return await worker.listOPFSFiles();
		} catch (error) {
			console.error('Error fetching OPFS files:', error);
			return [];
		}
	};

	// Compare R2 and OPFS files with modification date checking
	const compareFiles = async () => {
		isLoadingFiles = true;
		downloadError = '';
		downloadSuccess = '';

		try {
			const [r2FilesList, opfsFilesList] = await Promise.all([fetchR2Files(), fetchOPFSFiles()]);

			r2Files = r2FilesList;
			opfsFiles = opfsFilesList;

			// Create comparison result with status checking
			fileComparison = r2Files.map((r2File) => {
				const filename = r2File.key;
				const opfsFile = opfsFiles.find((f) => f.filename === filename);
				const isInOPFS = !!opfsFile;

				let status: 'not-downloaded' | 'up-to-date' | 'needs-update' = 'not-downloaded';

				if (isInOPFS && opfsFile) {
					// Convert R2 lastModified string to timestamp for comparison
					const r2LastModified = new Date(r2File.lastModified).getTime();
					const opfsLastModified = opfsFile.lastModified;

					// Allow for small timestamp differences (1 second) due to precision
					const timeDifference = Math.abs(r2LastModified - opfsLastModified);

					if (timeDifference <= 1000) {
						// Files are the same (within 1 second tolerance)
						status = 'up-to-date';
					} else if (r2LastModified > opfsLastModified) {
						// R2 file is newer - needs update
						status = 'needs-update';
					} else {
						// OPFS file is newer (shouldn't happen normally, but treat as up-to-date)
						status = 'up-to-date';
					}
				}

				return {
					filename,
					isInOPFS,
					r2File,
					status,
					opfsFile
				};
			});

			// Build hierarchical structure
			buildFileHierarchy();
		} catch (error) {
			console.error('Error in compareFiles:', error);
			downloadError = error instanceof Error ? error.message : 'Failed to load files';
		} finally {
			isLoadingFiles = false;
		}
	};

	// Parse filename into components (type_continent_country_region)
	const parseFilename = (filename: string) => {
		// Remove .mbtiles extension and split by underscore
		const name = filename.replace(/\.mbtiles$/, '');
		const parts = name.split('_');

		if (parts.length >= 4) {
			return {
				type: parts[0],
				continent: parts[1],
				country: parts[2],
				region: parts.slice(3).join('_') // Join remaining parts in case region has underscores
			};
		}

		// Fallback for files that don't match expected format
		return {
			type: 'unknown',
			continent: 'other',
			country: 'other',
			region: name
		};
	};

	// Build hierarchical file structure
	const buildFileHierarchy = () => {
		const hierarchy: FileHierarchy = {};

		for (const file of fileComparison) {
			const parsed = parseFilename(file.filename);
			const { type, continent, country, region } = parsed;

			// Initialize continent
			if (!hierarchy[continent]) {
				hierarchy[continent] = {
					name: continent,
					children: {},
					path: [continent],
					totalFiles: 0,
					missingFiles: 0,
					allFilesDownloaded: false,
					partiallySelected: false,
					fullySelected: false
				};
			}

			// Initialize country
			if (!hierarchy[continent].children[country]) {
				hierarchy[continent].children[country] = {
					name: country,
					children: {},
					path: [continent, country],
					totalFiles: 0,
					missingFiles: 0,
					allFilesDownloaded: false,
					partiallySelected: false,
					fullySelected: false
				};
			}

			// Initialize region
			if (!hierarchy[continent].children[country].children[region]) {
				hierarchy[continent].children[country].children[region] = {
					name: region,
					children: {},
					path: [continent, country, region],
					totalFiles: 0,
					missingFiles: 0,
					allFilesDownloaded: false,
					partiallySelected: false,
					fullySelected: false
				};
			}

			// Initialize type
			if (!hierarchy[continent].children[country].children[region].children[type]) {
				hierarchy[continent].children[country].children[region].children[type] = {
					name: type,
					files: [],
					children: {},
					path: [continent, country, region, type],
					totalFiles: 0,
					missingFiles: 0,
					allFilesDownloaded: false,
					partiallySelected: false,
					fullySelected: false
				};
			}

			// Add file to type
			hierarchy[continent].children[country].children[region].children[type].files.push(file);
		}

		// Calculate totals and status for all nodes
		for (const [continentName, continent] of Object.entries(hierarchy)) {
			for (const [countryName, country] of Object.entries(continent.children)) {
				for (const [regionName, region] of Object.entries(country.children)) {
					for (const [typeName, typeNode] of Object.entries(region.children)) {
						// Calculate type totals based on status
						typeNode.totalFiles = typeNode.files.length;
						typeNode.missingFiles = typeNode.files.filter((f) => f.status !== 'up-to-date').length;
						typeNode.allFilesDownloaded = typeNode.missingFiles === 0;
					}

					// Calculate region totals
					region.totalFiles = Object.values(region.children).reduce(
						(sum, type) => sum + type.totalFiles,
						0
					);
					region.missingFiles = Object.values(region.children).reduce(
						(sum, type) => sum + type.missingFiles,
						0
					);
					region.allFilesDownloaded = region.missingFiles === 0;
				}

				// Calculate country totals
				country.totalFiles = Object.values(country.children).reduce(
					(sum, region) => sum + region.totalFiles,
					0
				);
				country.missingFiles = Object.values(country.children).reduce(
					(sum, region) => sum + region.missingFiles,
					0
				);
				country.allFilesDownloaded = country.missingFiles === 0;
			}

			// Calculate continent totals
			continent.totalFiles = Object.values(continent.children).reduce(
				(sum, country) => sum + country.totalFiles,
				0
			);
			continent.missingFiles = Object.values(continent.children).reduce(
				(sum, country) => sum + country.missingFiles,
				0
			);
			continent.allFilesDownloaded = continent.missingFiles === 0;
		}

		fileHierarchy = hierarchy;
		updateSelectionStates();
	};

	// Update selection states based on current selections
	const updateSelectionStates = () => {
		// Update type nodes
		for (const continent of Object.values(fileHierarchy)) {
			for (const country of Object.values(continent.children)) {
				for (const region of Object.values(country.children)) {
					for (const typeNode of Object.values(region.children)) {
						const selectedCount = typeNode.files.filter(
							(f) => selectedFilesForDownload.has(f.filename) || f.status === 'up-to-date'
						).length;
						typeNode.fullySelected =
							selectedCount === typeNode.files.length && typeNode.files.length > 0;
						typeNode.partiallySelected = selectedCount > 0 && selectedCount < typeNode.files.length;
					}

					// Update region selection state
					const regionTypes = Object.values(region.children);
					const fullySelectedTypes = regionTypes.filter((t) => t.fullySelected).length;
					const partiallySelectedTypes = regionTypes.filter((t) => t.partiallySelected).length;

					region.fullySelected =
						fullySelectedTypes === regionTypes.length && regionTypes.length > 0;
					region.partiallySelected =
						(fullySelectedTypes > 0 || partiallySelectedTypes > 0) && !region.fullySelected;
				}

				// Update country selection state
				const countryRegions = Object.values(country.children);
				const fullySelectedRegions = countryRegions.filter((r) => r.fullySelected).length;
				const partiallySelectedRegions = countryRegions.filter((r) => r.partiallySelected).length;

				country.fullySelected =
					fullySelectedRegions === countryRegions.length && countryRegions.length > 0;
				country.partiallySelected =
					(fullySelectedRegions > 0 || partiallySelectedRegions > 0) && !country.fullySelected;
			}

			// Update continent selection state
			const continentCountries = Object.values(continent.children);
			const fullySelectedCountries = continentCountries.filter((c) => c.fullySelected).length;
			const partiallySelectedCountries = continentCountries.filter(
				(c) => c.partiallySelected
			).length;

			continent.fullySelected =
				fullySelectedCountries === continentCountries.length && continentCountries.length > 0;
			continent.partiallySelected =
				(fullySelectedCountries > 0 || partiallySelectedCountries > 0) && !continent.fullySelected;
		}
	};

	// Handle node selection (checkbox clicks)
	const toggleNodeSelection = (path: string[], selectAll: boolean) => {
		const [continent, country, region, type] = path;

		if (path.length === 4) {
			// Type level - select/deselect all files in this type
			const typeNode =
				fileHierarchy[continent]?.children[country]?.children[region]?.children[type];
			if (typeNode) {
				for (const file of typeNode.files) {
					if (selectAll && file.status !== 'up-to-date') {
						// Only add to selection if file needs downloading or updating
						selectedFilesForDownload.add(file.filename);
					} else {
						// Remove from selection (up-to-date files stay visually checked)
						selectedFilesForDownload.delete(file.filename);
					}
				}
			}
		} else if (path.length === 3) {
			// Region level - select/deselect all types in this region
			const regionNode = fileHierarchy[continent]?.children[country]?.children[region];
			if (regionNode) {
				for (const typeNode of Object.values(regionNode.children)) {
					for (const file of typeNode.files) {
						if (selectAll && file.status !== 'up-to-date') {
							selectedFilesForDownload.add(file.filename);
						} else {
							selectedFilesForDownload.delete(file.filename);
						}
					}
				}
			}
		} else if (path.length === 2) {
			// Country level - select/deselect all regions in this country
			const countryNode = fileHierarchy[continent]?.children[country];
			if (countryNode) {
				for (const regionNode of Object.values(countryNode.children)) {
					for (const typeNode of Object.values(regionNode.children)) {
						for (const file of typeNode.files) {
							if (selectAll && file.status !== 'up-to-date') {
								selectedFilesForDownload.add(file.filename);
							} else {
								selectedFilesForDownload.delete(file.filename);
							}
						}
					}
				}
			}
		} else if (path.length === 1) {
			// Continent level - select/deselect all countries in this continent
			const continentNode = fileHierarchy[continent];
			if (continentNode) {
				for (const countryNode of Object.values(continentNode.children)) {
					for (const regionNode of Object.values(countryNode.children)) {
						for (const typeNode of Object.values(regionNode.children)) {
							for (const file of typeNode.files) {
								if (selectAll && file.status !== 'up-to-date') {
									selectedFilesForDownload.add(file.filename);
								} else {
									selectedFilesForDownload.delete(file.filename);
								}
							}
						}
					}
				}
			}
		}

		// Trigger reactivity by reassigning the Set
		selectedFilesForDownload = new Set(selectedFilesForDownload);

		// Update selection states
		updateSelectionStates();
	};

	// Toggle node expansion
	const toggleExpansion = (path: string[]) => {
		const pathKey = path.join('/');
		if (expandedNodes.has(pathKey)) {
			expandedNodes.delete(pathKey);
		} else {
			expandedNodes.add(pathKey);
		}
		// Trigger reactivity by reassigning the Set
		expandedNodes = new Set(expandedNodes);
	};

	// Download a file from R2 to OPFS with progress tracking
	const downloadFile = async (file: FileComparisonResult) => {
		if (downloadingFiles.has(file.filename)) return;

		downloadingFiles.add(file.filename);
		downloadError = '';
		downloadSuccess = '';
		downloadProgress = 0;
		currentDownloadFile = file.filename;

		try {
			// Start download from R2
			const response = await fetch(`/api/download?file=${encodeURIComponent(file.r2File.key)}`);
			if (!response.ok) {
				throw new Error(`Failed to download file: ${response.status}`);
			}

			// Get content length for progress tracking
			const contentLength = response.headers.get('Content-Length');
			const totalBytes = contentLength ? parseInt(contentLength) : 0;

			let downloadedBytes = 0;
			const chunks: Uint8Array[] = [];

			// Read response with progress tracking
			const reader = response.body?.getReader();
			if (!reader) throw new Error('Failed to get response reader');

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				chunks.push(value);
				downloadedBytes += value.length;

				// Update progress if we know total size
				if (totalBytes > 0) {
					downloadProgress = Math.round((downloadedBytes / totalBytes) * 100);
				} else {
					// Indeterminate progress - animate between 10-90%
					downloadProgress = Math.min(90, 10 + (downloadedBytes / 1024 / 1024) * 5);
				}
			}

			// Combine chunks into blob
			const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const blob = new Blob([combined]);
			const downloadedFile = new File([blob], file.filename, {
				type: 'application/x-sqlite3'
			});

			// Save to OPFS via worker with R2 metadata
			downloadProgress = 95; // Almost done
			const worker = await getWorker();
			await worker.saveFileToOPFS(
				file.filename,
				combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength),
				undefined,
				{ lastModified: file.r2File.lastModified, size: file.r2File.size }
			);
			downloadProgress = 100;

			// Refresh worker databases
			await refreshWorkerDatabases();

			// Refresh app to ensure tiles reload properly
			setTimeout(() => {
				refreshApp();
			}, 1000);

			// Update comparison state to mark as up-to-date
			fileComparison = fileComparison.map((f) =>
				f.filename === file.filename ? { ...f, isInOPFS: true, status: 'up-to-date' } : f
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
			downloadProgress = 0;
			currentDownloadFile = '';
		}
	};

	// Download all files that need updating or are missing
	const downloadAllMissing = async () => {
		const missingFiles = fileComparison.filter((f) => f.status !== 'up-to-date');
		if (missingFiles.length === 0) return;

		downloadError = '';
		downloadSuccess = '';
		allDownloadProgress = 0;

		let successful = 0;
		let failed = 0;
		const totalFiles = missingFiles.length;

		for (let i = 0; i < missingFiles.length; i++) {
			const file = missingFiles[i];
			currentDownloadFile = file.filename;
			allDownloadProgress = Math.round((i / totalFiles) * 100);

			// Use the single download function but handle errors internally
			downloadingFiles.add(file.filename);
			downloadError = '';
			downloadSuccess = '';
			downloadProgress = 0;

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

				// Save to OPFS via worker with R2 metadata
				const worker = await getWorker();
				const arrayBuffer = await blob.arrayBuffer();
				await worker.saveFileToOPFS(file.filename, arrayBuffer, undefined, {
					lastModified: file.r2File.lastModified,
					size: file.r2File.size
				});

				// Update comparison state to mark as up-to-date
				fileComparison = fileComparison.map((f) =>
					f.filename === file.filename ? { ...f, isInOPFS: true, status: 'up-to-date' } : f
				);

				successful++;
			} catch (error) {
				console.error(`Failed to download ${file.filename}:`, error);
				failed++;
			} finally {
				downloadingFiles.delete(file.filename);
			}
		}

		// Complete progress
		allDownloadProgress = 100;
		currentDownloadFile = '';

		// Refresh worker databases if any files downloaded successfully
		if (successful > 0) {
			await refreshWorkerDatabases();
			// Refresh app to ensure tiles reload properly
			setTimeout(() => {
				refreshApp();
			}, 1000);
		}

		if (successful > 0 && failed === 0) {
			downloadSuccess = `Successfully downloaded ${successful} file${successful > 1 ? 's' : ''}`;
		} else if (successful > 0 && failed > 0) {
			downloadSuccess = `Downloaded ${successful} file${successful > 1 ? 's' : ''}`;
			downloadError = `Failed to download ${failed} file${failed > 1 ? 's' : ''}`;
		} else {
			downloadError = `Failed to download all ${failed} file${failed > 1 ? 's' : ''}`;
		}

		// Reset progress after delay
		setTimeout(() => {
			allDownloadProgress = 0;
		}, 3000);
	};

	// Download selected files that need updating or are missing
	const downloadSelectedFiles = async () => {
		const selectedFilesList = Array.from(selectedFilesForDownload)
			.map((filename) => fileComparison.find((f) => f.filename === filename))
			.filter((f) => f && f.status !== 'up-to-date') as FileComparisonResult[];

		if (selectedFilesList.length === 0) {
			downloadError = 'No files selected for download';
			return;
		}

		downloadError = '';
		downloadSuccess = '';
		allDownloadProgress = 0;

		let successful = 0;
		let failed = 0;
		const totalFiles = selectedFilesList.length;

		for (let i = 0; i < selectedFilesList.length; i++) {
			const file = selectedFilesList[i];
			currentDownloadFile = file.filename;
			allDownloadProgress = Math.round((i / totalFiles) * 100);

			downloadingFiles.add(file.filename);
			downloadError = '';
			downloadSuccess = '';
			downloadProgress = 0;

			try {
				// Download from R2
				const response = await fetch(`/api/download?file=${encodeURIComponent(file.r2File.key)}`);
				if (!response.ok) {
					throw new Error(`Failed to download file: ${response.status}`);
				}

				// Convert response to blob
				const blob = await response.blob();

				// Save to OPFS via worker with R2 metadata
				const worker = await getWorker();
				const arrayBuffer = await blob.arrayBuffer();
				await worker.saveFileToOPFS(file.filename, arrayBuffer, undefined, {
					lastModified: file.r2File.lastModified,
					size: file.r2File.size
				});

				// Update comparison state to mark as up-to-date
				fileComparison = fileComparison.map((f) =>
					f.filename === file.filename ? { ...f, isInOPFS: true, status: 'up-to-date' } : f
				);

				// Remove from selected files
				selectedFilesForDownload.delete(file.filename);

				successful++;
			} catch (error) {
				console.error(`Failed to download ${file.filename}:`, error);
				failed++;
			} finally {
				downloadingFiles.delete(file.filename);
			}
		}

		// Complete progress
		allDownloadProgress = 100;
		currentDownloadFile = '';

		// Refresh file hierarchy
		buildFileHierarchy();

		// Refresh worker databases if any files downloaded successfully
		if (successful > 0) {
			await refreshWorkerDatabases();
			// Refresh app to ensure tiles reload properly
			setTimeout(() => {
				refreshApp();
			}, 1000);
		}

		if (successful > 0 && failed === 0) {
			downloadSuccess = `Successfully downloaded ${successful} file${successful > 1 ? 's' : ''}`;
		} else if (successful > 0 && failed > 0) {
			downloadSuccess = `Downloaded ${successful} file${successful > 1 ? 's' : ''}`;
			downloadError = `Failed to download ${failed} file${failed > 1 ? 's' : ''}`;
		} else {
			downloadError = `Failed to download all ${failed} file${failed > 1 ? 's' : ''}`;
		}

		// Reset progress after delay
		setTimeout(() => {
			allDownloadProgress = 0;
		}, 3000);
	};

	// Handle tab change
	const handleTabChange = (value: string) => {
		selectedTab = value;
		if (value === 'downloadRemote' && fileComparison.length === 0) {
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
			uploadProgress = 0;
			currentUploadFile = '';
			const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}

			// Reset download state
			downloadError = '';
			downloadSuccess = '';
			downloadProgress = 0;
			currentDownloadFile = '';
			allDownloadProgress = 0;
			downloadingFiles.clear();

			// Reset hierarchical state
			selectedFilesForDownload.clear();
			expandedNodes.clear();
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
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-18 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
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
		<PropertyIcon key={'description'} value={'download'} size={20} />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-5 outline-hidden sm:max-w-[490px] md:w-full"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
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
							value="downloadLocal"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Download Local</Tabs.Trigger
						>
						<Tabs.Trigger
							value="downloadRemote"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Download Remote</Tabs.Trigger
						>
					</Tabs.List>
					<Tabs.Content value="downloadLocal" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<Dialog.Description class="text-foreground-alt mb-6 text-sm">
								Download .mbtiles files from your computer to local storage. You can select multiple
								.mbtiles files at once.
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

							<!-- Download Progress Bar -->
							{#if isUploading}
								<div class="mb-4 space-y-2">
									<div class="flex items-center justify-between text-sm text-gray-600">
										<span>
											{currentUploadFile || 'Processing files...'}
										</span>
										<span>{uploadProgress}%</span>
									</div>
									<div class="h-2 w-full rounded-full bg-gray-200">
										<div
											class="h-2 rounded-full bg-blue-600 transition-all duration-300 ease-out"
											style="width: {uploadProgress}%"
										></div>
									</div>
								</div>
							{/if}

							<!-- Download Status Messages -->
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
									aria-label="Download selected .mbtiles files to local storage"
								>
									{#if isUploading}
										Downloading...
									{:else}
										Download
									{/if}
								</button>
							</div>
						</div>
					</Tabs.Content>
					<Tabs.Content value="downloadRemote" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<Dialog.Description class="text-foreground-alt mb-6 text-sm">
								Download .mbtiles files from your cloud storage (Cloudflare R2) to local storage.
								Files are automatically compared by modification date to show their status: ✓ Up to
								date (green), ↻ Needs update (yellow), ⚬ Not downloaded (gray).
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
								<!-- Hierarchical File Structure -->
								<div class="mb-6 space-y-1">
									{#each Object.values(fileHierarchy) as continentNode}
										<FileHierarchyNode
											node={continentNode}
											{expandedNodes}
											selectedFiles={selectedFilesForDownload}
											{downloadingFiles}
											level={0}
											onToggleExpansion={toggleExpansion}
											onToggleSelection={toggleNodeSelection}
											onDownloadFile={downloadFile}
											onFileSelectionChange={() => {
												// Ensure reactivity by reassigning
												selectedFilesForDownload = new Set(selectedFilesForDownload);
												updateSelectionStates();
											}}
											{downloadProgress}
											{currentDownloadFile}
										/>
									{/each}
								</div>

								<!-- Download Selected Files Button -->
								{@const selectedCount = selectedFilesForDownload.size}
								{#if selectedCount > 0}
									<div class="mb-4">
										<div
											class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
										>
											<div>
												<p class="text-sm font-medium text-blue-900">
													{selectedCount} file{selectedCount > 1 ? 's' : ''} selected
												</p>
												<p class="text-xs text-blue-700">
													Download selected files to local storage
												</p>
											</div>
											<button
												type="button"
												class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
												disabled={downloadingFiles.size > 0 || allDownloadProgress > 0}
												onclick={downloadSelectedFiles}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														downloadSelectedFiles();
													}
												}}
												aria-label="Download selected files to local storage"
											>
												<CloudArrowDown class="size-4" />
												Download Selected ({selectedCount})
											</button>
										</div>
									</div>
								{/if}

								<!-- Overall Download Progress Bar for Selected Files -->
								{#if allDownloadProgress > 0}
									<div class="mb-4 space-y-2">
										<div class="flex items-center justify-between text-sm text-gray-600">
											<span>
												{currentDownloadFile || 'Processing selected files...'}
											</span>
											<span>{allDownloadProgress}%</span>
										</div>
										<div class="h-2 w-full rounded-full bg-gray-200">
											<div
												class="h-2 rounded-full bg-blue-600 transition-all duration-300 ease-out"
												style="width: {allDownloadProgress}%"
											></div>
										</div>
									</div>
								{/if}

								<!-- Download All Missing Button -->
								{@const missingFiles = fileComparison.filter((f) => f.status !== 'up-to-date')}
								{#if missingFiles.length > 0}
									{@const notDownloaded = missingFiles.filter(
										(f) => f.status === 'not-downloaded'
									).length}
									{@const needsUpdate = missingFiles.filter(
										(f) => f.status === 'needs-update'
									).length}
									<div class="space-y-3">
										<div
											class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
										>
											<div>
												<p class="text-sm font-medium text-blue-900">
													{#if notDownloaded > 0 && needsUpdate > 0}
														{notDownloaded} file{notDownloaded > 1 ? 's' : ''} not downloaded, {needsUpdate}
														need{needsUpdate > 1 ? '' : 's'} update
													{:else if notDownloaded > 0}
														{notDownloaded} file{notDownloaded > 1 ? 's' : ''} not downloaded yet
													{:else}
														{needsUpdate} file{needsUpdate > 1 ? 's' : ''} need{needsUpdate > 1
															? ''
															: 's'} update
													{/if}
												</p>
												<p class="text-xs text-blue-700">
													Download all missing/outdated files to local storage
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

										<!-- Overall Download Progress Bar -->
										{#if allDownloadProgress > 0}
											<div class="space-y-2">
												<div class="flex items-center justify-between text-sm text-gray-600">
													<span>
														{currentDownloadFile || 'Processing files...'}
													</span>
													<span>{allDownloadProgress}%</span>
												</div>
												<div class="h-2 w-full rounded-full bg-gray-200">
													<div
														class="h-2 rounded-full bg-blue-600 transition-all duration-300 ease-out"
														style="width: {allDownloadProgress}%"
													></div>
												</div>
											</div>
										{/if}
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
					<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
					<span class="sr-only">Close</span>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
