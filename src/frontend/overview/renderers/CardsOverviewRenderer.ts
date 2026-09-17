import {
	debounce,
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
import { getFolderNote } from '../../../backend/core/FolderNoteResolver';

export class CardsOverviewRenderer {
	private plugin: FolderNotesPlugin;
	private overview: FolderOverviewComponent;
	private yaml: defaultOverviewSettings;
	private root: HTMLElement;
	private ctx: MarkdownPostProcessorContext;
	private eventListeners: (() => void)[] = [];
	private debouncedRender: () => void;

	constructor(
		plugin: FolderNotesPlugin,
		ctx: MarkdownPostProcessorContext,
		root: HTMLElement,
		yaml: defaultOverviewSettings,
		overview: FolderOverviewComponent,
	) {
		this.plugin = plugin;
		this.overview = overview;
		this.yaml = yaml;
		this.root = root;
		this.ctx = ctx;

		const DEBOUNCE_DELAY_MS = 500;
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

		let cardsContainer = this.root.querySelector('.fv-cards-overview') as HTMLElement;
		if (!cardsContainer) {
			cardsContainer = this.root.createDiv({ cls: 'fv-cards-overview' });
		} else {
			cardsContainer.empty();
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

		await this.addFiles(cardsContainer, files);
	}

	private async addFiles(container: HTMLElement, files: TAbstractFile[]): Promise<void> {
		const allFiles = await filterFiles(
			files,
			this.plugin,
			this.yaml.folderPath,
			this.yaml.depth,
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
				await this.createFolderCard(container, folder);
			}
		}

		for (const file of noteFiles) {
			if (file instanceof TFile) {
				await this.createFileCard(container, file);
			}
		}
	}

	private async createFolderCard(container: HTMLElement, folder: TFolder): Promise<void> {
		const folderCard = container.createDiv({ cls: 'fv-card-folder' });
		const titleEl = folderCard.createEl('h3', { text: folder.name, cls: 'fv-card-title' });

		const folderNote = getFolderNote(this.plugin, folder.path);
		if (folderNote instanceof TFile) {
			folderCard.addClass('has-folder-note');
			folderCard.addEventListener('click', (e) => {
				e.preventDefault();
				void this.plugin.app.workspace.openLinkText(folderNote.path, '', false);
			});
			folderCard.oncontextmenu = (e): void => {
				e.stopImmediatePropagation();
				this.overview.fileMenu(folderNote, e);
			};
		} else {
			folderCard.oncontextmenu = (e): void => {
				e.stopImmediatePropagation();
				this.overview.folderMenu(folder, e);
			};
		}

		folderCard.createDiv({ cls: 'fv-card-folder-path', text: folder.path });
	}

	private async createFileCard(container: HTMLElement, file: TFile): Promise<void> {
		const fileCard = container.createDiv({ cls: 'fv-card-file' });
		fileCard.createEl('h3', { text: file.basename, cls: 'fv-card-title' });
		fileCard.createDiv({ cls: 'fv-card-file-path', text: file.path });

		fileCard.addEventListener('click', (e) => {
			e.preventDefault();
			void this.plugin.app.workspace.openLinkText(file.path, '', false);
		});

		fileCard.oncontextmenu = (e): void => {
			e.stopImmediatePropagation();
			this.overview.fileMenu(file, e);
		};
	}
}
