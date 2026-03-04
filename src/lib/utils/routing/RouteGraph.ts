/**
 * Graph data structures for road network routing - Implementation classes
 * Interfaces are defined globally in app.d.ts
 */

/**
 * Simple spatial index implementation using grid-based approach
 * For production, consider using a proper R-tree or similar
 */
export class GridSpatialIndex implements SpatialIndex {
	private grid: Map<string, Set<string>> = new Map();
	private nodeCoordinates: Map<string, [number, number]> = new Map();
	private gridSize: number;

	constructor(gridSize: number = 0.001) {
		// ~100m grid cells
		this.gridSize = gridSize;
	}

	insert(nodeId: string, coordinates: [number, number]): void {
		const gridKey = this.getGridKey(coordinates);

		if (!this.grid.has(gridKey)) {
			this.grid.set(gridKey, new Set());
		}

		this.grid.get(gridKey)!.add(nodeId);
		this.nodeCoordinates.set(nodeId, coordinates);
	}

	findNearest(coordinates: [number, number], maxDistance: number = 1000): string | null {
		const searchRadius = Math.ceil(maxDistance / 111000 / this.gridSize); // Convert meters to grid cells
		let nearestNodeId: string | null = null;
		let nearestDistance = Infinity;

		const centerGrid = this.getGridCoordinates(coordinates);

		// Search in expanding square pattern
		for (let radius = 0; radius <= searchRadius; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					// Only check the perimeter of the current radius
					if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
						continue;
					}

					const gridKey = `${centerGrid.x + dx},${centerGrid.y + dy}`;
					const nodesInCell = this.grid.get(gridKey);

					if (nodesInCell) {
						for (const nodeId of nodesInCell) {
							const nodeCoords = this.nodeCoordinates.get(nodeId);
							if (nodeCoords) {
								const distance = this.calculateDistance(coordinates, nodeCoords);
								if (distance < nearestDistance && distance <= maxDistance) {
									nearestDistance = distance;
									nearestNodeId = nodeId;
								}
							}
						}
					}
				}
			}

			// If we found a node at this radius, we can stop searching
			if (nearestNodeId !== null) {
				break;
			}
		}

		return nearestNodeId;
	}

	findWithinRadius(coordinates: [number, number], radius: number): string[] {
		const results: string[] = [];
		const searchRadius = Math.ceil(radius / 111000 / this.gridSize); // Convert meters to grid cells
		const centerGrid = this.getGridCoordinates(coordinates);

		for (let dx = -searchRadius; dx <= searchRadius; dx++) {
			for (let dy = -searchRadius; dy <= searchRadius; dy++) {
				const gridKey = `${centerGrid.x + dx},${centerGrid.y + dy}`;
				const nodesInCell = this.grid.get(gridKey);

				if (nodesInCell) {
					for (const nodeId of nodesInCell) {
						const nodeCoords = this.nodeCoordinates.get(nodeId);
						if (nodeCoords) {
							const distance = this.calculateDistance(coordinates, nodeCoords);
							if (distance <= radius) {
								results.push(nodeId);
							}
						}
					}
				}
			}
		}

		return results;
	}

	private getGridKey(coordinates: [number, number]): string {
		const grid = this.getGridCoordinates(coordinates);
		return `${grid.x},${grid.y}`;
	}

	private getGridCoordinates(coordinates: [number, number]): { x: number; y: number } {
		return {
			x: Math.floor(coordinates[0] / this.gridSize),
			y: Math.floor(coordinates[1] / this.gridSize)
		};
	}

	private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
		// Simple Euclidean distance in meters (approximate)
		const dx = (coord2[0] - coord1[0]) * 111000 * Math.cos((coord1[1] * Math.PI) / 180);
		const dy = (coord2[1] - coord1[1]) * 111000;
		return Math.sqrt(dx * dx + dy * dy);
	}
}
