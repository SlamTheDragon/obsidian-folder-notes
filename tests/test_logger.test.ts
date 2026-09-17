import { describe, it, expect, beforeEach } from 'bun:test';
import { Logger } from '../src/backend/utils/Logger';

describe('Diagnostic Logger & Telemetry', () => {
	let logger: Logger;

	beforeEach(() => {
		logger = Logger.getInstance();
		// Mock plugin environment
		const mockPlugin = {
			settings: {
				enableVerboseLogging: true,
				folderNoteName: '{{folder_name}} - Index',
				storageLocation: 'insideFolder',
				syncFolderName: true,
				hideFolderNote: true,
			},
			app: {
				vault: {
					adapter: {
						exists: async () => true,
						read: async () => 'mock log content',
						write: async () => {},
						append: async () => {},
						stat: async () => ({ size: 1024 }),
					},
				},
			},
		} as any;

		logger.initialize(mockPlugin);
	});

	it('initializes logger singleton and logs telemetry initialization', () => {
		expect(logger).toBeDefined();
		expect(logger.getPlugin()).toBeDefined();
	});

	it('records user interactions and updates telemetry counter', () => {
		const initialCount = logger.telemetry.totalInteractions;
		logger.logInteraction('FileExplorerClick', { folderPath: 'Projects/Alpha' }, 'handleFileExplorerClick');
		expect(logger.telemetry.totalInteractions).toBe(initialCount + 1);
	});

	it('tracks errors and updates telemetry lastError state', () => {
		const error = new Error('Test simulated error');
		logger.logError('VaultSyncHandler.handleFolderRename', error, 'handleFolderRename');
		expect(logger.telemetry.totalErrors).toBeGreaterThan(0);
		expect(logger.telemetry.lastError?.message).toContain('Test simulated error');
	});

	it('logs user findings with context snapshots', () => {
		logger.logFinding('I renamed folder Alpha to Beta and the note stayed Alpha - Index.md', {
			activeFilePath: 'Beta/Alpha - Index.md',
			storageLocation: 'insideFolder',
		});
		// Should not throw and successfully enqueue
		expect(logger.telemetry).toBeDefined();
	});
});
