// Web Worker TypeScript implementation
// This worker runs in a separate thread and can communicate with the main thread

export interface WorkerMessage {
	type: string;
	data?: any;
	id?: string;
}

export interface WorkerResponse extends WorkerMessage {
	error?: boolean;
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
	const { type, data, id } = event.data;
	
	try {
		switch (type) {
			case 'ping':
				// Respond to ping with pong
				postMessage({
					type: 'pong',
					data: 'Worker is alive!',
					id
				} satisfies WorkerResponse);
				break;
				
			case 'init':
				// Handle initialization
				console.log('Worker initialized with data:', data);
				postMessage({
					type: 'initialized',
					data: 'Worker successfully initialized',
					id
				} satisfies WorkerResponse);
				break;
				
			case 'task':
				// Example task processing
				console.log('Processing task:', data);
				// Simulate some work
				const result = `Task completed: ${data}`;
				postMessage({
					type: 'task-completed',
					data: result,
					id
				} satisfies WorkerResponse);
				break;
				
			default:
				console.log('Unknown message type:', type);
				postMessage({
					type: 'error',
					data: `Unknown message type: ${type}`,
					id,
					error: true
				} satisfies WorkerResponse);
		}
	} catch (error) {
		// Send error back to main thread
		postMessage({
			type: 'error',
			data: error instanceof Error ? error.message : 'Unknown error',
			id,
			error: true
		} satisfies WorkerResponse);
	}
});

// Handle worker errors
self.addEventListener('error', (error) => {
	console.error('Worker error:', error);
	postMessage({
		type: 'worker-error',
		data: error.message,
		error: true
	} satisfies WorkerResponse);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
	console.error('Worker unhandled rejection:', event.reason);
	postMessage({
		type: 'worker-error',
		data: `Unhandled rejection: ${event.reason}`,
		error: true
	} satisfies WorkerResponse);
});

// Send ready message when worker starts
postMessage({
	type: 'ready',
	data: 'Worker is ready'
} satisfies WorkerResponse);