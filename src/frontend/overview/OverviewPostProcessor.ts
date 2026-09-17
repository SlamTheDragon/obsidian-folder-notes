import {
	type MarkdownPostProcessorContext,
	parseYaml,
	TFolder,
	TFile,
	Notice,
	Menu,
	MarkdownRenderChild,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings, includeTypes } from '../../backend/types/overview';
import { CustomEventEmitter } from '../../backend/events/EventEmitter';
import {
	buildYamlConfig,
	getFolderPathFromString,
	parseOverviewTitle,
} from '../../backend/overview/overviewUtils';
import { updateLinkList, removeLinkList } from '../../backend/overview/LinkListService';
import { getFolder } from '../../backend/core/FolderNoteResolver';
import { ListOverviewRenderer } from './renderers/ListOverviewRenderer';
import { CardsOverviewRenderer } from './renderers/CardsOverviewRenderer';
import { ExplorerOverviewRenderer } from './renderers/ExplorerOverviewRenderer';
import { FolderOverviewModal } from '../modals/FolderOverviewModal';
import { NewFolderNameModal } from '../modals/NewFolderNameModal';

export class FolderOverviewComponent {
	public emitter: CustomEventEmitter;
	public yaml: defaultOverviewSettings;
	public plugin: FolderNotesPlugin;
	public ctx: MarkdownPostProcessorContext;
	public source: string;
	public el: HTMLElement;
	public pathBlacklist: string[] = [];
	public sourceFolder: TFolder | null = null;
	public root?: HTMLElement;
	public listEl?: HTMLUListElement;
	public defaultSettings: defaultOverviewSettings;
	public sourceFile?: TFile;
	private eventListeners: (() => void)[] = [];
	private activeRenderer?: ListOverviewRenderer | CardsOverviewRenderer | ExplorerOverviewRenderer;

	private readonly LINK_LIST_UPDATE_DELAY_MS = 1000;

	constructor(
		plugin: FolderNotesPlugin,
		ctx: MarkdownPostProcessorContext,
		source: string,
		el: HTMLElement,
		defaultSettings: defaultOverviewSettings,
	) {
		this.plugin = plugin;
		this.ctx = ctx;
		this.source = source;
		this.el = el;
		this.emitter = new CustomEventEmitter();
		this.defaultSettings = defaultSettings;

		const parsedYaml = this.parseYamlOrUseDefault(source);
		const includeTypes = parsedYaml?.includeTypes ||
			defaultSettings.includeTypes ||
			['folder', 'markdown'];

		this.sourceFile = this.getSourceFile(ctx);
		this.yaml = buildYamlConfig(
			parsedYaml,
			defaultSettings,
			ctx,
			includeTypes as includeTypes[],
		);

		this.setSourceFolder();

		const renderChild = new FolderOverviewRenderChild(el, this);
		ctx.addChild(renderChild);
	}

	public async create(): Promise<void> {
		this.el.empty();
		if (!(this.sourceFile instanceof TFile)) return;

		this.el.parentElement?.classList.add('folder-overview-container');
		if (this.yaml.hideFolderOverview) {
			if (this.yaml.isInCallout) {
				this.el.classList.add('fv-hide-overview');
			} else {
				this.el.parentElement?.classList.add('fv-hide-overview');
			}
		}

		this.el.parentElement?.addEventListener(
			'contextmenu',
			(e) => this.editOverviewContextMenu(e),
			{ capture: true },
		);

		this.root = this.el.createEl('div', { cls: 'folder-overview' });

		const headingTag = `h${this.yaml.titleSize}` as keyof HTMLElementTagNameMap;
		const titleEl = this.root.createEl(headingTag, { cls: 'folder-overview-title' });
		this.listEl = this.root.createEl('ul', { cls: 'folder-overview-list' });

		if (this.yaml.includeTypes.length === 0) {
			this.addEditButton(this.root);
			return;
		}

		const sourceFolderPath =
			this.yaml.folderPath.trim() ||
			getFolderPathFromString(this.ctx.sourcePath) ||
			'/';

		this.registerListeners();

		await this.renderTitle(this.sourceFolder, sourceFolderPath, this.sourceFile, titleEl);

		if (!this.validateSourceFolder(this.sourceFolder, sourceFolderPath)) {
			this.addEditButton(this.root);
			return;
		}

		await this.renderOverviewStyle(this.root);
		this.handleLinkList();
		this.addEditButton(this.root);
	}

	private parseYamlOrUseDefault(source: string): defaultOverviewSettings {
		let yaml: defaultOverviewSettings = parseYaml(source);
		if (!yaml) {
			yaml = {} as defaultOverviewSettings;
		}
		return yaml;
	}

