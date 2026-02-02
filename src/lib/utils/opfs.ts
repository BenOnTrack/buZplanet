/**
 * Utility functions for working with Origin Private File System (OPFS)
 */

export class OPFSManager {
	private static instance: OPFSManager;
	private root: FileSystemDirectoryHandle | null = null;

	private constructor() {}

	public static getInstance(): OPFSManager {
		if (!OPFSManager.instance) {
			OPFSManager.instance = new OPFSManager();
		}
		return OPFSManager.instance;
	}

	/**
	 * Initialize OPFS and get root directory handle
	 */
	public async initialize(): Promise<void> {
		if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
			throw new Error('OPFS is not supported in this browser');
		}

		try {
			this.root = await navigator.storage.getDirectory();
		} catch (error) {
			throw new Error(`Failed to initialize OPFS: ${error}`);
		}
	}

	/**
	 * Save a file to OPFS
	 * @param file - The File object to save
	 * @param directory - Optional subdirectory (default: 'tiles')
	 * @returns Promise<string> - The file path where it was saved
	 */
	public async saveFile(file: File, directory: string = 'tiles'): Promise<string> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			// Create or get the directory
			const dirHandle = await this.root!.getDirectoryHandle(directory, { create: true });
			
			// Generate unique filename if file already exists
			let filename = file.name;
			let counter = 1;
			
			while (await this.fileExists(dirHandle, filename)) {
				const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
				const ext = file.name.match(/\.[^/.]+$/)?.[0] || '';
				filename = `${nameWithoutExt}_${counter}${ext}`;
				counter++;
			}

			// Create file handle
			const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
			
			// Create writable stream and write file
			const writable = await fileHandle.createWritable();
			await writable.write(file);
			await writable.close();

			return `${directory}/${filename}`;
		} catch (error) {
			throw new Error(`Failed to save file: ${error}`);
		}
	}

	/**
	 * Check if a file exists in the given directory
	 */
	private async fileExists(dirHandle: FileSystemDirectoryHandle, filename: string): Promise<boolean> {
		try {
			await dirHandle.getFileHandle(filename);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * List files in a directory
	 * @param directory - Directory name (default: 'tiles')
	 * @returns Promise<string[]> - Array of filenames
	 */
	public async listFiles(directory: string = 'tiles'): Promise<string[]> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			const dirHandle = await this.root!.getDirectoryHandle(directory);
			const files: string[] = [];
			
			for await (const [name, handle] of dirHandle.entries()) {
				if (handle.kind === 'file') {
					files.push(name);
				}
			}
			
			return files;
		} catch (error) {
			// Directory doesn't exist or other error
			return [];
		}
	}

	/**
	 * Get a file from OPFS
	 * @param filepath - Full path to the file (e.g., 'tiles/myfile.txt')
	 * @returns Promise<File | null> - The File object or null if not found
	 */
	public async getFile(filepath: string): Promise<File | null> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			const pathParts = filepath.split('/');
			const filename = pathParts.pop()!;
			const directory = pathParts.join('/') || 'tiles';

			const dirHandle = await this.root!.getDirectoryHandle(directory);
			const fileHandle = await dirHandle.getFileHandle(filename);
			
			return await fileHandle.getFile();
		} catch (error) {
			return null;
		}
	}

	/**
	 * Delete a file from OPFS
	 * @param filepath - Full path to the file (e.g., 'tiles/myfile.txt')
	 * @returns Promise<boolean> - True if deleted successfully
	 */
	public async deleteFile(filepath: string): Promise<boolean> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			const pathParts = filepath.split('/');
			const filename = pathParts.pop()!;
			const directory = pathParts.join('/') || 'tiles';

			const dirHandle = await this.root!.getDirectoryHandle(directory);
			await dirHandle.removeEntry(filename);
			
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get the total storage usage
	 * @returns Promise<{ used: number, quota: number }> - Storage info in bytes
	 */
	public async getStorageInfo(): Promise<{ used: number; quota: number }> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage || 0,
				quota: estimate.quota || 0
			};
		}
		return { used: 0, quota: 0 };
	}
}

/**
 * Convenience function to get OPFS manager instance
 */
export const opfsManager = OPFSManager.getInstance();