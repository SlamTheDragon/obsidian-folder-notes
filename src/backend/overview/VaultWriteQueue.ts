import { type App, type TFile } from 'obsidian';

/**
 * VaultWriteQueue serializes vault file processing and writing operations per file or globally,
 * avoiding concurrent writes that cause CodeMirror buffer corruption and undo stack destruction.
 */
export class VaultWriteQueue {
	private static instance: VaultWriteQueue;
	private queue: Promise<unknown> = Promise.resolve();

	public static getInstance(): VaultWriteQueue {
		if (!VaultWriteQueue.instance) {
			VaultWriteQueue.instance = new VaultWriteQueue();
		}
		return VaultWriteQueue.instance;
	}

	/**
	 * Enqueue an asynchronous process operation on a vault file.
	 */
	public enqueueProcess(
		app: App,
		file: TFile,
		fn: (data: string) => string | Promise<string>,
	): Promise<string> {
		const task = this.queue.then(async () => {
			return await app.vault.process(file, fn);
		});

		this.queue = task.catch((err) => {
			console.error(`[VaultWriteQueue] Failed processing file ${file.path}:`, err);
		});

		return task;
	}

	/**
	 * Enqueue a generic async task to be executed sequentially.
	 */
	public enqueueTask<T>(taskFn: () => Promise<T>): Promise<T> {
		const task = this.queue.then(async () => {
			return await taskFn();
		});

		this.queue = task.catch((err) => {
			console.error('[VaultWriteQueue] Task execution error:', err);
		});

		return task;
	}
}

export const vaultWriteQueue = VaultWriteQueue.getInstance();