	private getSourceFile(ctx: MarkdownPostProcessorContext): TFile | undefined {
		const sourceFile = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
		return sourceFile instanceof TFile ? sourceFile : undefined;
	}

	public on(event: string, listener: (data?: unknown) => void): void {
		this.emitter.on(event, listener);
	}

	public off(event: string, listener: (data?: unknown) => void): void {
		this.emitter.off(event, listener);
	}

	public emit(event: string, data?: unknown): void {
		this.emitter.emit(event, data);
	}

	public handleVaultChange(eventType: string): void {
		if (this.yaml.autoSync) {
			this.emit('vault-change', eventType);
		}
	}

	public disconnectListeners(): void {
		this.eventListeners.forEach((unregister) => unregister());
		this.eventListeners = [];
		if (this.activeRenderer && 'disconnectListeners' in this.activeRenderer) {
			(this.activeRenderer as any).disconnectListeners();
		} else if (this.activeRenderer && 'cleanup' in this.activeRenderer) {
			(this.activeRenderer as any).cleanup();
		}
	}

	private registerListeners(): void {
		const onRename = (): void => this.handleVaultChange('renamed');
		const onCreate = (): void => this.handleVaultChange('created');
		const onDelete = (): void => this.handleVaultChange('deleted');

		this.plugin.app.vault.on('rename', onRename);
		this.plugin.app.vault.on('create', onCreate);
		this.plugin.app.vault.on('delete', onDelete);

		this.eventListeners.push(() => this.plugin.app.vault.off('rename', onRename));
		this.eventListeners.push(() => this.plugin.app.vault.off('create', onCreate));
		this.eventListeners.push(() => this.plugin.app.vault.off('delete', onDelete));
	}

	private setSourceFolder(): void {
		const folderPath = this.yaml?.folderPath?.trim() ?? '';
		switch (folderPath) {
			case '':
			case 'File’s parent folder path': {
				const parentPath = getFolderPathFromString(this.ctx.sourcePath);
				const sourceFolder = this.plugin.app.vault.getAbstractFileByPath(parentPath);
				if (sourceFolder instanceof TFolder) {
					this.yaml.folderPath = sourceFolder.path;
					this.sourceFolder = sourceFolder;
				}
				break;
			}
			case 'Path of folder linked to the file': {
				if (this.sourceFile instanceof TFile) {
					const linkedFolder = getFolder(this.plugin, this.sourceFile);
					if (linkedFolder instanceof TFolder) {
						this.sourceFolder = linkedFolder;
						this.yaml.folderPath = linkedFolder.path;
					} else {
						this.yaml.folderPath = '';
					}
				}
				break;
			}
			default: {
				const sourceFolder = this.plugin.app.vault.getAbstractFileByPath(this.yaml.folderPath);
				if (sourceFolder instanceof TFolder) {
					this.sourceFolder = sourceFolder;
				}
			}
		}
	}

	private async renderTitle(
		sourceFolder: TFolder | null,
		sourceFolderPath: string,
		sourceFile: TFile,
		titleEl: HTMLElement,
	): Promise<void> {
		if (!this.yaml.showTitle) return;
		const title = await parseOverviewTitle(
			this.yaml,
			this.plugin,
			sourceFolder,
			sourceFolderPath,
			sourceFile,
		);
		titleEl.innerText = title;
	}

	private validateSourceFolder(
		sourceFolder: TFolder | null,
		sourceFolderPath: string,
	): boolean {
		if (!sourceFolder && sourceFolderPath !== '/' && sourceFolderPath !== '') {
			new Notice("Folder overview: Couldn't find the folder");
			return false;
		}
		return true;
	}

	private async renderOverviewStyle(root: HTMLElement): Promise<void> {
		if (this.yaml.style === 'cards') {
			const renderer = new CardsOverviewRenderer(
				this.plugin,
				this.ctx,
				root,
				this.yaml,
				this,
			);
			this.activeRenderer = renderer;
			await renderer.render();
		} else if (this.yaml.style === 'explorer') {
			const renderer = new ExplorerOverviewRenderer(
				this.plugin,
				this.ctx,
				root,
				this.yaml,
				this.pathBlacklist,
				this,
			);
			this.activeRenderer = renderer;
			await renderer.render();
		} else {
			const renderer = new ListOverviewRenderer(
				this.plugin,
				this.ctx,
				root,
				this.yaml,
				this.pathBlacklist,
				this,
			);
			this.activeRenderer = renderer;
			await renderer.render();
		}
	}

