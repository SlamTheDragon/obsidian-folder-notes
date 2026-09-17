import { TFile, TFolder, Notice, type TAbstractFile } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import {
	extractFolderName,
	getFolder,
	getFolderNote,
	getFolderNoteFolder,
	findFolderNoteFile,
	normalizeFolderNoteType,
} from '../core/FolderNoteResolver';
import {
	getExcludedFolder,
	addExcludedFolder,
	updateExcludedFolder,
	deleteExcludedFolder,
	getDetachedFolder,
} from '../core/ExcludeService';
import {
	createFolderNote,
	deleteFolderNote,
	turnIntoFolderNote,
} from '../core/FolderNoteService';
import { ExcludedFolder } from '../types/exclude';
import {
	removeCSSClassFromFileExplorerEL,
	addCSSClassToFileExplorerEl,
	markFileAsFolderNote,
	unmarkFileAsFolderNote,
	unmarkFolderAsFolderNote,
	markFolderWithFolderNoteClasses,
	hideFolderNoteInFileExplorer,
	removeActiveFolder,
	setActiveFolder,
	updateCSSClassesForFolder,
} from '../utils/domUtils';
import {
	getFolderPathFromString,
	getFolderNameFromPathString,
	removeExtension,
	getFileNameFromPathString,
	isFileInAttachmentFolder,
} from '../utils/pathUtils';
import { Logger } from '../utils/Logger';

// -----------------------------------------------------------------------------
// Vault Create Handler
// -----------------------------------------------------------------------------
export async function handleCreate(file: TAbstractFile, plugin: FolderNotesPlugin): Promise<void> {
	if (!plugin.app.workspace.layoutReady) return;

	const folder = file.parent;
	if (folder instanceof TFolder) {
		if (plugin.isEmptyFolderNoteFolder(folder) && getFolderNote(plugin, folder.path)) {
			addCSSClassToFileExplorerEl(folder.path, 'only-has-folder-note', true, plugin);
		} else {
			removeCSSClassFromFileExplorerEL(folder.path, 'only-has-folder-note', true, plugin);
		}
	}

	if (file instanceof TFile) {
		handleFileCreation(file, plugin);
	} else if (file instanceof TFolder && plugin.settings.autoCreate) {
		handleFolderCreation(file, plugin);
	}
}

async function handleFileCreation(file: TFile, plugin: FolderNotesPlugin): Promise<void> {
	const folder = getFolder(plugin, file);

	if (!(folder instanceof TFolder) && plugin.settings.autoCreateForFiles) {
		if (!file.parent) { return; }
		const newFolder = await plugin.app.fileManager.createNewFolder(file.parent);
		turnIntoFolderNote(plugin, file, newFolder);
	} else if (folder instanceof TFolder) {
		if (folder.children.length >= 1) {
			removeCSSClassFromFileExplorerEL(folder.path, 'fn-empty-folder', false, plugin);
		}

		const detachedFolder = getExcludedFolder(plugin, folder.path, true);
		if (detachedFolder) { return; }
		const folderNote = getFolderNote(plugin, folder.path);

		if (folderNote && folderNote.path === file.path) {
			addCSSClassToFileExplorerEl(folder.path, 'has-folder-note', false, plugin);
			addCSSClassToFileExplorerEl(file.path, 'is-folder-note', false, plugin);
		} else if (plugin.settings.autoCreateForFiles && !isFileInAttachmentFolder(plugin, file)) {
			if (!plugin.settings.supportedFileTypes.includes(file.extension)) { return; }
			if (!file.parent) { return; }
			const newFolder = await plugin.app.fileManager.createNewFolder(file.parent);
			turnIntoFolderNote(plugin, file, newFolder);
		}
	}
}

async function handleFolderCreation(folder: TFolder, plugin: FolderNotesPlugin): Promise<void> {
	let openFile = plugin.settings.autoCreateFocusFiles;

	const attachmentFolderPath = plugin.app.vault.getConfig('attachmentFolderPath') as string;
	const cleanAttachmentFolderPath = attachmentFolderPath?.replace('./', '') || '';
	const attachmentsAreInRootFolder = attachmentFolderPath === './' || attachmentFolderPath === '';
	addCSSClassToFileExplorerEl(folder.path, 'fn-empty-folder', false, plugin);

	if (!plugin.settings.autoCreateForAttachmentFolder) {
		if (!attachmentsAreInRootFolder && cleanAttachmentFolderPath === folder.name) return;
	} else if (!attachmentsAreInRootFolder && cleanAttachmentFolderPath === folder.name) {
		openFile = false;
	}

	const excludedFolder = getExcludedFolder(plugin, folder.path, true);
	if (excludedFolder?.disableAutoCreate) return;

	const folderNote = getFolderNote(plugin, folder.path);
	if (folderNote) return;

	void createFolderNote(plugin, folder.path, openFile, undefined, true);
	addCSSClassToFileExplorerEl(folder.path, 'has-folder-note', false, plugin);
}

