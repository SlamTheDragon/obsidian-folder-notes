import { describe, it, expect } from 'bun:test';
import { DiagnosticRunner } from '../src/backend/diagnostics/DiagnosticRunner';
import { TelemetryScanner } from '../src/backend/diagnostics/TelemetryScanner';
import { TFile, TFolder } from 'obsidian';

describe('DiagnosticRunner & TelemetryScanner Test Suites', () => {
	it('instantiates DiagnosticRunner and TelemetryScanner', () => {
		const mockPlugin = {
			settings: {
				folderNoteName: '{{folder_name}} - Index',
				storageLocation: 'insideFolder',
				syncFolderName: true,
				hideFolderNote: true,
				autoCreate: false,
			},
			app: {
				vault: {
					getAllLoadedFiles: () => [],
					getAbstractFileByPath: () => null,
					createFolder: async () => {},
					delete: async () => {},
					adapter: {
						exists: async () => false,
						write: async () => {},
						append: async () => {},
					},
				},
				workspace: {
					getActiveFile: () => null,
				},
				fileManager: {
					renameFile: async () => {},
				},
			},
		} as any;

		const runner = new DiagnosticRunner(mockPlugin);
		const scanner = new TelemetryScanner(mockPlugin);

		expect(runner).toBeDefined();
		expect(scanner).toBeDefined();
	});

	it('runs TelemetryScanner health scan over loaded vault folders', async () => {
		const folderA = new TFolder();
		folderA.name = 'Alpha';
		folderA.path = 'Alpha';

		const noteA = new TFile();
		noteA.name = 'Alpha - Index.md';
		noteA.basename = 'Alpha - Index';
		noteA.path = 'Alpha/Alpha - Index.md';
		noteA.parent = folderA;

		const mockPlugin = {
			settings: {
				folderNoteName: '{{folder_name}} - Index',
				storageLocation: 'insideFolder',
				syncFolderName: true,
				hideFolderNote: true,
				autoCreate: false,
				folderNoteType: '.md',
				supportedFileTypes: ['md'],
			},
			app: {
				vault: {
					getAllLoadedFiles: () => [folderA, noteA],
					getAbstractFileByPath: (path: string) => {
						if (path === 'Alpha') return folderA;
						if (path === 'Alpha/Alpha - Index.md' || path === 'Alpha/Alpha - Index') return noteA;
						return null;
					},
					adapter: {
						exists: async () => false,
						write: async () => {},
						append: async () => {},
					},
				},
				workspace: {
					getActiveFile: () => null,
				},
			},
		} as any;

		const scanner = new TelemetryScanner(mockPlugin);
		const report = await scanner.scanVaultHealth();

		expect(report).toBeDefined();
		expect(report.scannedFolders).toBe(1);
		expect(report.totalFolderNotesFound).toBe(1);
		expect(report.desyncedNotes.length).toBe(0);
	});
});
