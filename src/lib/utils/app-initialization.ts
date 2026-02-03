/**
 * App initialization utility to ensure proper setup order
 */

import { getWorker } from '$lib/utils/worker';
import { createProtocolHandler } from '$lib/utils/map/protocol-handler';
import maplibregl from 'maplibre-gl';

export type InitializationStatus = 
  | 'pending' 
  | 'initializing' 
  | 'worker-ready' 
  | 'protocol-ready' 
  | 'complete' 
  | 'error';

export interface InitializationState {
  status: InitializationStatus;
  error?: string;
  logs: string[];
}

export interface InitializationResult {
  success: boolean;
  error?: string;
  workerInfo?: any;
}

class AppInitializer {
  private initializationPromise: Promise<InitializationResult> | null = null;
  private state: InitializationState = {
    status: 'pending',
    logs: []
  };
  
  private listeners: Array<(state: InitializationState) => void> = [];

  /**
   * Subscribe to initialization state changes
   */
  subscribe(callback: (state: InitializationState) => void): () => void {
    this.listeners.push(callback);
    // Immediately call with current state
    callback(this.state);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<InitializationState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(callback => callback(this.state));
  }

  /**
   * Add log entry
   */
  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    this.updateState({
      logs: [...this.state.logs, logEntry]
    });
    
    // Log to state only
  }

  /**
   * Initialize the app (worker + protocol handlers)
   * Returns a promise that resolves when everything is ready
   */
  async initialize(): Promise<InitializationResult> {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<InitializationResult> {
    try {
      this.updateState({ status: 'initializing' });
      this.addLog('🚀 Starting app initialization...');

      // Step 1: Initialize Worker
      this.addLog('🔄 Initializing worker...');
      const worker = getWorker();
      this.addLog('✅ Worker instance created');

      await worker.waitForReady();
      this.addLog('✅ Worker is ready!');
      this.updateState({ status: 'worker-ready' });

      // Step 2: Initialize worker with app data
      const initResponse = await worker.initializeWorker({ 
        appVersion: '1.0.0',
        timestamp: Date.now()
      });

      let workerInfo;
      if (typeof initResponse === 'string') {
        this.addLog(`✅ Init response: ${initResponse}`);
        workerInfo = { message: initResponse };
      } else {
        this.addLog(`✅ Init response: ${initResponse.message}`);
        this.addLog(`📂 OPFS .mbtiles files found: ${initResponse.opfsFiles.length}`);
        workerInfo = initResponse;
        
        if (initResponse.opfsFiles.length > 0) {
          initResponse.opfsFiles.forEach((file: string) => {
            this.addLog(`  📄 ${file}`);
          });
        } else {
          this.addLog('  📄 No .mbtiles files found in OPFS');
        }
      }

      // Step 3: Scan and index databases
      try {
        this.addLog('🔄 Scanning and indexing databases...');
        const scanResult = await worker.sendMessage('scan-databases');
        this.addLog(`✅ Database scan complete: ${scanResult.successfulDbs}/${scanResult.totalFiles} databases loaded`);
        if (scanResult.corruptedFiles.length > 0) {
          this.addLog(`⚠️ Corrupted files removed: ${scanResult.corruptedFiles.join(', ')}`);
        }
      } catch (scanError) {
        this.addLog(`⚠️ Database scan failed: ${scanError instanceof Error ? scanError.message : 'Unknown error'}`);
      }

      // Step 4: Register Protocol Handlers
      this.addLog('🔄 Registering MBTiles protocol handler...');
      const protocolHandler = createProtocolHandler(worker);
      maplibregl.addProtocol('mbtiles', protocolHandler);
      this.addLog('✅ MBTiles protocol handler registered!');
      this.updateState({ status: 'protocol-ready' });

      // Step 5: Final verification
      const pingResponse = await worker.ping();
      this.addLog(`✅ Ping response: ${pingResponse}`);

      const taskResponse = await worker.processTask('Hello from main thread!');
      this.addLog(`✅ Task response: ${taskResponse}`);

      // Step 6: Complete
      this.updateState({ status: 'complete' });
      this.addLog('🎉 App initialization complete!');

      return {
        success: true,
        workerInfo
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.addLog(`❌ Initialization failed: ${errorMsg}`);
      
      this.updateState({ 
        status: 'error',
        error: errorMsg
      });

      console.error('App initialization failed:', error);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get current initialization status
   */
  getStatus(): InitializationStatus {
    return this.state.status;
  }

  /**
   * Check if app is ready for map initialization
   */
  isReady(): boolean {
    return this.state.status === 'complete';
  }

  /**
   * Reset initialization state (useful for testing)
   */
  reset() {
    this.initializationPromise = null;
    this.state = {
      status: 'pending',
      logs: []
    };
  }
}

// Export singleton instance
export const appInitializer = new AppInitializer();