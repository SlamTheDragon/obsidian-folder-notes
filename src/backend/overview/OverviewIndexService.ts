import {
	debounce,
	TFile,
	TFolder,
	type TAbstractFile,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import {
	getOverviews,
	hasOverviewYaml,
} from './FolderOverviewLogic';
import { resolveSourceFolder } from './overviewUtils';
import { updateLinkList, detectTamperedOverviews } from './LinkListService';

export class OverviewIndexService {
	private plugin: FolderNotesPlugin;
	private indexedNotePaths: Set<string> = new Set();
	private isInitialized = false;
	private pendingChangedPaths: Set<string> = new Set();
	private debouncedUpdate: () => void;

	constructor(plugin: FolderNotesPlugin) {
		this.plugin = plugin;
		const DEBOUNCE_DELAY_MS = 1000;
		this.debouncedUpdate = debounce(() => {
			void this.flushPendingUpdates();
		}, DEBOUNCE_DELAY_MS, true);
	}

	public get active(): boolean {
		return this.plugin.settings.fvGlobalSettings.autoUpdateLinks;
	}

	public async init(force = false): Promise<void> {
		if (this.isInitialized && !force) return;
		this.indexedNotePaths.clear();

		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			const hasOverview = await hasOverviewYaml(this.plugin, file);
			if (hasOverview) {
				this.indexedNotePaths.add(file.path);
			}
		}
		this.isInitialized = true;

		// Eagerly migrate and synchronize all overview notes across the vault on startup
		if (this.indexedNotePaths.size > 0 && this.active) {
			await this.updateAllOverviews();
		}
	}

	public addNote(file: TFile | string): void {
		const path = typeof file === 'string' ? file : file.path;
		this.indexedNotePaths.add(path);
		this.isInitialized = true;
	}

	public removeNote(file: TFile | string): void {
		const path = typeof file === 'string' ? file : file.path;
		this.indexedNotePaths.delete(path);
		this.isInitialized = true;
	}

	public handleRename(oldPath: string, newPath: string): void {
		if (this.indexedNotePaths.has(oldPath)) {
			this.indexedNotePaths.delete(oldPath);
			this.indexedNotePaths.add(newPath);
		}
		this.isInitialized = true;
		this.triggerDebouncedUpdate(newPath);
		this.triggerDebouncedUpdate(oldPath);
	}

	public handleDelete(path: string): void {
		this.indexedNotePaths.delete(path);
		this.isInitialized = true;
		this.triggerDebouncedUpdate(path);
	}

	public async handleFileModify(file: TFile): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		const hasOverview = await hasOverviewYaml(this.plugin, file);
		if (hasOverview) {
			this.indexedNotePaths.add(file.path);
		} else {
			this.indexedNotePaths.delete(file.path);
		}

		try {
			const content = await this.plugin.app.vault.read(file);
			const detections = await detectTamperedOverviews(this.plugin, file, content);
			if (detections.length > 0) {
				const { TamperedOverviewModal } = await import('../../frontend/modals/TamperedOverviewModal');
				new TamperedOverviewModal(this.plugin.app, this.plugin, file, detections).open();
			}
		} catch {
			// Passive read error during vault file operations
		}
	}

	public getAllNotes(): string[] {
		return Array.from(this.indexedNotePaths);
	}

	public triggerDebouncedUpdate(changedPath?: string): void {
		if (!this.active) return;
		if (changedPath) {
			this.pendingChangedPaths.add(changedPath);
		}
		this.debouncedUpdate();
	}

	private async flushPendingUpdates(): Promise<void> {
		if (!this.active) return;
		const pathsToProcess = Array.from(this.pendingChangedPaths);
		this.pendingChangedPaths.clear();

		if (pathsToProcess.length === 0) {
			await this.updateAllOverviews();
			return;
		}

		for (const changedPath of pathsToProcess) {
			await this.updateOverviewsForPath(changedPath);
		}
	}

	public async updateOverviewsForPath(changedPath: string): Promise<void> {
		if (!this.active) return;
		if (!this.isInitialized) {
			await this.init();
		}

		const paths = Array.from(this.indexedNotePaths);
		for (const filePath of paths) {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				continue;
			}

			const hasOverview = await hasOverviewYaml(this.plugin, file);
			if (!hasOverview) {
				this.indexedNotePaths.delete(file.path);
				continue;
			}

			const overviews = await getOverviews(this.plugin, file);
			for (const overview of overviews) {
				if (!overview.useActualLinks) continue;

				const sourceFolder = resolveSourceFolder(this.plugin, overview.folderPath, file);
				if (!(sourceFolder instanceof TFolder)) {
					continue;
				}

				// Check if changedPath is inside the monitored source folder branch or is the overview note itself
				const isTargetRoot = sourceFolder.path === '/' || sourceFolder.isRoot?.();
				const folderPrefix = sourceFolder.path.endsWith('/') ? sourceFolder.path : `${sourceFolder.path}/`;
				const isInBranch = isTargetRoot || changedPath === sourceFolder.path || changedPath.startsWith(folderPrefix) || changedPath === filePath;

				if (isInBranch) {
					const files: TAbstractFile[] = isTargetRoot
						? this.plugin.app.vault
							.getAllLoadedFiles()
							.filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
						: sourceFolder.children;

					await updateLinkList(files, this.plugin, overview, [], file);
				}
			}
		}
	}

	public async updateAllOverviews(): Promise<void> {
		if (!this.active) return;
		if (!this.isInitialized) {
			await this.init();
		}

		const paths = Array.from(this.indexedNotePaths);
		for (const filePath of paths) {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				continue;
			}

			const hasOverview = await hasOverviewYaml(this.plugin, file);
			if (!hasOverview) {
				this.indexedNotePaths.delete(file.path);
				continue;
			}

			const overviews = await getOverviews(this.plugin, file);
			for (const overview of overviews) {
				if (!overview.useActualLinks) continue;

				const sourceFolder = resolveSourceFolder(this.plugin, overview.folderPath, file);
				if (!(sourceFolder instanceof TFolder)) {
					continue;
				}

				const files: TAbstractFile[] = (sourceFolder.path === '/' || sourceFolder.isRoot?.())
					? this.plugin.app.vault
						.getAllLoadedFiles()
						.filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
					: sourceFolder.children;

				await updateLinkList(files, this.plugin, overview, [], file);
			}
		}
	}
}
