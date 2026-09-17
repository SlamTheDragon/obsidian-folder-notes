import {
	TFolder,
	TFile,
	type MarkdownPostProcessorContext,
	debounce,
} from 'obsidian';
import type FolderNotesPlugin from '../../../main';
import { extractFolderName, getFolderNote } from '../../../backend/core/FolderNoteResolver';
import { filterFiles, sortFiles } from '../../../backend/overview/FolderOverviewLogic';
import { getFolderPathFromString, resolveSourceFolder } from '../../../backend/overview/overviewUtils';
import type { defaultOverviewSettings } from '../../../backend/types/overview';
import type { FolderOverviewComponent } from '../OverviewPostProcessor';

export class ListOverviewRenderer {
	private plugin: FolderNotesPlugin;
	private ctx: MarkdownPostProcessorContext;
	private root: HTMLElement;
	private yaml: defaultOverviewSettings;
	private pathBlacklist: string[];
	private overview: FolderOverviewComponent;
	private unregisterVaultListener?: () => void;
	private debouncedRender: () => void;

	constructor(
		plugin: FolderNotesPlugin,
		ctx: MarkdownPostProcessorContext,
		root: HTMLElement,
		yaml: defaultOverviewSettings,
		pathBlacklist: string[],
		overview: FolderOverviewComponent,
	) {
		this.plugin = plugin;
		this.ctx = ctx;
		this.root = root;
		this.yaml = yaml;
		this.pathBlacklist = [...pathBlacklist];
		this.overview = overview;

		const DEBOUNCE_DELAY_MS = 300;
		this.debouncedRender = debounce(() => {
			void this.render();
		}, DEBOUNCE_DELAY_MS);
	}

	public async render(): Promise<void> {
		this.cleanup();
		this.pathBlacklist = [];

		const overviewList = this.overview.listEl;
		if (!overviewList) return;
		overviewList.empty();

		const { app } = this.plugin;
		let tFolder = resolveSourceFolder(this.plugin, this.yaml.folderPath, this.overview.sourceFile);
		if (!tFolder && this.yaml.folderPath.trim() === '') {
			tFolder = resolveSourceFolder(this.plugin, getFolderPathFromString(this.ctx.sourcePath), this.overview.sourceFile);
		}

		if (!(tFolder instanceof TFolder)) return;

		let files = (tFolder.path === '/' || tFolder.isRoot?.())
			? app.vault.getAllLoadedFiles().filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
			: tFolder.children;

		if (!files) return;

		const sourceFolderPath = tFolder.path;
		files = await filterFiles(
			files,
			this.plugin,
			sourceFolderPath,
			this.yaml.depth,
			this.overview.pathBlacklist,
			this.yaml,
			this.overview.sourceFile,
		);

		const folders = sortFiles(
			files.filter((f) => f instanceof TFolder),
			this.yaml,
			this.plugin,
		);
		const noteFiles = sortFiles(
			files.filter((f) => f instanceof TFile),
			this.yaml,
			this.plugin,
		);

		for (const folder of folders) {
			if (folder instanceof TFolder) {
				if (this.yaml.includeTypes.includes('folder')) {
					const folderItem = await this.addFolderList(overviewList, folder);
					if (folderItem) {
						await this.goThroughFolders(
							folderItem,
							folder,
							this.yaml.depth,
							sourceFolderPath,
						);
					}
				} else {
					await this.goThroughFolders(
						overviewList,
						folder,
						this.yaml.depth,
						sourceFolderPath,
					);
				}
			}
		}

		for (const file of noteFiles) {
			if (file instanceof TFile) {
				await this.addFileList(overviewList, file);
			}
		}

		const handleVaultChange = (): void => {
			this.debouncedRender();
		};

		this.overview.on('vault-change', handleVaultChange);
		this.unregisterVaultListener = () => {
			this.overview.off('vault-change', handleVaultChange);
		};
	}

	public cleanup(): void {
		if (this.unregisterVaultListener) {
			this.unregisterVaultListener();
			this.unregisterVaultListener = undefined;
		}
	}

