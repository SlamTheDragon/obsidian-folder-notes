import { Keymap, Platform } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import { getFolderNote, getFolderNoteFolder } from '../core/FolderNoteResolver';
import { handleViewHeaderClick } from './NavigationInterceptor';
import { getExcludedFolder } from '../core/ExcludeService';
import { updateCSSClassesForFolder } from '../utils/domUtils';

let fileExplorerMutationObserver: MutationObserver | null = null;

export function registerFileExplorerObserver(plugin: FolderNotesPlugin): void {
	// Run once on initial layout
	plugin.app.workspace.onLayoutReady(() => {
		initializeFolderNoteFeatures(plugin);
		initializeBreadcrumbs(plugin);
	});

	// Re-run when layout changes (e.g. File Explorer is reopened)
	plugin.registerEvent(
		plugin.app.workspace.on('layout-change', () => {
			initializeFolderNoteFeatures(plugin);

			const activeLeaf = plugin.app.workspace.getActiveFileView()?.containerEl;
			if (!activeLeaf) return;

			const titleContainer = activeLeaf.querySelector('.view-header-title-container');
			if (!(titleContainer instanceof HTMLElement)) return;

			updateFolderNamesInPath(plugin, titleContainer);
		}),
	);
}

export function unregisterFileExplorerObserver(): void {
	if (fileExplorerMutationObserver) {
		fileExplorerMutationObserver.disconnect();
		fileExplorerMutationObserver = null;
	}
}

function initializeFolderNoteFeatures(plugin: FolderNotesPlugin): void {
	initializeAllFolderTitles(plugin);
	observeFolderTitleMutations(plugin);
}

function initializeBreadcrumbs(plugin: FolderNotesPlugin): void {
	const titleContainers = activeDocument.querySelectorAll('.view-header-title-container');
	if (!titleContainers.length) return;
	titleContainers.forEach((container) => {
		if (!(container.instanceOf(HTMLElement))) return;
		scheduleIdle(() => updateFolderNamesInPath(plugin, container), { timeout: 1000 });
	});
}

/**
 * Observes the File Explorer for newly added folder elements and applies plugin logic (e.g., styles, event listeners)
 * automatically when folders are created, expanded, or when the File Explorer view is reopened.
 */
function observeFolderTitleMutations(plugin: FolderNotesPlugin): void {
	if (fileExplorerMutationObserver) {
		fileExplorerMutationObserver.disconnect();
	}
	fileExplorerMutationObserver = new MutationObserver((mutations) => {
		const affectedFolderPaths = new Set<string>();
		for (const mutation of mutations) {
			// Obsidian can rebuild the parent folder title when its children change.
			const folderPath = getAffectedFolderPath(mutation.target);
			if (folderPath) affectedFolderPaths.add(folderPath);

			for (const node of Array.from(mutation.addedNodes)) {
				if (!(node.instanceOf(HTMLElement))) continue;
				processAddedFolders(node, plugin);
			}
		}

		affectedFolderPaths.forEach((folderPath) => {
			void updateCSSClassesForFolder(folderPath, plugin);
		});
	});

	fileExplorerMutationObserver.observe(document, { childList: true, subtree: true });
}

function getAffectedFolderPath(target: Node): string | null {
	if (!(target.instanceOf(HTMLElement))) return null;
	const folder = (target as HTMLElement).closest('.nav-folder');
	const folderTitle = folder?.querySelector('.nav-folder-title');
	return folderTitle?.getAttribute('data-path') ?? null;
}

function initializeAllFolderTitles(plugin: FolderNotesPlugin): void {
	const allTitles = activeDocument.querySelectorAll('.nav-folder-title-content');
	for (const title of Array.from(allTitles)) {
		const folderTitle = title as HTMLElement;
		const folderEl = folderTitle.closest('.nav-folder-title');
		if (!folderEl) continue;

		const folderPath = folderEl.getAttribute('data-path') || '';
		setupFolderTitle(folderTitle, plugin, folderPath);
	}
}

function processAddedFolders(node: HTMLElement, plugin: FolderNotesPlugin): void {
	const titles: HTMLElement[] = [];
	if (node.matches('.nav-folder-title-content')) {
		titles.push(node);
	}
	node.querySelectorAll('.nav-folder-title-content').forEach((el) => {
		titles.push(el as HTMLElement);
	});

	titles.forEach((folderTitle) => {
		const folderEl = folderTitle.closest('.nav-folder-title');
		const folderPath = folderEl?.getAttribute('data-path') || '';
		const RETRY_TIMEOUT = 50;
		if (!folderEl || !folderPath) {
			window.setTimeout(() => {
				const retryFolderEl = folderTitle.closest('.nav-folder-title');
				const retryFolderPath = retryFolderEl?.getAttribute('data-path') || '';
				if (retryFolderEl && retryFolderPath) {
					setupFolderTitle(folderTitle, plugin, retryFolderPath);
				}
			}, RETRY_TIMEOUT);
			return;
		}
		setupFolderTitle(folderTitle, plugin, folderPath);
	});

	// Also check if any file items were added (e.g. expanding a folder)
	const fileTitles: HTMLElement[] = [];
	if (node.matches('.nav-file-title')) {
		fileTitles.push(node);
	}
	node.querySelectorAll('.nav-file-title').forEach((el) => {
		fileTitles.push(el as HTMLElement);
	});

	fileTitles.forEach((fileEl) => {
		const filePath = fileEl.getAttribute('data-path');
		if (filePath) {
			const file = plugin.app.vault.getAbstractFileByPath(filePath);
			if (file && (file as any).basename) {
				const parentFolder = (file as any).parent;
				if (parentFolder) {
					const note = getFolderNote(plugin, parentFolder.path);
					if (note && note.path === filePath) {
						fileEl.addClass('is-folder-note');
						if (fileEl.parentElement) {
							fileEl.parentElement.addClass('is-folder-note');
						}
					}
				}
			}
		}
	});
}