// -----------------------------------------------------------------------------
// Vault Delete Handler
// -----------------------------------------------------------------------------
export function handleDelete(file: TAbstractFile, plugin: FolderNotesPlugin): void {
	const folder = plugin.app.vault.getAbstractFileByPath(getFolderPathFromString(file.path));
	if (folder instanceof TFolder) {
		if (plugin.isEmptyFolderNoteFolder(folder) && getFolderNote(plugin, folder.path)) {
			addCSSClassToFileExplorerEl(folder.path, 'only-has-folder-note', true, plugin);
		} else {
			removeCSSClassFromFileExplorerEL(folder.path, 'only-has-folder-note', true, plugin);
		}
	}

	if (file instanceof TFile) {
		const folderNoteFolder = getFolder(plugin, file);
		if (!folderNoteFolder) { return; }
		const folderNote = getFolderNote(plugin, folderNoteFolder.path);
		if (folderNote) { return; }
		removeCSSClassFromFileExplorerEL(folderNoteFolder.path, 'has-folder-note', false, plugin);
		removeCSSClassFromFileExplorerEL(
			folderNoteFolder.path, 'only-has-folder-note', true, plugin,
		);
		hideFolderNoteInFileExplorer(folderNoteFolder.path, plugin);
	}

	if (!(file instanceof TFolder)) { return; }
	const folderNote = getFolderNote(plugin, file.path);
	if (!folderNote) { return; }
	removeCSSClassFromFileExplorerEL(folderNote.path, 'is-folder-note', false, plugin);
	if (!plugin.settings.syncDelete) { return; }
	deleteFolderNote(plugin, folderNote, false);
}

// -----------------------------------------------------------------------------
// Vault Rename Handler
// -----------------------------------------------------------------------------
export function handleRename(
	file: TAbstractFile,
	oldPath: string,
	plugin: FolderNotesPlugin,
): void {
	let folder = file.parent;
	const oldFolder = plugin.app.vault.getAbstractFileByPath(getFolderPathFromString(oldPath));

	if (folder instanceof TFolder) {
		if (plugin.isEmptyFolderNoteFolder(folder) && getFolderNote(plugin, folder.path)) {
			addCSSClassToFileExplorerEl(folder.path, 'only-has-folder-note', true, plugin);
		} else {
			removeCSSClassFromFileExplorerEL(folder.path, 'only-has-folder-note', true, plugin);
		}
	}

	if (oldFolder instanceof TFolder) {
		if (plugin.isEmptyFolderNoteFolder(oldFolder) && getFolderNote(plugin, oldFolder.path)) {
			addCSSClassToFileExplorerEl(oldFolder.path, 'only-has-folder-note', true, plugin);
		} else {
			removeCSSClassFromFileExplorerEL(oldFolder.path, 'only-has-folder-note', true, plugin);
		}
	}

	if (file instanceof TFolder) {
		folder = file;
		plugin.tabManager.updateTab(folder.path);
		updateExcludedFolderPath(folder, oldPath, plugin);
		if (isFolderRename(folder, oldPath)) {
			handleFolderRename(folder, oldPath, plugin);
			return;
		}
		return handleFolderMove(folder, oldPath, plugin);

	} else if (file instanceof TFile) {
		if (isFileRename(file, oldPath)) {
			handleFileRename(file, oldPath, plugin);
			return;
		}
		handleFileMove(file, oldPath, plugin);
		return;
	}
}

function isFileRename(file: TFile, oldPath: string): boolean {
	const oldFolderPath = getFolderPathFromString(oldPath);
	const newFolderPath = file.parent?.path;
	const oldName = getFileNameFromPathString(oldPath);
	const newName = file.name;

	return oldFolderPath === newFolderPath && oldName !== newName;
}

function isFolderRename(folder: TFolder, oldPath: string): boolean {
	const oldName = getFileNameFromPathString(oldPath);
	const newName = folder.name;
	const oldParent = getFolderPathFromString(oldPath);
	const newParent = folder.parent?.path;

	return oldParent === newParent && oldName !== newName;
}

