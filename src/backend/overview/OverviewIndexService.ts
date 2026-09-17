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
		this.triggerDebouncedUpdate();
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
