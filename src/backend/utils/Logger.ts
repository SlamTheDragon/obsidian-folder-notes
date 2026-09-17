import type { App, TFile } from 'obsidian';
import type FolderNotesPlugin from '../../main';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'TRACE';

export type LogCategory =
	| 'USER_INTERACTION'
	| 'USER_FINDING'
	| 'METHOD_EXEC'
	| 'VAULT_SYNC'
	| 'RESOLVER'
	| 'DOM_STYLE'
	| 'OVERVIEW'
	| 'TELEMETRY'
	| 'TEST_HOOK';

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	category: LogCategory;
	method?: string;
	message: string;
	payload?: unknown;
	stack?: string;
}

export interface TelemetrySummary {
	totalInteractions: number;
	totalSyncOperations: number;
	totalResolutions: number;
	totalErrors: number;
	lastError?: { message: string; timestamp: string };
	anomaliesDetected: string[];
}

export class Logger {
	private static instance: Logger | null = null;
	private plugin: FolderNotesPlugin | null = null;
	private logBuffer: string[] = [];
	private isFlushing = false;
	private recentInteractions: LogEntry[] = [];
	private maxBufferSize = 50;
	private maxRecentInteractions = 20;
	private static readonly LOG_FILE_PATH = '.obsidian/plugins/folder-notes/debug.log';
	private static readonly MAX_LOG_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

	// Telemetry counters
	public telemetry: TelemetrySummary = {
		totalInteractions: 0,
		totalSyncOperations: 0,
		totalResolutions: 0,
		totalErrors: 0,
		anomaliesDetected: [],
	};

	private constructor() {}

	public static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	public initialize(plugin: FolderNotesPlugin): void {
		this.plugin = plugin;
		this.log('INFO', 'TELEMETRY', 'Logger initialized', {
			storageLocation: plugin.settings?.storageLocation,
			folderNoteName: plugin.settings?.folderNoteName,
			syncFolderName: plugin.settings?.syncFolderName,
			hideFolderNote: plugin.settings?.hideFolderNote,
		});
		void this.flush();
	}

	public getPlugin(): FolderNotesPlugin | null {
		return this.plugin;
	}

	private isLoggingEnabled(): boolean {
		if (!this.plugin) return true;
		return (this.plugin.settings as any)?.enableVerboseLogging !== false;
	}

	public log(
		level: LogLevel,
		category: LogCategory,
		message: string,
		payload?: unknown,
		method?: string,
		error?: Error,
	): void {
		const timestamp = new Date().toISOString();
		const stack = error?.stack || (level === 'ERROR' || level === 'TRACE' ? new Error().stack : undefined);

		const entry: LogEntry = {
			timestamp,
			level,
			category,
			method,
			message,
			payload,
			stack,
		};

		// Track telemetry
		if (category === 'USER_INTERACTION') {
			this.telemetry.totalInteractions++;
			this.recentInteractions.push(entry);
			if (this.recentInteractions.length > this.maxRecentInteractions) {
				this.recentInteractions.shift();
			}
		} else if (category === 'VAULT_SYNC') {
			this.telemetry.totalSyncOperations++;
		} else if (category === 'RESOLVER') {
			this.telemetry.totalResolutions++;
		}

		if (level === 'ERROR') {
			this.telemetry.totalErrors++;
			this.telemetry.lastError = { message, timestamp };
		}

		// Also mirror to console for developer tools
		const formattedConsoleMsg = `[FolderNotes][${level}][${category}${method ? `:${method}` : ''}] ${message}`;
		if (level === 'ERROR') {
			console.error(formattedConsoleMsg, payload ?? '', stack ?? '');
		} else if (level === 'WARN') {
			console.warn(formattedConsoleMsg, payload ?? '');
		} else if (level === 'DEBUG' || level === 'TRACE') {
			console.debug(formattedConsoleMsg, payload ?? '');
		} else {
			console.log(formattedConsoleMsg, payload ?? '');
		}

		if (!this.isLoggingEnabled() && level !== 'ERROR' && category !== 'USER_FINDING') {
			return;
		}

		let serializedPayload = '';
		if (payload !== undefined) {
			try {
				serializedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
			} catch {
				serializedPayload = '[Circular/Unserializable Payload]';
			}
		}

		let formattedLine = `[${timestamp}] [${level.padEnd(5)}] [${category}${method ? `:${method}` : ''}] ${message}`;
		if (serializedPayload) {
			formattedLine += ` | Payload: ${serializedPayload}`;
		}
		if (stack) {
			formattedLine += `\nStack:\n${stack}`;
		}
		formattedLine += '\n';

		this.logBuffer.push(formattedLine);

		if (this.logBuffer.length >= this.maxBufferSize || level === 'ERROR' || category === 'USER_FINDING') {
			void this.flush();
		}
	}

