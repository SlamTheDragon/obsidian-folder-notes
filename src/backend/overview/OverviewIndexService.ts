import {
	debounce,
	TFile,
	TFolder,
	type TAbstractFile,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import {
	filterFiles,
	getAllFiles,
	getOverviews,
	hasOverviewYaml,
	sortFiles,
} from './FolderOverviewLogic';
import { updateLinkList } from './LinkListService';

export class OverviewIndexService {
	private plugin: FolderNotesPlugin;
	private indexedNotePaths: Set<string> = new Set();
	private isInitialized = false;
	private debouncedUpdateAll: () => void;

	constructor(plugin: FolderNotesPlugin) {
		this.plugin = plugin;
		const DEBOUNCE_DELAY_MS = 2000;
		this.debouncedUpdateAll = debounce(() => {
			void this.updateAllOverviews();
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
	}

	public addNote(file: TFile | string): void {
		const path = typeof file === 'string' ? file : file.path;
		this.indexedNotePaths.add(path);
	}

	public removeNote(file: TFile | string): void {
		const path = typeof file === 'string' ? file : file.path;
		this.indexedNotePaths.delete(path);
	}

	public handleRename(oldPath: string, newPath: string): void {
		if (this.indexedNotePaths.has(oldPath)) {
			this.indexedNotePaths.delete(oldPath);
			this.indexedNotePaths.add(newPath);
		}
	}

	public handleDelete(path: string): void {
		this.indexedNotePaths.delete(path);
	}

	public async handleFileModify(file: TFile): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		const hasOverview = await hasOverviewYaml(this.plugin, file);
		if (hasOverview) {
			this.indexedNotePaths.add(file.path);
		} else {
			this.indexedNotePaths.delete(file.path);
		}
	}

	public getAllNotes(): string[] {
		return Array.from(this.indexedNotePaths);
	}

	public triggerDebouncedUpdate(): void {
		if (!this.active) return;
		this.debouncedUpdateAll();
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
				this.indexedNotePaths.delete(filePath);
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

				let sourceFolderPath = (overview.folderPath || '').trim();
				// Properly resolve top-level folder names without wiping them to '/'
				if (sourceFolderPath === '' || sourceFolderPath === 'File’s parent folder path') {
					sourceFolderPath = file.parent?.path ?? '/';
				}

				let sourceFolder: TAbstractFile | null = null;
				if (sourceFolderPath === '/' || sourceFolderPath === '') {
					sourceFolder = this.plugin.app.vault.getRoot();
				} else {
					sourceFolder = this.plugin.app.vault.getAbstractFileByPath(sourceFolderPath);
				}

				if (!(sourceFolder instanceof TFolder)) {
					continue;
				}

				let files: TAbstractFile[] = [];
				if (sourceFolder.path === '/' || sourceFolderPath === '/') {
					files = this.plugin.app.vault
						.getAllLoadedFiles()
						.filter((f) => f.parent?.path === '/' || !f.path.includes('/'));
				} else {
					files = sourceFolder.children;
				}

				files = getAllFiles(files, sourceFolderPath, overview.depth);
				const filteredFiles = await filterFiles(
					files,
					this.plugin,
					sourceFolderPath,
					overview.depth,
					[],
					overview,
					file,
				);

				let sortedFiles = filteredFiles.filter((f): f is TAbstractFile => f !== null);
				if (!overview.includeTypes.includes('folder')) {
					sortedFiles = getAllFiles(sortedFiles, sourceFolderPath, overview.depth);
				}
				sortedFiles = sortFiles(sortedFiles, overview, this.plugin);

				await updateLinkList(sortedFiles, this.plugin, overview, [], file);
			}
		}
	}
}
