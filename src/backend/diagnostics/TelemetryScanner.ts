import { TFile, TFolder, Notice } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import { Logger } from '../utils/Logger';
import { getFolderNote, extractFolderName, getFolder } from '../core/FolderNoteResolver';
import { getFileExplorerElement } from '../utils/domUtils';

export interface TelemetryAuditReport {
	scannedFolders: number;
	totalFolderNotesFound: number;
	orphanedNotes: string[];
	desyncedNotes: string[];
	missingFolderNotes: string[];
	stylingAnomalies: string[];
	actionableSuggestions: string[];
}

export class TelemetryScanner {
	private plugin: FolderNotesPlugin;

	constructor(plugin: FolderNotesPlugin) {
		this.plugin = plugin;
	}

	public async scanVaultHealth(): Promise<TelemetryAuditReport> {
		const logger = Logger.getInstance();
		logger.log('INFO', 'TELEMETRY', 'Starting live vault health and telemetry scan...');
		new Notice('Folder Notes: Scanning vault health and telemetry...');

		const report: TelemetryAuditReport = {
			scannedFolders: 0,
			totalFolderNotesFound: 0,
			orphanedNotes: [],
			desyncedNotes: [],
			missingFolderNotes: [],
			stylingAnomalies: [],
			actionableSuggestions: [],
		};

		const allFiles = this.plugin.app.vault.getAllLoadedFiles();
		const folders = allFiles.filter((f): f is TFolder => f instanceof TFolder && !f.isRoot());
		const files = allFiles.filter((f): f is TFile => f instanceof TFile);

		report.scannedFolders = folders.length;

		// 1. Audit Folders for Attached Notes & DOM styling
		for (const folder of folders) {
			const folderNote = getFolderNote(this.plugin, folder.path);

			if (folderNote) {
				report.totalFolderNotesFound++;

				// Check DOM styling class consistency
				const el = getFileExplorerElement(folder.path, this.plugin);
				if (el && !el.classList.contains('has-folder-note')) {
					report.stylingAnomalies.push(`Folder "${folder.path}" has a folder note (${folderNote.name}) but DOM lacks .has-folder-note class.`);
				}
			} else if (this.plugin.settings.autoCreate) {
				report.missingFolderNotes.push(folder.path);
			}
		}

		// 2. Audit Files for Potential Desynchronized / Orphaned Folder Notes
		const template = this.plugin.settings.folderNoteName;
		for (const file of files) {
			const parentFolder = file.parent;
			if (!parentFolder || parentFolder.isRoot()) continue;

			// If the file matches the template pattern but doesn't match the current parent folder name
			if (template.includes('{{folder_name}}')) {
				const extractedName = extractFolderName(template, file.basename);
				if (extractedName && extractedName !== parentFolder.name) {
					// Check if this file is actually attached to another folder or orphaned
					const attachedFolder = getFolder(this.plugin, file);
					if (!attachedFolder) {
						report.desyncedNotes.push(
							`File "${file.path}" appears to be a folder note for folder "${extractedName}", but resides in "${parentFolder.path}".`,
						);
					}
				}
			}
		}

		// 3. Formulate Actionable Suggestions
		if (report.desyncedNotes.length > 0) {
			report.actionableSuggestions.push(
				`Detected ${report.desyncedNotes.length} desynchronized folder note(s). Use command "Folder Notes: Rename folder notes" or rename their parent folders to resynchronize.`,
			);
		}

		if (report.missingFolderNotes.length > 0 && this.plugin.settings.autoCreate) {
			report.actionableSuggestions.push(
				`Found ${report.missingFolderNotes.length} folder(s) without notes while Auto-Create is ON. Use command "Folder Notes: Create folder note for every folder" if you wish to generate them.`,
			);
		}

		if (report.stylingAnomalies.length > 0) {
			report.actionableSuggestions.push(
				`Detected ${report.stylingAnomalies.length} DOM styling discrepancy. Refreshing folder explorer styles automatically.`,
			);
		}

		if (report.actionableSuggestions.length === 0) {
			report.actionableSuggestions.push('Vault state is healthy and fully synchronized with current Folder Notes configuration.');
		}

		logger.logTelemetry('Vault Health & Telemetry Scan Complete', report);

		const summaryNotice = `Folder Notes Health Scan: ${folders.length} folders scanned, ${report.totalFolderNotesFound} notes active, ${report.desyncedNotes.length} desynced.`;
		new Notice(summaryNotice, 6000);

		return report;
	}
}
