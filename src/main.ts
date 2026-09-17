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
		activeDocument.body.classList.add('folder-notes-plugin');
		if (this.settings.hideFolderNote) { activeDocument.body.classList.add('hide-folder-note'); }
		if (this.settings.hideCollapsingIconForEmptyFolders) {
			activeDocument.body.classList.add('fn-hide-empty-collapse-icon');
		}
		if (this.settings.hideFolderNoteNameInPath) {
			activeDocument.body.classList.add('folder-note-hide-name-path');
		}
		if (this.settings.underlineFolder) {
			activeDocument.body.classList.add('folder-note-underline');
		}
		if (this.settings.boldName) { activeDocument.body.classList.add('folder-note-bold'); }
		if (this.settings.cursiveName) { activeDocument.body.classList.add('folder-note-cursive'); }
		if (this.settings.boldNameInPath) {
			activeDocument.body.classList.add('folder-note-bold-path');
		}
		if (this.settings.cursiveNameInPath) {
			activeDocument.body.classList.add('folder-note-cursive-path');
		}
		if (this.settings.underlineFolderInPath) {
			activeDocument.body.classList.add('folder-note-underline-path');
		}
		if (this.settings.stopWhitespaceCollapsing) {
			activeDocument.body.classList.add('fn-whitespace-stop-collapsing');
		}
		if (this.settings.hideCollapsingIcon) {
			activeDocument.body.classList.add('fn-hide-collapse-icon');
		}
		if (this.settings.ignoreAttachmentFolder) {
			activeDocument.body.classList.add('fn-ignore-attachment-folder');
		}
		if (!this.settings.highlightFolder) {
			activeDocument.body.classList.add('disable-folder-highlight');
		}

		if (requireApiVersion('1.7.2')) {
			activeDocument.body.classList.add('version-1-7-2');
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
		const onlyClickedOnFolderTitle = !!target.closest('.nav-folder-title-content');
		return {
			folderTitleEl: folderTitleEl?.instanceOf(HTMLElement) ? folderTitleEl : null,
			onlyClickedOnFolderTitle,
		};
	}

	private shouldIgnoreClickByWhitespaceOrCollapse(
		target: HTMLElement,
		onlyClickedOnFolderTitle: boolean,
	): boolean {
		if (!this.settings.stopWhitespaceCollapsing && !onlyClickedOnFolderTitle) return true;
		if (target.closest('.collapse-icon')) return true;
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
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: FOLDER_OVERVIEW_VIEW, active: true });
		}

		if (!leaf) return;
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
		if ((!this.settingsOpened || reloadStyles === true) && reloadStyles !== false) {
			refreshAllFolderStyles(true, this);
		}
	}
}