async function setupFolderTitle(
	folderTitle: HTMLElement,
	plugin: FolderNotesPlugin,
	folderPath: string,
): Promise<void> {
	if (folderTitle.dataset.initialized === 'true') return;
	if (!folderPath) return;

	folderTitle.dataset.initialized = 'true';
	await updateCSSClassesForFolder(folderPath, plugin);

	if (plugin.settings.frontMatterTitle.enabled) {
		plugin.fmtpHandler?.fmptUpdateFileName(
			{ id: '', result: false, path: folderPath, pathOnly: false },
			false,
		);
	}

	if (Platform.isMobile && plugin.settings.disableOpenFolderNoteOnClick) return;

	plugin.registerDomEvent(folderTitle, 'pointerover', (event: MouseEvent) => {
		plugin.hoveredElement = folderTitle;
		plugin.mouseEvent = event;

		if (!Keymap.isModEvent(event)) return;
		if (!(event.target instanceof HTMLElement)) return;

		const folderNote = getFolderNote(plugin, folderPath);
		if (!folderNote) return;

		plugin.app.workspace.trigger('hover-link', {
			event,
			source: 'preview',
			hoverParent: { file: folderNote },
			targetEl: event.target,
			linktext: folderNote.basename,
			sourcePath: folderNote.path,
		});
		plugin.hoverLinkTriggered = true;
	});

	plugin.registerDomEvent(folderTitle, 'pointerout', () => {
		plugin.hoveredElement = null;
		plugin.mouseEvent = null;
		plugin.hoverLinkTriggered = false;
	});
}

export async function updateFolderNamesInPath(
	plugin: FolderNotesPlugin,
	titleContainer: HTMLElement,
): Promise<void> {
	const titleParent = titleContainer.querySelector('.view-header-title-parent');
	let path = '';
	const TRAILING_SLASH_LENGTH = 1;

	if (titleParent?.childNodes.length === 0) {
		titleContainer.classList.remove('hide-folder-note-title-in-path');
	}

	for (const breadcrumb of Array.from(titleParent?.childNodes ?? [])) {
		if (!(breadcrumb instanceof HTMLElement)) continue;
		if (breadcrumb.classList.contains('view-header-breadcrumb-separator')) {
			if (breadcrumb.nextSibling === null) {
				breadcrumb.classList.add('is-last-separator');
			}
			continue;
		}

		path += breadcrumb.getAttribute('old-name') ?? (breadcrumb).innerText.trim();
		path += '/';
		const folderPath = path.slice(0, -TRAILING_SLASH_LENGTH);

		const excludedFolder = getExcludedFolder(plugin, folderPath, true);
		if (excludedFolder?.disableFolderNote) return;
		const folderNote = getFolderNote(plugin, folderPath);
		const viewHeaderTitle = titleContainer.querySelector('.view-header-title');

		if (viewHeaderTitle && folderNote) {
			const filePath = path + (viewHeaderTitle as HTMLElement).innerText.trim() + '.md';
			const file = plugin.app.vault.getAbstractFileByPath(filePath);
			const folder = getFolderNoteFolder(plugin, folderNote, (file as any)?.name ?? '');
			if (folder && file && file.path === folderNote?.path && (file as any).parent?.path !== '/') {
				viewHeaderTitle.parentElement?.classList.add('hide-folder-note-title-in-path');
				viewHeaderTitle.classList.add('path-is-folder-note');
			} else {
				viewHeaderTitle.parentElement?.classList.remove('hide-folder-note-title-in-path');
				viewHeaderTitle.classList.remove('path-is-folder-note');
			}
		}
		if (!folderNote) {
			breadcrumb.classList.remove('has-folder-note');
			breadcrumb.removeAttribute('data-path');
			continue;
		}
		breadcrumb.classList.add('has-folder-note');
		breadcrumb.setAttribute('data-path', path.slice(0, -TRAILING_SLASH_LENGTH));
		if (breadcrumb.dataset.fnBound !== 'true') {
			breadcrumb.dataset.fnBound = 'true';
			breadcrumb.addEventListener('click', (e) => {
				void handleViewHeaderClick(e, plugin);
			}, { capture: true });
		}


		if (plugin.settings.frontMatterTitle.enabled) {
			plugin.fmtpHandler?.fmptUpdateFileName(
				{ id: '', result: false, path: folderPath, pathOnly: true, breadcrumb: breadcrumb },
				true,
			);
		}
	}
}

function scheduleIdle(callback: () => void, options?: { timeout: number }): void {
	const DEFAULT_IDLE_TIMEOUT = 200;
	if ('requestIdleCallback' in window) {
		const windowWithIdle = window as Window & {
			requestIdleCallback: (callback: () => void, options?: { timeout: number }) => void
		};
		windowWithIdle.requestIdleCallback(callback, options);
	} else {
		globalThis.setTimeout(callback, options?.timeout || DEFAULT_IDLE_TIMEOUT);
	}
}
