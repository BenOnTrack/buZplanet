<!--
  Test component to demonstrate and verify tile merging functionality
  Shows how multiple .mbtiles files with overlapping data get merged
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { getWorker } from '$lib/utils/worker';
	import type { Map as MaplibreMap } from 'maplibre-gl';

	let status = 'Initializing...';
	let databases: Array<{ filename: string; metadata: any }> = [];
	let testResults: Array<{
		source: string;
		z: number;
		x: number;
		y: number;
		merged: boolean;
		size: number;
	}> = [];

	onMount(async () => {
		const worker = getWorker();

		try {
			status = 'Initializing worker and scanning databases...';

			// Initialize worker
			await worker.initializeWorker();

			// Scan databases
			const scanResult = await worker.scanDatabases();
			status = `Found ${scanResult.successfulDbs} databases`;

			// List databases
			const dbResult = await worker.listDatabases();
			databases = dbResult.databases;

			status = 'Ready to test tile merging';
		} catch (error) {
			console.error('Failed to initialize:', error);
			status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
	});

	async function testTileMerging() {
		if (databases.length === 0) {
			status = 'No databases available for testing';
			return;
		}

		const worker = getWorker();
		status = 'Testing tile merging...';
		testResults = [];

		// Test common coordinates that might exist in multiple databases
		const testCoordinates = [
			{ source: 'poi', z: 14, x: 8738, y: 5678 }, // Example coordinates
			{ source: 'building', z: 14, x: 8738, y: 5678 },
			{ source: 'natural', z: 13, x: 4369, y: 2839 },
			{ source: 'landuse', z: 12, x: 2184, y: 1419 }
		];

		for (const coord of testCoordinates) {
			try {
				const startTime = performance.now();
				const tileData = await worker.requestTile(coord.source, coord.z, coord.x, coord.y);
				const endTime = performance.now();

				if (tileData) {
					testResults.push({
						source: coord.source,
						z: coord.z,
						x: coord.x,
						y: coord.y,
						merged: tileData.byteLength > 1000, // Rough heuristic - merged tiles tend to be larger
						size: tileData.byteLength
					});

					console.log(
						`🔍 Tile ${coord.source} ${coord.z}/${coord.x}/${coord.y}: ${tileData.byteLength} bytes (${(endTime - startTime).toFixed(2)}ms)`
					);
				}
			} catch (error) {
				console.warn(`Failed to get tile ${coord.source} ${coord.z}/${coord.x}/${coord.y}:`, error);
			}
		}

		status = `Testing complete. Found ${testResults.length} tiles.`;
		testResults = [...testResults]; // Trigger reactivity
	}

	async function testSpecificTile() {
		const worker = getWorker();
		const z = 14;
		const x = prompt('Enter X coordinate:');
		const y = prompt('Enter Y coordinate:');
		const source = prompt('Enter source name (e.g., poi, building):');

		if (!x || !y || !source) return;

		try {
			status = `Testing tile ${source} ${z}/${x}/${y}...`;
			const tileData = await worker.requestTile(
				source,
				parseInt(z.toString()),
				parseInt(x),
				parseInt(y)
			);

			if (tileData) {
				status = `✅ Found tile: ${tileData.byteLength} bytes`;
				console.log('Tile data:', tileData);
			} else {
				status = `❌ No tile found for ${source} ${z}/${x}/${y}`;
			}
		} catch (error) {
			status = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
	}
</script>

<div class="tile-merge-test">
	<h3>Tile Merging Test</h3>

	<div class="status">
		<strong>Status:</strong>
		{status}
	</div>

	<div class="database-info">
		<h4>Available Databases ({databases.length})</h4>
		{#each databases as db}
			<div class="database-item">
				<strong>{db.filename}</strong>
				{#if db.metadata.name}
					- {db.metadata.name}
				{/if}
				{#if db.metadata.bounds}
					<small>Bounds: [{db.metadata.bounds.join(', ')}]</small>
				{/if}
				{#if db.metadata.minzoom !== undefined && db.metadata.maxzoom !== undefined}
					<small>Zoom: {db.metadata.minzoom}-{db.metadata.maxzoom}</small>
				{/if}
			</div>
		{/each}
	</div>

	<div class="test-controls">
		<button onclick={testTileMerging} disabled={databases.length === 0}>
			Test Automatic Tile Merging
		</button>
		<button onclick={testSpecificTile} disabled={databases.length === 0}>
			Test Specific Tile
		</button>
	</div>

	{#if testResults.length > 0}
		<div class="test-results">
			<h4>Test Results</h4>
			<table>
				<thead>
					<tr>
						<th>Source</th>
						<th>Coordinates</th>
						<th>Size (bytes)</th>
						<th>Potentially Merged</th>
					</tr>
				</thead>
				<tbody>
					{#each testResults as result}
						<tr class:merged={result.merged}>
							<td>{result.source}</td>
							<td>{result.z}/{result.x}/{result.y}</td>
							<td>{result.size.toLocaleString()}</td>
							<td>{result.merged ? '✅ Likely' : '➖ Single'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.tile-merge-test {
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		margin: 1rem 0;
		font-family: system-ui;
	}

	.status {
		background: #f5f5f5;
		padding: 0.5rem;
		border-radius: 4px;
		margin: 1rem 0;
	}

	.database-info {
		margin: 1rem 0;
	}

	.database-item {
		padding: 0.25rem 0;
		border-bottom: 1px solid #eee;
	}

	.database-item small {
		display: block;
		color: #666;
		margin-left: 1rem;
	}

	.test-controls {
		margin: 1rem 0;
	}

	.test-controls button {
		margin-right: 1rem;
		padding: 0.5rem 1rem;
		background: #007acc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.test-controls button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.test-controls button:hover:not(:disabled) {
		background: #005c99;
	}

	.test-results {
		margin: 1rem 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5rem 0;
	}

	th,
	td {
		border: 1px solid #ddd;
		padding: 0.5rem;
		text-align: left;
	}

	th {
		background: #f5f5f5;
		font-weight: bold;
	}

	tr.merged {
		background: #e8f5e8;
	}
</style>
