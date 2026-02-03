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
			console.log('🔄 Testing worker from console...');
			const worker = getWorker();
			
			if (!worker.ready) {
				console.log('⏳ Waiting for worker to be ready...');
				await worker.waitForReady();
			}
			
			console.log('✅ Worker is ready!');
			
			// Test ping
			const pingResponse = await worker.ping();
			console.log(`✅ Ping: ${pingResponse}`);
			
			// Test task
			const taskResponse = await worker.processTask('Console test task');
			console.log(`✅ Task: ${taskResponse}`);
			
			console.log('🎉 All worker tests passed!');
			
		} catch (error) {
			console.error('❌ Worker test failed:', error);
		}
	};
	
	// Status function
	window.workerStatus = () => {
		const worker = getWorker();
		console.log('Worker Status:', {
			ready: worker.ready,
			instance: !!worker
		});
	};
	
	console.log('🔧 Worker test utilities available:');
	console.log('  - testWorker() - Run complete worker test');
	console.log('  - workerStatus() - Check worker status');
}