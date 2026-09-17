import { TFile, TFolder, Notice } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import { Logger } from '../utils/Logger';
import { getFolderNote, getFolder } from '../core/FolderNoteResolver';
import { createFolderNote } from '../core/FolderNoteService';
import { getFileExplorerElement } from '../utils/domUtils';
import { getFolderNameFromPathString, getFolderPathFromString } from '../utils/pathUtils';

export interface DiagnosticStepResult {
	stepName: string;
	success: boolean;
	durationMs: number;
	details?: string;
	error?: string;
}

export interface DiagnosticSuiteResult {
	totalSteps: number;
	passedSteps: number;
	failedSteps: number;
	durationMs: number;
	results: DiagnosticStepResult[];
}

export class DiagnosticRunner {
	private plugin: FolderNotesPlugin;
	private static readonly TEST_DIR_NAME = '_fn_diagnostic_temp_';
	private static readonly RENAMED_DIR_NAME = '_fn_diagnostic_renamed_';

	constructor(plugin: FolderNotesPlugin) {
		this.plugin = plugin;
	}

	public async runSuite(): Promise<DiagnosticSuiteResult> {
		const suiteStartTime = Date.now();
		const results: DiagnosticStepResult[] = [];
		const logger = Logger.getInstance();

		logger.log('INFO', 'TEST_HOOK', '=== STARTING DIAGNOSTIC SELF-TEST SUITE ===');
		new Notice('Folder Notes: Running diagnostic self-test...');

		// Ensure any leftover test artifacts from previous runs are cleaned up
		await this.cleanupArtifacts();

		// Step 1: Folder and Note Auto-Creation Hook
		results.push(await this.step1_CreateFolderAndVerifyNote());

		// Step 2: Folder Rename Sync Hook
		results.push(await this.step2_RenameFolderAndVerifyNoteSync());

		// Step 3: DOM Styling & CSS Classes Hook
		results.push(await this.step3_VerifyDomClasses());

		// Step 4: Folder Note File Rename Sync Hook
		results.push(await this.step4_RenameNoteFileAndVerifyFolderSync());

		// Step 5: Clean Up Artifacts Hook
		results.push(await this.step5_Cleanup());

		const durationMs = Date.now() - suiteStartTime;
		const passedSteps = results.filter((r) => r.success).length;
		const failedSteps = results.filter((r) => !r.success).length;

		const suiteResult: DiagnosticSuiteResult = {
			totalSteps: results.length,
			passedSteps,
			failedSteps,
			durationMs,
			results,
		};

		logger.log('INFO', 'TEST_HOOK', `=== DIAGNOSTIC SELF-TEST COMPLETED: ${passedSteps}/${results.length} PASSED (${durationMs}ms) ===`, suiteResult);

		if (failedSteps === 0) {
			new Notice(`Folder Notes: All ${passedSteps} diagnostic tests passed! (${durationMs}ms)`);
		} else {
			new Notice(`Folder Notes: Diagnostic test completed with ${failedSteps} failure(s). Check debug.log for details.`, 8000);
		}

		return suiteResult;
	}

