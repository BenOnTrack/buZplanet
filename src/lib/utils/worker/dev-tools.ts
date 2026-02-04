import { getWorker } from '$lib/utils/worker';

declare global {
	interface Window {
		testWorker: () => Promise<void>;
		workerStatus: () => void;
	}
}

// Browser console utilities for testing the worker
if (typeof window !== 'undefined' && import.meta.env.DEV) {
	// Test function accessible from browser console
	window.testWorker = async () => {
		try {
			// Testing worker from console...
			const worker = getWorker();

			if (!worker.ready) {
				// Waiting for worker to be ready...
				await worker.waitForReady();
			}

			// Worker is ready!

			// Test ping
			const pingResponse = await worker.ping();
			// Test ping

			// Test task
			const taskResponse = await worker.processTask('Console test task');
			// Test task

			// All worker tests passed!
		} catch (error) {
			console.error('❌ Worker test failed:', error);
		}
	};

	// Status function
	window.workerStatus = () => {
		const worker = getWorker();
		// Worker status
	};

	// Worker test utilities available
	// - testWorker() - Run complete worker test
	// - workerStatus() - Check worker status
}