export function handleFolderMove(file: TFolder, oldPath: string, plugin: FolderNotesPlugin): void {
	if (plugin.settings.storageLocation === 'insideFolder' || plugin.settings.storageLocation === 'vaultFolder') { return; }
	if (!plugin.settings.syncMove) { return; }
	const folderNote = getFolderNote(plugin, oldPath, plugin.settings.storageLocation);
	if (!(file instanceof TFolder) || !folderNote) return;
	const newFolder = plugin.app.vault.getAbstractFileByPath(file.path);
	if (!(newFolder instanceof TFolder)) return;
	let newPath = folderNote.path;

	if (!newFolder.parent || newFolder.parent.isRoot?.() || newFolder.parent.path === '/' || newFolder.parent.path === '') {
		newPath = folderNote.name;
	} else {
		newPath = `${newFolder.parent.path}/${folderNote.name}`;
	}

	plugin.app.fileManager.renameFile(folderNote, newPath);
}

function handleFileMove(file: TFile, oldPath: string, plugin: FolderNotesPlugin): void {
	const oldFolder = plugin.app.vault.getAbstractFileByPath(getFolderPathFromString(oldPath));
	if (oldFolder instanceof TFolder) {
		const folderNote = getFolderNote(plugin, oldFolder.path);
		if (!folderNote) {
			unmarkFolderAsFolderNote(oldFolder, plugin);
			hideFolderNoteInFileExplorer(oldFolder.path, plugin);
		}
	}
	const currentFolder = getFolder(plugin, file);
	if (currentFolder instanceof TFolder) {
		const folderNote = getFolderNote(plugin, currentFolder.path);
		if (folderNote) {
			markFolderWithFolderNoteClasses(currentFolder, plugin);
			markFileAsFolderNote(folderNote, plugin);
		}
	}
}

function handleFileRename(file: TFile, oldPath: string, plugin: FolderNotesPlugin): void {
	const oldFile = {
		name: getFileNameFromPathString(oldPath),
		path: oldPath,
		basename: removeExtension(getFileNameFromPathString(oldPath)),
		extension: getFileNameFromPathString(oldPath).split('.').pop() || '',
	};

	let oldFolder = getFolderNoteFolder(plugin, oldFile.path, oldFile.name);
	if (oldFolder instanceof TFile) {
		oldFolder = oldFolder.parent;
	}
	if (!oldFolder) { return; }

	const folder = plugin.app.vault.getAbstractFileByPath(oldFolder.path);
	if (!(folder instanceof TFolder)) { return; }

	let folderNote = getFolderNote(plugin, folder.path, undefined, file);
	if (!folderNote) {
		folderNote = getFolderNote(plugin, folder.path);
	}
	const excludedFolder = getExcludedFolder(plugin, folder.path);
	if (excludedFolder?.detached) { return; }

	const newFolderName = extractFolderName(plugin.settings.folderNoteName, file.basename);

	if (plugin.settings.syncFolderName && !excludedFolder?.disableSync && newFolderName && newFolderName !== folder.name) {
		renameFolder(plugin, file, folder, oldFile);
	} else {
		unmarkFileAsFolderNote(file, plugin);
		void updateCSSClassesForFolder(folder.path, plugin);
		Logger.getInstance().log('INFO', 'VAULT_SYNC', 'Note file renamed; updated folder styling', {
			oldPath,
			newPath: file.path,
			folder: folder.path,
			matchesTemplate: !!newFolderName,
		}, 'handleFileRename');
	}
}


