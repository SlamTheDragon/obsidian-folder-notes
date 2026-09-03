import { TFile, TFolder, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import { getDetachedFolder } from './ExcludeService';
import {
	getFolderNameFromPathString,
	getFolderPathFromString,
	removeExtension,
} from '../utils/pathUtils';

export function extractFolderName(template: string, name: string): string {
	if (!template.includes('{{folder_name}}')) {
		return name;
	}
	const regex = new RegExp(`^${template.replace('{{folder_name}}', '(.*)')}$`);
	const match = name.match(regex);
	return match ? match[1] : '';
}

export function normalizeFolderNoteType(type: string): string {
	return type === '.excalidraw' ? '.md' : type;
}

export function getFolderInfo(folderPath: string): { path: string; name: string } | null {
	if (!folderPath) return null;
	return {
		path: folderPath,
		name: getFolderNameFromPathString(folderPath),
	};
}

export function resolveFileName(
	plugin: FolderNotesPlugin,
	folder: { path: string; name: string },
	file?: TFile,
	oldFolderNoteName?: string,
): string | null {
	const templateName = oldFolderNoteName ?? plugin.settings.folderNoteName;
	if (!templateName) return null;
	const nameSource = file ? file.basename : folder.name;
	return templateName.replace('{{folder_name}}', nameSource);
}

export function adjustFolderPathForStorage(
	folder: { path: string; name: string },
	folderPath: string,
	plugin: FolderNotesPlugin,
	storageLocation?: string,
): void {
	if (
		(plugin.settings.storageLocation === 'parentFolder' ||
			storageLocation === 'parentFolder') &&
		storageLocation !== 'insideFolder'
	) {
		folder.path = getFolderPathFromString(folderPath);
	}
}

export function buildFullPath(folder: { path: string }, fileName: string): string {
	return folder.path === '/' ? fileName : `${folder.path}/${fileName}`;
}

export function findFolderNoteFile(
	plugin: FolderNotesPlugin,
	path: string,
	primaryType: string,
): TFile | null {
	let folderNote = plugin.app.vault.getAbstractFileByPath(path + primaryType);
	if (folderNote instanceof TFile) {
		return folderNote;
	}

	const supportedFileTypes = plugin.settings.supportedFileTypes || ['md', 'canvas'];
	for (let type of supportedFileTypes) {
		if (type === 'excalidraw' || type === '.excalidraw') {
			type = '.md';
		}
		if (!type.startsWith('.')) {
			type = '.' + type;
		}
		folderNote = plugin.app.vault.getAbstractFileByPath(path + type);
		if (folderNote instanceof TFile) {
			return folderNote;
		}
	}
	return null;
}

export function getFolderNote(
	plugin: FolderNotesPlugin,
	folderPath: string,
	storageLocation?: string,
	file?: TFile,
	oldFolderNoteName?: string,
): TFile | null | undefined {
	const folder = getFolderInfo(folderPath);
	if (!folder) return null;

	const fileName = resolveFileName(plugin, folder, file, oldFolderNoteName);
	if (!fileName) return null;

	adjustFolderPathForStorage(folder, folderPath, plugin, storageLocation);

	const path = buildFullPath(folder, fileName);
	const primaryType = normalizeFolderNoteType(plugin.settings.folderNoteType);

	return findFolderNoteFile(plugin, path, primaryType);
}

export function getFolder(
	plugin: FolderNotesPlugin,
	file: TFile,
	storageLocation?: string,
): TFolder | TAbstractFile | null {
	if (!file) return null;
	let folderName = extractFolderName(plugin.settings.folderNoteName, file.basename);
	if (
		plugin.settings.folderNoteName === file.basename &&
		plugin.settings.storageLocation === 'insideFolder'
	) {
		folderName = file.parent?.name ?? '';
	}
	if (!folderName) return null;
	let folderPath = getFolderPathFromString(file.path);
	let folder: TFolder | TAbstractFile | null = null;

	if (
		(plugin.settings.storageLocation === 'parentFolder' ||
			storageLocation === 'parentFolder') &&
		storageLocation !== 'insideFolder'
	) {
		if (folderPath.trim() === '' || folderPath === '/') {
			folderPath = folderName;
		} else {
			folderPath = `${folderPath}/${folderName}`;
		}
		folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	} else {
		folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	}

	if (!folder) { return null; }
	return folder;
}

export function getFolderNoteFolder(
	plugin: FolderNotesPlugin,
	folderNote: TFile | string,
	fileName: string,
): TFolder | TAbstractFile | null {
	if (!folderNote) return null;
	let filePath = '';
	if (typeof folderNote === 'string') {
		filePath = folderNote;
	} else {
		fileName = folderNote.basename;
		filePath = folderNote.path;
	}
	const folderName = extractFolderName(plugin.settings.folderNoteName, fileName);
	if (!plugin.settings.folderNoteName.includes('{{folder_name}}') && plugin.settings.storageLocation === 'insideFolder') {
		if (folderNote instanceof TFile) {
			return folderNote.parent;
		}
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		return file instanceof TFile ? file.parent : null;
	}
	if (!folderName) return null;
	let folderPath = getFolderPathFromString(filePath);
	if (plugin.settings.storageLocation === 'parentFolder') {
		if (folderPath.trim() === '') {
			folderPath = folderName;
		} else {
			folderPath = `${folderPath}/${folderName}`;
		}
	} else {
		folderPath = getFolderPathFromString(filePath);
	}
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) { return null; }
	return folder;
}

export function getArgs(
	plugin: FolderNotesPlugin,
	folderPath: string,
	extension?: string,
	preexistingNote?: TFile,
): {
	leaf: WorkspaceLeaf;
	fileName: string;
	folderNote: TFile | null | undefined;
	folderNoteType: string;
	detachedFolder: any;
	path: string;
} {
	let folderNoteType = extension || plugin.settings.folderNoteType;
	let fileName = getFolderNameFromPathString(folderPath);
	if (plugin.settings.folderNoteName !== '{{folder_name}}') {
		fileName = plugin.settings.folderNoteName.replace('{{folder_name}}', fileName);
	}
	let folderNote = preexistingNote ?? getFolderNote(plugin, folderPath);
	const detachedFolder = getDetachedFolder(plugin, folderPath);
	let path = '';
	if (!folderNoteType.startsWith('.')) {
		folderNoteType = '.' + folderNoteType;
	}
	let leaf = plugin.app.workspace.getLeaf(plugin.settings.openInNewTab ? 'tab' : false);
	if (plugin.settings.focusExistingTab) {
		plugin.app.workspace.iterateAllLeaves((x) => {
			if ((x.view as any)?.file?.path === folderNote?.path) {
				leaf = x;
			}
		});
	}
	return {
		leaf,
		fileName,
		folderNote,
		folderNoteType,
		detachedFolder,
		path,
	};
}