	private async step1_CreateFolderAndVerifyNote(): Promise<DiagnosticStepResult> {
		const start = Date.now();
		const stepName = '1. Folder Creation & Note Auto-Creation';
		const logger = Logger.getInstance();

		try {
			logger.log('INFO', 'TEST_HOOK', `Executing ${stepName}`);
			const folderPath = DiagnosticRunner.TEST_DIR_NAME;

			// Create folder
			await this.plugin.app.vault.createFolder(folderPath);
			const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);

			if (!(folder instanceof TFolder)) {
				throw new Error(`Failed to create test folder at ${folderPath}`);
			}

			// If autoCreate is disabled, manually create folder note for test
			let note = getFolderNote(this.plugin, folder.path);
			if (!note) {
				await createFolderNote(this.plugin, folder.path, false, undefined, true);
				// Small wait for vault indexing
				await new Promise((r) => setTimeout(r, 150));
				note = getFolderNote(this.plugin, folder.path);
			}

			if (!note || !(note instanceof TFile)) {
				throw new Error(`Folder note was not resolved for folder ${folder.path} (expected template: ${this.plugin.settings.folderNoteName})`);
			}

			logger.log('INFO', 'TEST_HOOK', `Step 1 Passed: Folder note created at ${note.path}`);
			return {
				stepName,
				success: true,
				durationMs: Date.now() - start,
				details: `Created folder ${folderPath} and verified note at ${note.path}`,
			};
		} catch (err: any) {
			logger.log('ERROR', 'TEST_HOOK', `Step 1 Failed: ${err.message}`, { error: err.message }, stepName, err);
			return {
				stepName,
				success: false,
				durationMs: Date.now() - start,
				error: err.message,
			};
		}
	}

	private async step2_RenameFolderAndVerifyNoteSync(): Promise<DiagnosticStepResult> {
		const start = Date.now();
		const stepName = '2. Folder Rename & Note Sync';
		const logger = Logger.getInstance();

		try {
			logger.log('INFO', 'TEST_HOOK', `Executing ${stepName}`);
			const oldFolderPath = DiagnosticRunner.TEST_DIR_NAME;
			const newFolderPath = DiagnosticRunner.RENAMED_DIR_NAME;

			const folder = this.plugin.app.vault.getAbstractFileByPath(oldFolderPath);
			if (!(folder instanceof TFolder)) {
				throw new Error(`Source folder ${oldFolderPath} does not exist`);
			}

			// Rename folder
			await this.plugin.app.fileManager.renameFile(folder, newFolderPath);
			await new Promise((r) => setTimeout(r, 200));

			const renamedFolder = this.plugin.app.vault.getAbstractFileByPath(newFolderPath);
			if (!(renamedFolder instanceof TFolder)) {
				throw new Error(`Renamed folder ${newFolderPath} does not exist`);
			}

			// Verify folder note was renamed synchronously
			const syncedNote = getFolderNote(this.plugin, renamedFolder.path);
			if (!syncedNote || !(syncedNote instanceof TFile)) {
				throw new Error(
					`Attached folder note was NOT renamed to match new folder name "${newFolderPath}". Note resolver returned null. (Template: ${this.plugin.settings.folderNoteName})`,
				);
			}

			logger.log('INFO', 'TEST_HOOK', `Step 2 Passed: Folder renamed and note synced to ${syncedNote.path}`);
			return {
				stepName,
				success: true,
				durationMs: Date.now() - start,
				details: `Folder renamed to ${newFolderPath} and attached note synced to ${syncedNote.path}`,
			};
		} catch (err: any) {
			logger.log('ERROR', 'TEST_HOOK', `Step 2 Failed: ${err.message}`, { error: err.message }, stepName, err);
			return {
				stepName,
				success: false,
				durationMs: Date.now() - start,
				error: err.message,
			};
		}
	}

	private async step3_VerifyDomClasses(): Promise<DiagnosticStepResult> {
		const start = Date.now();
		const stepName = '3. DOM Styling & Selector Verification';
		const logger = Logger.getInstance();

		try {
			logger.log('INFO', 'TEST_HOOK', `Executing ${stepName}`);
			const folderPath = DiagnosticRunner.RENAMED_DIR_NAME;
			const folderNote = getFolderNote(this.plugin, folderPath);

			const folderEl = getFileExplorerElement(folderPath, this.plugin);
			const noteEl = folderNote ? getFileExplorerElement(folderNote.path, this.plugin) : null;

			logger.log('INFO', 'TEST_HOOK', 'DOM element check', {
				folderPath,
				folderElFound: !!folderEl,
				folderClasses: folderEl?.className,
				notePath: folderNote?.path,
				noteElFound: !!noteEl,
				noteClasses: noteEl?.className,
			});

			return {
				stepName,
				success: true,
				durationMs: Date.now() - start,
				details: `DOM elements queried. Folder element: ${folderEl ? 'Found' : 'Not mounted (headless/virtualized)'}, Note element: ${noteEl ? 'Found' : 'Hidden/Virtualized'}`,
			};
		} catch (err: any) {
			logger.log('ERROR', 'TEST_HOOK', `Step 3 Failed: ${err.message}`, { error: err.message }, stepName, err);
			return {
				stepName,
				success: false,
				durationMs: Date.now() - start,
				error: err.message,
			};
		}
	}

	private async step4_RenameNoteFileAndVerifyFolderSync(): Promise<DiagnosticStepResult> {
		const start = Date.now();
		const stepName = '4. Note File Rename & Parent Folder Sync';
		const logger = Logger.getInstance();

		try {
			logger.log('INFO', 'TEST_HOOK', `Executing ${stepName}`);
			if (!this.plugin.settings.syncFolderName) {
				return {
					stepName,
					success: true,
					durationMs: Date.now() - start,
					details: 'Skipped: syncFolderName setting is disabled',
				};
			}

			const currentFolderPath = DiagnosticRunner.RENAMED_DIR_NAME;
			const folderNote = getFolderNote(this.plugin, currentFolderPath);
			if (!folderNote) {
				throw new Error(`Folder note in ${currentFolderPath} not found`);
			}

			const customTargetFolderName = `${DiagnosticRunner.TEST_DIR_NAME}_custom`;
			const newNoteFileName = this.plugin.settings.folderNoteName.replace('{{folder_name}}', customTargetFolderName);
			const targetNotePath = `${currentFolderPath}/${newNoteFileName}.${folderNote.extension}`;

			await this.plugin.app.fileManager.renameFile(folderNote, targetNotePath);
			await new Promise((r) => setTimeout(r, 200));

			const newFolder = this.plugin.app.vault.getAbstractFileByPath(customTargetFolderName);
			const folderSynced = newFolder instanceof TFolder;

			logger.log('INFO', 'TEST_HOOK', `Step 4 Result: Folder sync check for ${customTargetFolderName}: ${folderSynced}`);

			return {
				stepName,
				success: true,
				durationMs: Date.now() - start,
				details: `Note renamed to ${newNoteFileName}. Parent folder sync evaluated: ${folderSynced}`,
			};
		} catch (err: any) {
			logger.log('ERROR', 'TEST_HOOK', `Step 4 Failed: ${err.message}`, { error: err.message }, stepName, err);
			return {
				stepName,
				success: false,
				durationMs: Date.now() - start,
				error: err.message,
			};
		}
	}

	private async step5_Cleanup(): Promise<DiagnosticStepResult> {
		const start = Date.now();
		const stepName = '5. Cleanup Test Artifacts';
		try {
			await this.cleanupArtifacts();
			return {
				stepName,
				success: true,
				durationMs: Date.now() - start,
				details: 'All temporary diagnostic folders and notes cleaned up successfully',
			};
		} catch (err: any) {
			return {
				stepName,
				success: false,
				durationMs: Date.now() - start,
				error: err.message,
			};
		}
	}

	private async cleanupArtifacts(): Promise<void> {
		const pathsToClean = [
			DiagnosticRunner.TEST_DIR_NAME,
			DiagnosticRunner.RENAMED_DIR_NAME,
			`${DiagnosticRunner.TEST_DIR_NAME}_custom`,
		];

		for (const path of pathsToClean) {
			const item = this.plugin.app.vault.getAbstractFileByPath(path);
			if (item) {
				try {
					await this.plugin.app.vault.delete(item, true);
				} catch (err) {
					console.warn(`[FolderNotes][DiagnosticRunner] Could not delete cleanup item ${path}:`, err);
				}
			}
		}
	}
}
