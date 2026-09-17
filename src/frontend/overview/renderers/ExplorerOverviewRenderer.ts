import {
	debounce,
	setIcon,
	TFile,
	TFolder,
	type MarkdownPostProcessorContext,
	type TAbstractFile,
} from 'obsidian';
import type FolderNotesPlugin from '../../../main';
import { filterFiles, sortFiles } from '../../../backend/overview/FolderOverviewLogic';
import { getFolderPathFromString, resolveSourceFolder } from '../../../backend/overview/overviewUtils';
import type { defaultOverviewSettings } from '../../../backend/types/overview';
import type { FolderOverviewComponent } from '../OverviewPostProcessor';
import { extractFolderName, getFolderNote } from '../../../backend/core/FolderNoteResolver';

export class ExplorerOverviewRenderer {
	private plugin: FolderNotesPlugin;
	private ctx: MarkdownPostProcessorContext;
	private root: HTMLElement;
	private yaml: defaultOverviewSettings;
	private pathBlacklist: string[];
	private overview: FolderOverviewComponent;
	private eventListeners: (() => void)[] = [];
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
		this.pathBlacklist = pathBlacklist;
		this.overview = overview;

		const DEBOUNCE_DELAY_MS = 300;
		this.debouncedRender = debounce(() => {
			void this.render();
		}, DEBOUNCE_DELAY_MS);
	}

	public disconnectListeners(): void {
		this.eventListeners.forEach((unregister) => unregister());
		this.eventListeners = [];
	}

	public async render(): Promise<void> {
		this.disconnectListeners();
		const overviewList = this.overview.listEl;
		if (overviewList) {
			overviewList.empty();
		}

		let tFolder = resolveSourceFolder(this.plugin, this.yaml.folderPath, this.overview.sourceFile);
		if (!tFolder && this.yaml.folderPath.trim() === '') {
			tFolder = resolveSourceFolder(this.plugin, getFolderPathFromString(this.ctx.sourcePath), this.overview.sourceFile);
		}

		if (!(tFolder instanceof TFolder)) return;

		let container = this.root.querySelector('.fn-explorer-overview') as HTMLElement;
		if (!container) {
			container = this.root.createDiv({ cls: 'fn-explorer-overview nav-files-container' });
		} else {
			container.empty();
		}

		const handleVaultChange = (): void => {
			this.debouncedRender();
		};

		this.overview.on('vault-change', handleVaultChange);
		this.eventListeners.push(() => {
			this.overview.off('vault-change', handleVaultChange);
		});

		const files = (tFolder.path === '/' || tFolder.isRoot?.())
			? this.plugin.app.vault.getAllLoadedFiles().filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
			: tFolder.children;

		const sourceFolderPath = tFolder.path;
		await this.buildTree(container, files, sourceFolderPath, this.yaml.depth);
	}

	private async buildTree(
		parentEl: HTMLElement,
		files: TAbstractFile[],
		sourceFolderPath: string,
		depth: number,
	): Promise<void> {
		const allFiles = await filterFiles(
			files,
			this.plugin,
			sourceFolderPath,
			depth,
			this.overview.pathBlacklist,
			this.yaml,
			this.overview.sourceFile,
		);

		const sortedFiles = sortFiles(
			(allFiles ?? []).filter((file): file is TAbstractFile => file !== null),
			this.yaml,
			this.plugin,
		);

		const folders = sortedFiles.filter((child) => child instanceof TFolder);
		const noteFiles = sortedFiles.filter((child) => child instanceof TFile);

		for (const folder of folders) {
			if (folder instanceof TFolder) {
				await this.createFolderTreeItem(parentEl, folder, sourceFolderPath, depth);
			}
		}

		for (const file of noteFiles) {
			if (file instanceof TFile) {
				await this.createFileTreeItem(parentEl, file);
			}
		}
	}

	private async createFolderTreeItem(
		parentEl: HTMLElement,
		folder: TFolder,
		sourceFolderPath: string,
		depth: number,
	): Promise<void> {
		const treeItem = parentEl.createDiv({ cls: 'tree-item nav-folder' });
		const titleEl = treeItem.createDiv({ cls: 'tree-item-self nav-folder-title' });
		titleEl.setAttribute('data-path', folder.path);

		const collapseIcon = titleEl.createDiv({ cls: 'tree-item-icon collapse-icon nav-folder-collapse-indicator' });
		if (!this.yaml.disableCollapseIcon) {
			setIcon(collapseIcon, 'right-triangle');
		}

		const innerEl = titleEl.createDiv({ cls: 'tree-item-inner nav-folder-title-content' });
		const folderNote = getFolderNote(this.plugin, folder.path);

		if (folderNote instanceof TFile) {
			treeItem.addClass('has-folder-note');
			innerEl.innerText = folder.name;
			titleEl.onclick = (e) => {
				e.stopPropagation();
				void this.plugin.app.workspace.openLinkText(folderNote.path, '', false);
			};
			titleEl.oncontextmenu = (e) => {
				e.stopImmediatePropagation();
				this.overview.fileMenu(folderNote, e);
			};
		} else {
			innerEl.innerText = folder.name;
			titleEl.oncontextmenu = (e) => {
				e.stopImmediatePropagation();
				this.overview.folderMenu(folder, e);
			};
		}

		const childrenEl = treeItem.createDiv({ cls: 'tree-item-children nav-folder-children' });

		let isCollapsed = this.yaml.alwaysCollapse;
		if (this.yaml.storeFolderCondition && folder.collapsed !== undefined) {
			isCollapsed = folder.collapsed;
		}

		if (isCollapsed) {
			treeItem.addClass('is-collapsed');
			childrenEl.style.display = 'none';
		}

		collapseIcon.onclick = (e) => {
			e.stopPropagation();
			isCollapsed = !isCollapsed;
			folder.collapsed = isCollapsed;
			if (isCollapsed) {
				treeItem.addClass('is-collapsed');
				childrenEl.style.display = 'none';
			} else {
				treeItem.removeClass('is-collapsed');
				childrenEl.style.display = '';
			}
		};

		if (depth > 1) {
			await this.buildTree(childrenEl, folder.children, sourceFolderPath, depth - 1);
		}
	}

	private async createFileTreeItem(parentEl: HTMLElement, file: TFile): Promise<void> {
		if (!this.yaml.showFolderNotes) {
			if (this.overview.pathBlacklist.includes(file.path)) return;
			if (extractFolderName(this.plugin.settings.folderNoteName, file.basename) === file.parent?.name) {
				return;
			}
		}

		const treeItem = parentEl.createDiv({ cls: 'tree-item nav-file' });
		const titleEl = treeItem.createDiv({ cls: 'tree-item-self nav-file-title' });
		titleEl.setAttribute('data-path', file.path);

		const innerEl = titleEl.createDiv({ cls: 'tree-item-inner nav-file-title-content' });
		if (this.yaml.fmtpIntegration && this.plugin.fmtpHandler) {
			try {
				innerEl.innerText = (await this.plugin.fmtpHandler.getNewFileName(file)) ?? file.basename;
			} catch {
				innerEl.innerText = file.basename;
			}
		} else {
			innerEl.innerText = file.basename;
		}

		if (file.extension !== 'md' && !this.yaml.disableFileTag) {
			titleEl.createDiv({ cls: 'nav-file-tag' }).innerText = file.extension;
		}

		titleEl.onclick = (e) => {
			e.stopPropagation();
			void this.plugin.app.workspace.openLinkText(file.path, '', false);
		};

		titleEl.oncontextmenu = (e) => {
			e.stopImmediatePropagation();
			this.overview.fileMenu(file, e);
		};
	}
}