	private async addFolderList(
		list: HTMLUListElement | HTMLLIElement,
		folder: TFolder,
	): Promise<HTMLLIElement | undefined> {
		this.overview.el.parentElement?.classList.add('fv-remove-edit-button');
		const folderDepth = folder.path.split('/').length;
		const sourceFolderDepth = this.yaml.folderPath.split('/').length;
		const isFirstLevelSub = folderDepth === sourceFolderDepth + 1;

		if (
			!this.yaml.showEmptyFolders &&
			folder.children.length === 0 &&
			!this.yaml.onlyIncludeSubfolders
		) {
			return undefined;
		} else if (
			this.yaml.onlyIncludeSubfolders &&
			!isFirstLevelSub &&
			folder.children.length === 0
		) {
			return undefined;
		}

		const folderItem = list.createEl('li', { cls: 'folder-overview-list folder-list' });
		const folderNote = getFolderNote(this.plugin, folder.path);

		if (folderNote instanceof TFile) {
			const folderNoteLink = folderItem.createEl('a', {
				cls: 'folder-overview-list-item folder-name-item internal-link',
				href: folderNote.path,
			});
			if (this.yaml.fmtpIntegration && this.plugin.fmtpHandler) {
				try {
					folderNoteLink.innerText = (await this.plugin.fmtpHandler.getNewFileName(folderNote)) ?? folder.name;
				} catch {
					folderNoteLink.innerText = folder.name;
				}
			} else {
				folderNoteLink.innerText = folder.name;
			}

			this.pathBlacklist.push(folderNote.path);
			folderNoteLink.oncontextmenu = (e): void => {
				e.stopImmediatePropagation();
				this.overview.fileMenu(folderNote, e);
			};
		} else {
			const folderName = folderItem.createEl('span', {
				cls: 'folder-overview-list-item folder-name-item',
			});
			folderName.innerText = folder.name;
			folderName.oncontextmenu = (e): void => {
				this.overview.folderMenu(folder, e);
			};
		}

		return folderItem;
	}

	private async goThroughFolders(
		list: HTMLLIElement | HTMLUListElement,
		folder: TFolder,
		depth: number,
		sourceFolderPath: string,
	): Promise<void> {
		if (sourceFolderPath === '') {
			depth--;
		}

		const allFiles = await filterFiles(
			folder.children,
			this.plugin,
			sourceFolderPath,
			depth,
			this.pathBlacklist,
			this.yaml,
			this.overview.sourceFile,
		);

		const noteFiles = sortFiles(
			allFiles.filter((file): file is TFile => file instanceof TFile),
			this.yaml,
			this.plugin,
		);

		const folders = sortFiles(
			allFiles.filter((file): file is TFolder => file instanceof TFolder),
			this.yaml,
			this.plugin,
		);

		const ul = list.createEl('ul', { cls: 'folder-overview-list' });

		for (const subFolder of folders) {
			if (subFolder instanceof TFolder) {
				if (this.yaml.includeTypes.includes('folder')) {
					const folderItem = await this.addFolderList(ul, subFolder);
					if (folderItem) {
						await this.goThroughFolders(folderItem, subFolder, depth, sourceFolderPath);
					}
				} else {
					await this.goThroughFolders(list, subFolder, depth, sourceFolderPath);
				}
			}
		}

		for (const file of noteFiles) {
			if (file instanceof TFile) {
				if (this.yaml.includeTypes.includes('folder')) {
					await this.addFileList(ul, file);
				} else {
					await this.addFileList(list, file);
				}
			}
		}
	}

	private async addFileList(
		list: HTMLUListElement | HTMLLIElement,
		file: TFile,
	): Promise<void> {
		if (!this.yaml.showFolderNotes) {
			if (this.pathBlacklist.includes(file.path)) return;
			if (extractFolderName(this.plugin.settings.folderNoteName, file.basename) === file.parent?.name) {
				return;
			}
		}

		this.overview.el.parentElement?.classList.add('fv-remove-edit-button');
		const listItem = list.createEl('li', { cls: 'folder-overview-list file-link' });
		listItem.oncontextmenu = (e): void => {
			e.stopImmediatePropagation();
			this.overview.fileMenu(file, e);
		};

		const nameItem = listItem.createEl('div', { cls: 'folder-overview-list-item' });
		const link = nameItem.createEl('a', { cls: 'internal-link', href: file.path });
		if (this.yaml.fmtpIntegration && this.plugin.fmtpHandler) {
			try {
				link.innerText = (await this.plugin.fmtpHandler.getNewFileName(file)) ?? file.basename;
			} catch {
				link.innerText = file.basename;
			}
		} else {
			link.innerText = file.basename;
		}

		if (file.extension !== 'md' && !this.yaml.disableFileTag) {
			nameItem.createDiv({ cls: 'nav-file-tag' }).innerText = file.extension;
		}
	}
}

export async function renderListOverview(
	plugin: FolderNotesPlugin,
	ctx: MarkdownPostProcessorContext,
	root: HTMLElement,
	yaml: defaultOverviewSettings,
	pathBlacklist: string[],
	overview: FolderOverviewComponent,
): Promise<ListOverviewRenderer> {
	const renderer = new ListOverviewRenderer(plugin, ctx, root, yaml, pathBlacklist, overview);
	await renderer.render();
	return renderer;
}
