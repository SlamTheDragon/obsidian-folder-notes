import {
	type App,
	type TAbstractFile,
	type MarkdownPostProcessorContext,
	type WorkspaceLeaf,
	Plugin,
	TFile,
	TFolder,
	parseYaml,
	Notice,
	Keymap,
	requireApiVersion,
	Platform,
} from 'obsidian';
import {
	type FolderNotesSettings,
	DEFAULT_SETTINGS,
	type LegacySettingsData,
} from './backend/types/settings';
import { SettingsTab } from './frontend/settings/SettingsTab';
import { Commands } from './Commands';
import type { FileExplorerWorkspaceLeaf } from './globals';
import {
	registerFileExplorerObserver,
	unregisterFileExplorerObserver,
} from './backend/events/FileExplorerObserver';
import {
	handleRename,
	handleCreate,
	handleDelete,
} from './backend/events/VaultSyncHandler';
import {
	getFolderNote,
	getFolder,
} from './backend/core/FolderNoteResolver';
import {
	openFolderNote,
	createFolderNote,
} from './backend/core/FolderNoteService';
import { FrontMatterTitlePluginHandler } from './backend/events/FrontMatterTitle';
import { TabManager } from './backend/events/TabManager';
import {
	addCSSClassToFileExplorerEl,
	getFileExplorerElement,
	removeCSSClassFromFileExplorerEL,
	refreshAllFolderStyles,
	setActiveFolder,
	removeActiveFolder,
} from './backend/utils/domUtils';
import { getExcludedFolder } from './backend/core/ExcludeService';
import { getFileExplorer } from './backend/utils/pathUtils';
import { FOLDER_OVERVIEW_VIEW, FolderOverviewView } from './frontend/views/FolderOverviewView';
import { OverviewIndexService } from './backend/overview/OverviewIndexService';
import { registerOverviewPostProcessor } from './frontend/overview/OverviewPostProcessor';
import { Logger } from './backend/utils/Logger';

interface FileExplorerPluginLike extends Plugin {
	revealInFolder: (file: TAbstractFile) => void;
}

interface DragManagerLike {
	draggable?: {
		file?: TAbstractFile;
		type?: string;
	} | null;
	setAction(action: string): void;
}

interface ClipboardManagerLike {
	app: App & {
		dragManager?: DragManagerLike;
	};
	handleDragOver: (evt: DragEvent, ...args: unknown[]) => void;
	handleDrop: (evt: DragEvent, ...args: unknown[]) => void;
}

interface EditModeLike {
	clipboardManager: ClipboardManagerLike;
}

interface ViewWithEditModes {
	editMode?: EditModeLike;
	sourceMode?: EditModeLike;
}

interface ActiveEditorLike {
	editMode?: EditModeLike;
}

export default class FolderNotesPlugin extends Plugin {
	settings!: FolderNotesSettings;
	settingsTab!: SettingsTab;
	activeFolderDom!: HTMLElement | null;
	activeFileExplorer!: FileExplorerWorkspaceLeaf;
	fmtpHandler: FrontMatterTitlePluginHandler | null = null;
	hoveredElement: HTMLElement | null = null;
	mouseEvent: MouseEvent | null = null;
	hoverLinkTriggered = false;
	tabManager!: TabManager;
	settingsOpened = false;
	askModalCurrentlyOpen = false;
	overviewIndexService!: OverviewIndexService;

	private originalRevealInFolder?: (file: TAbstractFile) => void;
	private originalClipboardProto?: ClipboardManagerLike;
	private originalHandleDragOver?: ClipboardManagerLike['handleDragOver'];
	private originalHandleDrop?: ClipboardManagerLike['handleDrop'];