	public logInteraction(name: string, payload?: unknown, method?: string): void {
		this.log('INFO', 'USER_INTERACTION', name, payload, method);
	}

	public logMethod(className: string, methodName: string, args?: unknown, result?: unknown): void {
		const method = `${className}.${methodName}`;
		this.log('DEBUG', 'METHOD_EXEC', `Executing ${method}`, { args, result }, method);
	}

	public logResolver(operation: string, input: unknown, output: unknown): void {
		this.log('DEBUG', 'RESOLVER', operation, { input, output }, operation);
	}

	public logDom(operation: string, targetPath: string, cssClass: string, applied: boolean): void {
		this.log('DEBUG', 'DOM_STYLE', operation, { targetPath, cssClass, applied }, operation);
	}

	public logError(context: string, error: unknown, method?: string): void {
		const err = error instanceof Error ? error : new Error(String(error));
		this.log('ERROR', 'METHOD_EXEC', `Error in ${context}: ${err.message}`, { error: String(error) }, method, err);
	}

	public logFinding(userNotes: string, contextSnapshot?: Record<string, unknown>): void {
		const findingData = {
			userNotes,
			contextSnapshot,
			recentInteractions: this.recentInteractions.slice(-5),
			telemetrySnapshot: { ...this.telemetry },
		};
		this.log('INFO', 'USER_FINDING', `*** USER OBSERVATION RECORDED ***: ${userNotes}`, findingData, 'UserFinding');
		void this.flush();
	}

	public logTelemetry(summary: string, data?: unknown): void {
		this.log('INFO', 'TELEMETRY', summary, data, 'TelemetryScan');
	}

	public async flush(): Promise<void> {
		if (this.isFlushing || this.logBuffer.length === 0 || !this.plugin) {
			return;
		}

		this.isFlushing = true;
		const linesToWrite = this.logBuffer.join('');
		this.logBuffer = [];

		try {
			const { adapter } = this.plugin.app.vault;
			const logPath = Logger.LOG_FILE_PATH;

			const exists = await adapter.exists(logPath);
			if (exists) {
				const stat = await adapter.stat(logPath);
				if (stat && stat.size > Logger.MAX_LOG_FILE_BYTES) {
					// Rotate / truncate by keeping the header and the latest entries
					await adapter.write(logPath, `--- Log Rotated at ${new Date().toISOString()} ---\n` + linesToWrite);
					this.isFlushing = false;
					return;
				}
				await adapter.append(logPath, linesToWrite);
			} else {
				const header = `=== Folder Notes Diagnostic Log Initialized at ${new Date().toISOString()} ===\n`;
				await adapter.write(logPath, header + linesToWrite);
			}
		} catch (err) {
			// Fallback: keep unwritten lines in buffer
			console.error('[FolderNotes][Logger] Failed to write to debug.log:', err);
		} finally {
			this.isFlushing = false;
		}
	}

	public async getLogContent(): Promise<string> {
		if (!this.plugin) return this.logBuffer.join('');
		await this.flush();
		try {
			const { adapter } = this.plugin.app.vault;
			if (await adapter.exists(Logger.LOG_FILE_PATH)) {
				return await adapter.read(Logger.LOG_FILE_PATH);
			}
		} catch (err) {
			console.error('[FolderNotes][Logger] Failed to read debug.log:', err);
		}
		return this.logBuffer.join('');
	}

	public async clearLog(): Promise<void> {
		this.logBuffer = [];
		this.recentInteractions = [];
		if (!this.plugin) return;
		try {
			const { adapter } = this.plugin.app.vault;
			if (await adapter.exists(Logger.LOG_FILE_PATH)) {
				await adapter.write(Logger.LOG_FILE_PATH, `=== Folder Notes Debug Log Cleared at ${new Date().toISOString()} ===\n`);
			}
		} catch (err) {
			console.error('[FolderNotes][Logger] Failed to clear debug.log:', err);
		}
	}
}