	private handleLinkList(): void {
		if (this.yaml.useActualLinks) {
			setTimeout(() => {
				if (this.sourceFile instanceof TFile && this.sourceFolder) {
					const files = this.sourceFolder.path === '/'
						? this.plugin.app.vault.getAllLoadedFiles().filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
						: this.sourceFolder.children;
					void updateLinkList(
						files,
						this.plugin,
						this.yaml,
						this.pathBlacklist,
						this.sourceFile,
					);
				}
			}, this.LINK_LIST_UPDATE_DELAY_MS);
		} else {
			void removeLinkList(this.plugin, this.sourceFile, this.yaml);
		}
	}

	public addEditButton(root: HTMLElement): void {
		const editButton = root.createEl('button', { cls: 'folder-overview-edit-button' });
		editButton.innerText = 'Edit overview';
		editButton.addEventListener(
			'click',
			(e) => {
				e.stopImmediatePropagation();
				e.preventDefault();
				e.stopPropagation();
				new FolderOverviewModal(
					this.plugin.app,
					this.plugin,
					this.yaml,
					this.ctx,
					this.el,
					this.plugin.settings.defaultOverview,
				).open();
			},
			{ capture: true },
		);
	}

	public fileMenu(file: TFile, e: MouseEvent): void {
		const fileMenu = new Menu();
		fileMenu.addItem((item) => {
			item.setTitle('Edit folder overview');
			item.setIcon('pencil');
			item.onClick(() => {
				new FolderOverviewModal(
					this.plugin.app,
					this.plugin,
					this.yaml,
					this.ctx,
					this.el,
					this.plugin.settings.defaultOverview,
				).open();
			});
		});

		fileMenu.addSeparator();

		fileMenu.addItem((item) => {
			item.setTitle(window.i18next?.t('plugins.file-explorer.menu-opt-rename') ?? 'Rename');
			item.setIcon('pencil');
			item.onClick(() => {
				this.plugin.app.fileManager.promptForFileRename(file);
			});
		});

		fileMenu.addItem((item) => {
			item.setTitle(window.i18next?.t('plugins.file-explorer.menu-opt-delete') ?? 'Delete');
			item.setIcon('trash');
			item.dom.addClass('is-warning');
			item.dom.setAttribute('data-section', 'danger');
			item.onClick(() => {
				this.plugin.app.fileManager.promptForDeletion(file);
			});
		});

		fileMenu.addSeparator();
		this.plugin.app.workspace.trigger('file-menu', fileMenu, file, 'folder-overview-file-context-menu', null);
		fileMenu.showAtPosition({ x: e.pageX, y: e.pageY });
	}

	public folderMenu(folder: TFolder, e: MouseEvent): void {
		const folderMenu = new Menu();
		folderMenu.addItem((item) => {
			item.setTitle('Edit folder overview');
			item.setIcon('pencil');
			item.onClick(() => {
				new FolderOverviewModal(
					this.plugin.app,
					this.plugin,
					this.yaml,
					this.ctx,
					this.el,
					this.plugin.settings.defaultOverview,
				).open();
			});
		});

		folderMenu.addSeparator();

		folderMenu.addItem((item) => {
			item.setTitle('Rename');
			item.setIcon('pencil');
			item.onClick(() => {
				new NewFolderNameModal(this.plugin.app, this.plugin, folder).open();
			});
		});

		folderMenu.addItem((item) => {
			item.setTitle('Delete');
			item.setIcon('trash');
			item.dom.addClass('is-warning');
			item.dom.setAttribute('data-section', 'danger');
			item.onClick(() => {
				this.plugin.app.fileManager.promptForFolderDeletion(folder);
			});
		});

		folderMenu.addSeparator();
		this.plugin.app.workspace.trigger('file-menu', folderMenu, folder, 'folder-overview-folder-context-menu', null);
		folderMenu.showAtPosition({ x: e.pageX, y: e.pageY });
	}

	public editOverviewContextMenu(e: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Edit folder overview');
			item.setIcon('pencil');
			item.onClick(() => {
				new FolderOverviewModal(
					this.plugin.app,
					this.plugin,
					this.yaml,
					this.ctx,
					this.el,
					this.plugin.settings.defaultOverview,
				).open();
			});
		});
		menu.showAtPosition({ x: e.pageX, y: e.pageY });
	}
}

class FolderOverviewRenderChild extends MarkdownRenderChild {
	private component: FolderOverviewComponent;

	constructor(el: HTMLElement, component: FolderOverviewComponent) {
		super(el);
		this.component = component;
	}

	public onunload(): void {
		this.component.disconnectListeners();
	}
}

export function registerOverviewPostProcessor(plugin: FolderNotesPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('folder-overview', (source, el, ctx) => {
		const overview = new FolderOverviewComponent(
			plugin,
			ctx,
			source,
			el,
			plugin.settings.defaultOverview,
		);
		void overview.create();
	});
}