	async onload(): Promise<void> {
		console.debug('loading folder notes plugin');
		await this.loadSettings();
		Logger.getInstance().initialize(this);
		this.settingsTab = new SettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		await this.saveSettings();

		this.overviewIndexService = new OverviewIndexService(this);

		// Add CSS Classes
		this.addSettingCssClasses();

		new Commands(this.app, this).registerCommands();

		this.app.workspace.onLayoutReady(() => this.onLayoutReady());

		if (!this.settings.persistentSettingsTab.afterRestart) {
			this.settings.settingsTab = 'general';
		}

		this.registerDomEvent(window, 'keydown', (event: KeyboardEvent) => {
			const { hoveredElement } = this;
			if (this.hoverLinkTriggered) return;
			if (!hoveredElement) return;
			if (!Keymap.isModEvent(event)) return;

			const folderPath = hoveredElement?.parentElement?.getAttribute('data-path') || '';
			const folderNote = getFolderNote(this, folderPath);
			if (!folderNote) return;

			this.app.workspace.trigger('hover-link', {
				event: this.mouseEvent,
				source: 'preview',
				hoverParent: {
					file: folderNote,
				},
				targetEl: hoveredElement,
				linktext: folderNote?.basename,
				sourcePath: folderNote?.path,
			});
			this.hoverLinkTriggered = true;
		});

		this.registerEvent(this.app.workspace.on('file-open', (openFile: TFile | null) => {
			removeActiveFolder(this);

			if (!openFile || !openFile.basename) { return; }

			const folder = getFolder(this, openFile);
			if (!(folder instanceof TFolder)) { return; }
			const excludedFolder = getExcludedFolder(this, folder.path, true);
			if (excludedFolder?.disableFolderNote) return;
			const folderNote = getFolderNote(this, folder.path);
			if (!folderNote) { return; }
			if (folderNote.path !== openFile.path) { return; }
			setActiveFolder(folder.path, this);
			if (!excludedFolder?.showFolderNote) {
				this.revealFolderNoteInExplorer(folder, folderNote.path);
			}
		}));

		this.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => {
			handleCreate(file, this).catch((err) => {
				console.error(err); new Notice('Error handling file creation');
			});
			this.handleVaultChange();
		}));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			handleRename(file, oldPath, this);
			this.overviewIndexService?.handleRename(oldPath, file.path);
			this.handleVaultChange();
		}));

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => {
			handleDelete(file, this);
			this.overviewIndexService?.handleDelete(file.path);
			this.handleVaultChange();
		}));

		this.registerEvent(this.app.vault.on('modify', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				void this.overviewIndexService?.handleFileModify(file);
			}
		}));

		registerOverviewPostProcessor(this);
	}

	addSettingCssClasses(): void {
		const body = activeDocument?.body ?? document.body;
		if (!body) return;

		body.classList.add('folder-notes-plugin');
		body.classList.toggle('hide-folder-note', !!this.settings.hideFolderNote);
		body.classList.toggle('fn-hide-empty-collapse-icon', !!this.settings.hideCollapsingIconForEmptyFolders);
		body.classList.toggle('folder-note-hide-name-path', !!this.settings.hideFolderNoteNameInPath);
		body.classList.toggle('folder-note-underline', !!this.settings.underlineFolder);
		body.classList.toggle('folder-note-bold', !!this.settings.boldName);
		body.classList.toggle('folder-note-cursive', !!this.settings.cursiveName);
		body.classList.toggle('folder-note-bold-path', !!this.settings.boldNameInPath);
		body.classList.toggle('folder-note-cursive-path', !!this.settings.cursiveNameInPath);
		body.classList.toggle('folder-note-underline-path', !!this.settings.underlineFolderInPath);
		body.classList.toggle('fn-whitespace-stop-collapsing', !!this.settings.stopWhitespaceCollapsing);
		body.classList.toggle('fn-hide-collapse-icon', !!this.settings.hideCollapsingIcon);
		body.classList.toggle('fn-ignore-attachment-folder', !!this.settings.ignoreAttachmentFolder);
		body.classList.toggle('disable-folder-highlight', !this.settings.highlightFolder);

		if (requireApiVersion('1.7.2')) {
			body.classList.add('version-1-7-2');
		}
	}

	onLayoutReady(): void {
		if (!this._loaded) {
			return;
		}

		registerFileExplorerObserver(this);

		const fileExplorer = getFileExplorer(this);
		const infinityScroll = fileExplorer?.view?.tree?.infinityScroll;

		if (infinityScroll) {
			// increase infinity scroll buffer to show hidden folder notes
			infinityScroll.rootMargin = 1.5;
		}

		this.registerView(FOLDER_OVERVIEW_VIEW, (leaf: WorkspaceLeaf) => {
			return new FolderOverviewView(leaf, this);
		});

		// Deduplicate any lingering overview leaves from earlier sessions
		const overviewLeaves = this.app.workspace.getLeavesOfType(FOLDER_OVERVIEW_VIEW);
		if (overviewLeaves.length > 1) {
			for (let i = 1; i < overviewLeaves.length; i++) {
				overviewLeaves[i].detach();
			}
		}

		this.app.workspace.on('layout-change', () => {
			this.tabManager?.updateTabs();
		});

		if (this.app.plugins.getPlugin('obsidian-front-matter-title-plugin')) {
			this.fmtpHandler = new FrontMatterTitlePluginHandler(this);
		}
		this.tabManager = new TabManager(this);
		this.tabManager.updateTabs();

		this.registerDomEvent(activeDocument, 'click', (evt: MouseEvent) => {
			this.handleFileExplorerClick(evt);
		}, true);

		// Handle middle mouse button clicks
		this.registerDomEvent(activeDocument, 'auxclick', (evt: MouseEvent) => {
			const rightClick = 2;
			if (evt.button === rightClick) return;
			this.handleFileExplorerClick(evt);
		}, true);

		const fileExplorerPlugin = this.app.internalPlugins.getEnabledPluginById('file-explorer');
		if (fileExplorerPlugin) {
			const fileExplorerInstance = fileExplorerPlugin as unknown as FileExplorerPluginLike;
			this.originalRevealInFolder =
				(fileExplorerInstance.revealInFolder as unknown as FileExplorerPluginLike['revealInFolder'])
					.bind(fileExplorerInstance);
			const orig = this.originalRevealInFolder;
			fileExplorerInstance.revealInFolder = (file: TAbstractFile): void => {
				if (file instanceof TFile) {
					const folder = getFolder(this, file);
					if (folder instanceof TFolder) {
						const folderNote = getFolderNote(this, folder.path);
						if (!folderNote || folderNote.path !== file.path) {
							orig(file);
							return;
						}
						const excludedFolder = getExcludedFolder(this, folder.path, true);
						if (
							!this.settings.hideFolderNote ||
							excludedFolder?.showFolderNote ||
							excludedFolder?.disableFolderNote
						) {
							orig(file);
							return;
						}
						orig(folder);
						return;
					}
				}
				if (file instanceof TFolder || file instanceof TFile) {
					orig(file);
					return;
				}
			};
		}

		const leaf = this.app.workspace.getLeavesOfType('markdown').first();
		const view = leaf?.view;

		if (view) {
			const viewWithEditModes = view as ViewWithEditModes;
			const activeEditor = this.app.workspace.activeEditor as ActiveEditorLike | undefined;
			const editMode = viewWithEditModes.editMode ?? viewWithEditModes.sourceMode
				?? activeEditor?.editMode;

			if (editMode) {
				const { clipboardManager } = editMode;
				const clipboardProto = Object.getPrototypeOf(clipboardManager) as ClipboardManagerLike;
				this.originalClipboardProto = clipboardProto;
				this.originalHandleDragOver = clipboardProto.handleDragOver;
				this.originalHandleDrop = clipboardProto.handleDrop;

				const folderNotePlugin = this;
				const origDragOver = this.originalHandleDragOver;
				const origDrop = this.originalHandleDrop;

				clipboardProto.handleDragOver = function (evt: DragEvent, ...args: unknown[]): void {
					const { dragManager } = (this as ClipboardManagerLike).app;
					const draggable = dragManager?.draggable;

					if (draggable?.file instanceof TFolder) {
						const folderNote = getFolderNote(folderNotePlugin, draggable.file.path);
						if (folderNote) {
							dragManager.setAction(
								window.i18next?.t('interface.drag-and-drop.insert-link-here') ?? 'Insert link here',
							);
							return;
						}
					}

					return origDragOver.call(this, evt, ...args);
				};

				clipboardProto.handleDrop = function (evt: DragEvent, ...args: unknown[]): void {
					const { dragManager } = (this as ClipboardManagerLike).app;
					const draggable = dragManager?.draggable;

					if (draggable?.file instanceof TFolder) {
						const folderNote = getFolderNote(folderNotePlugin, draggable.file.path);
						if (folderNote) {
							draggable.file = folderNote;
							draggable.type = 'file';
						}
					}

					return origDrop.call(this, evt, ...args);
				};
			}
		}

		if (this.settings.fvGlobalSettings.autoUpdateLinks) {
			void this.overviewIndexService.init(false);
		}
	}

	private revealFolderNoteInExplorer(folder: TFolder, folderNotePath: string): void {
		if (!this.settings.hideFolderNote) return;
		const fileExplorerView = getFileExplorer(this)?.view;
		if (!fileExplorerView?.autoRevealFile) return;
		const { defaultView } = fileExplorerView.containerEl.ownerDocument;
		if (!defaultView) return;
		const folderNoteIsStillActive = (): boolean =>
			this.app.workspace.getActiveFile()?.path === folderNotePath;

		defaultView.requestAnimationFrame(() => {
			if (!folderNoteIsStillActive()) return;

			const ancestors: TFolder[] = [];
			let { parent } = folder;
			while (parent && !parent.isRoot()) {
				ancestors.unshift(parent);
				({ parent } = parent);
			}
			for (const ancestor of ancestors) {
				fileExplorerView.fileItems?.[ancestor.path]?.setCollapsed?.(false);
			}

			defaultView.requestAnimationFrame(() => {
				if (!folderNoteIsStillActive()) return;
				const folderItem = fileExplorerView.fileItems?.[folder.path];
				if (!folderItem) return;
				fileExplorerView.tree.infinityScroll?.scrollIntoView(
					folderItem,
					this.settings.fileExplorerRevealMargin,
				);
			});
		});
	}

	handleVaultChange(): void {
		if (!this.settings.fvGlobalSettings.autoUpdateLinks) return;
		this.overviewIndexService?.triggerDebouncedUpdate();
	}

	handleFileExplorerClick(evt: MouseEvent): void {
		const target = evt.target as HTMLElement;
		if (evt.shiftKey) return;
		if (this.isMobileClickDisabled()) return;

		const { folderTitleEl, onlyClickedOnFolderTitle } = this.getFolderTitleInfo(target);
		if (!folderTitleEl) return;
		if (this.shouldIgnoreClickByWhitespaceOrCollapse(target, onlyClickedOnFolderTitle)) return;

		const folderPath = this.getValidFolderPath(folderTitleEl);
		if (!folderPath) return;

		const usedCtrl = this.isCtrlUsed(evt);
		Logger.getInstance().logInteraction('FileExplorerClick', {
			folderPath,
			usedCtrl,
			altKey: evt.altKey,
			button: evt.button,
			targetClass: target.className,
		}, 'handleFileExplorerClick');

		const folderNote = getFolderNote(this, folderPath);

		if (!folderNote && this.shouldCreateNote(evt, usedCtrl)) {
			this.createNoteAndMark(folderPath);
			return;
		}
		if (!(folderNote instanceof TFile)) return;
		if (!this.shouldOpenNote(usedCtrl, evt)) return;

		if (!this.settings.enableCollapsing || usedCtrl) {
			evt.preventDefault();
			evt.stopImmediatePropagation();
		}

		void openFolderNote(this, folderNote, evt);
	}

	private isMobileClickDisabled(): boolean {
		return Platform.isMobile && this.settings.disableOpenFolderNoteOnClick;
	}

	private getFolderTitleInfo(target: HTMLElement): {
		folderTitleEl: HTMLElement | null;
		onlyClickedOnFolderTitle: boolean;
	} {
		const folderTitleEl = target.closest('.nav-folder-title');
		const isIcon = !!(target.closest('.collapse-icon') || target.closest('.nav-folder-collapse-indicator') || target.closest('.tree-item-icon'));
		const onlyClickedOnFolderTitle = !isIcon && !!(
			target.closest('.nav-folder-title-content') ||
			target.closest('.tree-item-inner')
		);
		return {
			folderTitleEl: folderTitleEl instanceof HTMLElement ? folderTitleEl : null,
			onlyClickedOnFolderTitle,
		};
	}

	private shouldIgnoreClickByWhitespaceOrCollapse(
		target: HTMLElement,
		onlyClickedOnFolderTitle: boolean,
	): boolean {
		if (target.closest('.collapse-icon') || target.closest('.nav-folder-collapse-indicator') || target.closest('.tree-item-icon')) {
			return true;
		}
		if (!this.settings.stopWhitespaceCollapsing && !onlyClickedOnFolderTitle) {
			return true;
		}
		return false;
	}


	private getValidFolderPath(folderTitleEl: HTMLElement): string | null {
		const folderPath = folderTitleEl.getAttribute('data-path');
		if (!folderPath) return null;
		const excludedFolder = getExcludedFolder(this, folderPath, true);
		if (excludedFolder?.disableFolderNote) return null;
		return folderPath;
	}

	private isCtrlUsed(evt: MouseEvent): boolean {
		return Platform.isMacOS ? evt.metaKey : evt.ctrlKey;
	}

	private shouldCreateNote(evt: MouseEvent, usedCtrl: boolean): boolean {
		const isTabMod = Keymap.isModEvent(evt) === 'tab';
		if (!(evt.altKey || isTabMod)) return false;
		return (this.settings.altKey && evt.altKey) || (usedCtrl && this.settings.ctrlKey);
	}

	private createNoteAndMark(folderPath: string): void {
		void createFolderNote(this, folderPath, true, undefined, true);
		void addCSSClassToFileExplorerEl(folderPath, 'has-folder-note', false, this);
		void removeCSSClassFromFileExplorerEL(folderPath, 'has-not-folder-note', false, this);
	}

	private shouldOpenNote(usedCtrl: boolean, evt: MouseEvent): boolean {
		if (this.settings.openWithCtrl && !usedCtrl) return false;
		if (this.settings.openWithAlt && !evt.altKey) return false;
		return true;
	}

	async activateOverviewView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(FOLDER_OVERVIEW_VIEW);

		if (leaves.length > 0) {
			leaf = leaves[0];
			for (let i = 1; i < leaves.length; i++) {
				leaves[i].detach();
			}
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: FOLDER_OVERVIEW_VIEW, active: true });
		}

		if (!leaf) return;
		if (leaf.view instanceof FolderOverviewView) {
			leaf.view.activeFile = this.app.workspace.getActiveFile();
			await leaf.view.reloadAndDisplay();
		}
		void workspace.revealLeaf(leaf);
	}

	isEmptyFolderNoteFolder(folder: TFolder): boolean {
		let attachmentFolderPath = this.app.vault.getConfig('attachmentFolderPath') as string;
		const cleanAttachmentFolderPath = attachmentFolderPath?.replace('./', '') || '';
		const attachmentsAreInRootFolder = attachmentFolderPath === './'
			|| attachmentFolderPath === '';
		const threshold = this.settings.storageLocation === 'insideFolder' ? 1 : 0;
		if (folder.children.length === 0) {
			void addCSSClassToFileExplorerEl(folder.path, 'fn-empty-folder', false, this);
		}
		attachmentFolderPath = `${folder.path}/${cleanAttachmentFolderPath}`;

		if (folder.children.length === threshold) {
			void addCSSClassToFileExplorerEl(folder.path, 'fn-empty-folder', false, this);
			return true;
		} else if (folder.children.length > threshold) {
			if (attachmentsAreInRootFolder) {
				return false;
			} else if (
				this.app.vault.getAbstractFileByPath(attachmentFolderPath) instanceof TFolder
			) {
				const attachmentFolder = this.app.vault.getAbstractFileByPath(attachmentFolderPath);
				if (
					attachmentFolder instanceof TFolder &&
					folder.children.length <= threshold + 1
				) {
					void addCSSClassToFileExplorerEl(folder.path, 'fn-empty-folder', false, this);
					void addCSSClassToFileExplorerEl(
						folder.path, 'fn-has-attachment-folder',
						false, this,
					);
					void addCSSClassToFileExplorerEl(
						folder.path, 'fn-has-attachment-folder',
						true, this,
					);
				}
				return folder.children.length <= threshold + 1;
			}
			return false;
		}
		return true;
	}

	async changeFolderNameInExplorer(
		folder: TFolder,
		newName: string | null | undefined,
		waitForCreate = false,
		count = 0,
	): Promise<void> {
		const MAX_RETRY_COUNT = 5;
		const RETRY_DELAY_MS = 500;
		if (!newName) newName = folder.name;
		let fileExplorerItem = getFileExplorerElement(folder.path, this);
		if (!fileExplorerItem) {
			if (waitForCreate && count < MAX_RETRY_COUNT) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
				void this.changeFolderNameInExplorer(folder, newName, waitForCreate, count + 1);
				return;
			}
			return;
		}

		fileExplorerItem = fileExplorerItem?.querySelector('div.nav-folder-title-content');
		if (!fileExplorerItem) { return; }
		if (this.settings.frontMatterTitle.explorer && this.settings.frontMatterTitle.enabled) {
			(fileExplorerItem).innerText = newName;
			(fileExplorerItem).setAttribute('old-name', folder.name);
		} else {
			(fileExplorerItem).innerText = folder.name;
			(fileExplorerItem).removeAttribute('old-name');
		}
	}

	async changeFolderNameInPath(
		folder: TFolder,
		newName: string | null | undefined,
		breadcrumb: HTMLElement,
	): Promise<void> {
		if (!newName) newName = folder.name;

		breadcrumb.textContent = folder.newName || folder.name;
		breadcrumb.setAttribute('old-name', folder.name);
		breadcrumb.setAttribute('data-path', folder.path);
	}

	updateAllBreadcrumbs(remove?: boolean): void {
		if (!this.settings.frontMatterTitle.path && !remove) { return; }
		const viewHeaderItems = activeDocument.querySelectorAll('span.view-header-breadcrumb');
		const files = this.app.vault.getAllLoadedFiles().filter((file) => file instanceof TFolder);
		viewHeaderItems.forEach((item) => {
			if (!item.hasAttribute('data-path')) { return; }
			const path = item.getAttribute('data-path');
			const folder = files.find((file) => file.path === path);
			if (!(folder instanceof TFolder)) { return; }
			if (remove) {
				item.textContent = folder.name;
				item.removeAttribute('old-name');
			} else {
				item.textContent = folder.newName || folder.name;
				item.setAttribute('old-name', folder.name);
				item.setAttribute('data-path', folder.path);
			}
		});
	}

	onunload(): void {
		unregisterFileExplorerObserver();
		this.app.workspace.detachLeavesOfType(FOLDER_OVERVIEW_VIEW);

		// Clean up all 15 injected CSS classes
		const classList = [
			'folder-notes-plugin',
			'hide-folder-note',
			'fn-hide-empty-collapse-icon',
			'folder-note-hide-name-path',
			'folder-note-underline',
			'folder-note-bold',
			'folder-note-cursive',
			'folder-note-bold-path',
			'folder-note-cursive-path',
			'folder-note-underline-path',
			'fn-whitespace-stop-collapsing',
			'fn-hide-collapse-icon',
			'fn-ignore-attachment-folder',
			'disable-folder-highlight',
			'version-1-7-2',
		];
		classList.forEach((cls) => activeDocument.body.classList.remove(cls));

		removeActiveFolder(this);

		if (this.fmtpHandler) {
			this.fmtpHandler.deleteEvent();
		}

		// Restore monkey patches if needed
		if (this.originalRevealInFolder) {
			const fileExplorerPlugin = this.app.internalPlugins.getEnabledPluginById('file-explorer');
			if (fileExplorerPlugin) {
				(fileExplorerPlugin as any).revealInFolder = this.originalRevealInFolder;
			}
		}

		if (this.originalClipboardProto && this.originalHandleDragOver && this.originalHandleDrop) {
			this.originalClipboardProto.handleDragOver = this.originalHandleDragOver;
			this.originalClipboardProto.handleDrop = this.originalHandleDrop;
		}

		void Logger.getInstance().flush();
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData() as LegacySettingsData | null;
		if (data) {
			if (data.allowWhitespaceCollapsing === true) {
				data.stopWhitespaceCollapsing = false;
				delete data.allowWhitespaceCollapsing;
			} else if (data.allowWhitespaceCollapsing === false) {
				data.stopWhitespaceCollapsing = true;
				delete data.allowWhitespaceCollapsing;
			}
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data, {
			defaultOverview: Object.assign({}, DEFAULT_SETTINGS.defaultOverview, data?.defaultOverview),
			frontMatterTitle: Object.assign({}, DEFAULT_SETTINGS.frontMatterTitle, data?.frontMatterTitle),
			persistentSettingsTab: Object.assign({}, DEFAULT_SETTINGS.persistentSettingsTab, data?.persistentSettingsTab),
			fvGlobalSettings: Object.assign({}, DEFAULT_SETTINGS.fvGlobalSettings, data?.fvGlobalSettings),
			openSidebar: Object.assign({}, DEFAULT_SETTINGS.openSidebar, data?.openSidebar),
			excludeFolderDefaultSettings: Object.assign({}, DEFAULT_SETTINGS.excludeFolderDefaultSettings, data?.excludeFolderDefaultSettings),
			excludePatternDefaultSettings: Object.assign({}, DEFAULT_SETTINGS.excludePatternDefaultSettings, data?.excludePatternDefaultSettings),
		});

		if (!this.settings.oldFolderNoteName) {
			this.settings.oldFolderNoteName = this.settings.folderNoteName;
		}
	}

	async saveSettings(reloadStyles?: boolean): Promise<void> {
		await this.saveData(this.settings);
		this.addSettingCssClasses();
		if ((!this.settingsOpened || reloadStyles === true) && reloadStyles !== false) {
			refreshAllFolderStyles(true, this);
		}
	}
}