function handleFolderRename(folder: TFolder, oldPath: string, plugin: FolderNotesPlugin): void {
	const logger = Logger.getInstance();
	const excludedFolder = getExcludedFolder(plugin, folder.path, false, true);
	if (excludedFolder?.detached) {
		logger.log('INFO', 'VAULT_SYNC', `Ignoring rename for detached folder: ${folder.path}`, undefined, 'handleFolderRename');
		return;
	}

	const oldFolderName = getFolderNameFromPathString(oldPath);
	const template = plugin.settings.folderNoteName;
	const oldNoteBaseName = template.includes('{{folder_name}}')
		? template.replace('{{folder_name}}', oldFolderName)
		: template;

	// Resolve the old note file based on storage location:
	// For insideFolder: the folder was already moved on disk by Obsidian, so the old note is inside folder.path
	// For parentFolder: the folder was renamed, but the note is in the parent directory of folder.path
	// For vaultFolder: the note is in the root directory
	let searchDir = folder.path;
	if (plugin.settings.storageLocation === 'parentFolder') {
		searchDir = getFolderPathFromString(folder.path);
	} else if (plugin.settings.storageLocation === 'vaultFolder') {
		searchDir = '/';
	}

	const oldNotePathWithoutExt = searchDir === '/' || searchDir === ''
		? oldNoteBaseName
		: `${searchDir}/${oldNoteBaseName}`;

	let searchFolderObj: TFolder | undefined = undefined;
	if (plugin.settings.storageLocation === 'insideFolder') {
		searchFolderObj = folder;
	} else if (plugin.settings.storageLocation === 'parentFolder' && folder.parent) {
		searchFolderObj = folder.parent;
	} else if (plugin.settings.storageLocation === 'vaultFolder') {
		const root = plugin.app.vault.getRoot?.();
		if (root instanceof TFolder) searchFolderObj = root;
	}

	const primaryType = normalizeFolderNoteType(plugin.settings.folderNoteType);
	const oldFolderNote = findFolderNoteFile(plugin, oldNotePathWithoutExt, primaryType, searchFolderObj);

	if (!oldFolderNote) {
		logger.log('WARN', 'VAULT_SYNC', `Old folder note not found on folder rename from "${oldPath}" to "${folder.path}"`, {
			oldFolderName,
			oldNoteBaseName,
			oldNotePathWithoutExt,
			storageLocation: plugin.settings.storageLocation,
			searchFolderChildren: searchFolderObj?.children?.map(c => c.name),
		}, 'handleFolderRename');
		return;
	}

	if (plugin.settings.syncFolderName && !excludedFolder?.disableSync) {
		const newNoteName = template.includes('{{folder_name}}')
			? template.replace('{{folder_name}}', folder.name)
			: template;

		// If the template does not contain {{folder_name}} and is insideFolder (e.g. index.md),
		// the file name doesn't change, it just moved with the folder.
		if (newNoteName === oldNoteBaseName && plugin.settings.storageLocation === 'insideFolder') {
			updateCSSClassesForFolder(folder.path, plugin);
			return;
		}

		let newPath = `${folder.path}/${newNoteName}.${oldFolderNote.extension}`;
		if (plugin.settings.storageLocation === 'parentFolder') {
			const parentPath = getFolderPathFromString(folder.path);
			if (parentPath.trim() === '' || parentPath === '/') {
				newPath = `${newNoteName}.${oldFolderNote.extension}`;
			} else {
				newPath = `${parentPath}/${newNoteName}.${oldFolderNote.extension}`;
			}
		} else if (plugin.settings.storageLocation === 'vaultFolder') {
			newPath = `${newNoteName}.${oldFolderNote.extension}`;
		}

		logger.log('INFO', 'VAULT_SYNC', `Renaming attached folder note from "${oldFolderNote.path}" to "${newPath}"`, {
			oldPath: oldFolderNote.path,
			newPath,
			folderPath: folder.path,
		}, 'handleFolderRename');

		plugin.app.fileManager.renameFile(oldFolderNote, newPath).then(() => {
			updateCSSClassesForFolder(folder.path, plugin);
		}).catch((err) => {
			logger.logError('handleFolderRename.renameFile', err, 'handleFolderRename');
		});
	} else {
		updateCSSClassesForFolder(folder.path, plugin);
	}
}

function renameFolder(
	plugin: FolderNotesPlugin,
	file: TFile,
	folder: TFolder,
	oldFile: { name: string; path: string; basename: string; extension: string },
): void {
	const newFolderName = extractFolderName(plugin.settings.folderNoteName, file.basename);
	if (!newFolderName || newFolderName === folder.name) return;

	let parentFolderPath = getFolderPathFromString(folder.path);
	let newFolderPath = `${parentFolderPath}/${newFolderName}`;
	if (parentFolderPath.trim() === '' || parentFolderPath === '/') {
		newFolderPath = newFolderName;
	}

	Logger.getInstance().log('INFO', 'VAULT_SYNC', `Renaming folder from "${folder.path}" to "${newFolderPath}" to sync with note file "${file.path}"`, {
		folderPath: folder.path,
		newFolderPath,
		notePath: file.path,
	}, 'renameFolder');

	plugin.app.fileManager.renameFile(folder, newFolderPath).then(() => {
		updateCSSClassesForFolder(newFolderPath, plugin);
	}).catch((err) => {
		Logger.getInstance().logError('renameFolder.renameFile', err, 'renameFolder');
	});
}

function updateExcludedFolderPath(folder: TFolder, oldPath: string, plugin: FolderNotesPlugin): void {
	const oldPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
	const newPrefix = folder.path.endsWith('/') ? folder.path : `${folder.path}/`;

	plugin.settings.excludeFolders.forEach((excludedFolder) => {
		if (excludedFolder.path === oldPath) {
			excludedFolder.path = folder.path;
		} else if (excludedFolder.path?.startsWith(oldPrefix)) {
			excludedFolder.path = newPrefix + excludedFolder.path.slice(oldPrefix.length);
		}
	});
	plugin.settings.whitelistFolders.forEach((whitelistedFolder) => {
		if (whitelistedFolder.path === oldPath) {
			whitelistedFolder.path = folder.path;
		} else if (whitelistedFolder.path?.startsWith(oldPrefix)) {
			whitelistedFolder.path = newPrefix + whitelistedFolder.path.slice(oldPrefix.length);
		}
	});
}

