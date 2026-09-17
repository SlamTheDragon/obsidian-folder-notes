import type FolderNotesPlugin from '../../main';
import { getFolderNameFromPathString, getFolderPathFromString } from '../utils/pathUtils';
import {
	type ExcludedFolder,
	type ExcludePattern,
	type WhitelistedFolder,
	type WhitelistedPattern,
} from '../types/exclude';

const REGEX_PREFIX = '{regex}';
const STAR = '*';
const SLICE_START_ONE = 1;
const SLICE_EXCLUDE_LAST = -1;

export function matchesPatternSpec(raw: string | undefined, folderName: string): boolean {
	if (!raw) return false;
	const string = raw.trim();
	const isRegex = string.startsWith(REGEX_PREFIX);
	const hasStartStar = string.startsWith(STAR);
	const hasEndStar = string.endsWith(STAR);
	if (!isRegex && !(hasStartStar || hasEndStar)) return false;

	if (isRegex) {
		const body = string.replace(REGEX_PREFIX, '').trim();
		if (body === '') return false;
		try {
			return new RegExp(body).test(folderName);
		} catch {
			return false;
		}
	}

	if (hasStartStar && hasEndStar) {
		const inner = string.slice(SLICE_START_ONE, SLICE_EXCLUDE_LAST);
		return folderName.includes(inner);
	}
	if (hasStartStar) {
		const suffix = string.slice(SLICE_START_ONE);
		return folderName.endsWith(suffix);
	}
	if (hasEndStar) {
		const prefix = string.slice(0, SLICE_EXCLUDE_LAST);
		return folderName.startsWith(prefix);
	}
	return false;
}

export function getExcludedFoldersByPattern(
	plugin: FolderNotesPlugin,
	folderName: string,
): ExcludePattern[] {
	return (plugin.settings?.excludeFolders || [])
		.filter((s: any) => s.type === 'pattern')
		.filter((pattern: any) => matchesPatternSpec(pattern.string, folderName)) as ExcludePattern[];
}

export function getExcludedFolderByPattern(
	plugin: FolderNotesPlugin,
	folderName: string,
): ExcludePattern | undefined {
	return (
		(plugin.settings?.excludeFolders || [])
			.filter((s: any) => s.type === 'pattern')
			.find((pattern: any) => matchesPatternSpec(pattern.string, folderName))
	) as ExcludePattern | undefined;
}


function isPathWithinFolder(targetPath: string, folderPath: string): boolean {
	if (targetPath === folderPath) return true;
	const folderWithSlash = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
	return targetPath.startsWith(folderWithSlash);
}

export function getExcludedFolderByPath(
	plugin: FolderNotesPlugin,
	path: string,
): ExcludedFolder | ExcludePattern | undefined {
	return (plugin.settings?.excludeFolders || []).find((excludeFolder: any) => {
		if (excludeFolder.path === path) { return true; }
		if (!excludeFolder.subFolders) { return false; }
		return isPathWithinFolder(getFolderPathFromString(path), excludeFolder.path);
	}) as ExcludedFolder | ExcludePattern | undefined;
}

export function getExcludedFoldersByPath(
	plugin: FolderNotesPlugin,
	path: string,
): Array<ExcludedFolder | ExcludePattern> {
	return (plugin.settings?.excludeFolders || []).filter((excludeFolder: any) => {
		if (excludeFolder.path === path) { return true; }
		if (!excludeFolder.subFolders) { return false; }
		return isPathWithinFolder(getFolderPathFromString(path), excludeFolder.path);
	}) as Array<ExcludedFolder | ExcludePattern>;
}

export function getWhitelistedFoldersByPattern(
	plugin: FolderNotesPlugin,
	folderName: string,
): WhitelistedPattern[] {
	return (plugin.settings?.whitelistFolders || [])
		.filter((s: any) => s.type === 'pattern')
		.filter((pattern: any) => matchesPatternSpec(pattern.string, folderName)) as WhitelistedPattern[];
}

export function getWhitelistedFolderByPattern(
	plugin: FolderNotesPlugin,
	folderName: string,
): WhitelistedPattern | undefined {
	return (
		(plugin.settings?.whitelistFolders || [])
			.filter((s: any) => s.type === 'pattern')
			.find((pattern: any) => matchesPatternSpec(pattern.string, folderName))
	) as WhitelistedPattern | undefined;
}

export function getWhitelistedFoldersByPath(
	plugin: FolderNotesPlugin,
	path: string,
): Array<WhitelistedFolder | WhitelistedPattern> {
	return (plugin.settings?.whitelistFolders || []).filter((whitelistedFolder: any) => {
		if (whitelistedFolder.path === path) { return true; }
		if (!whitelistedFolder.subFolders) { return false; }
		return isPathWithinFolder(getFolderPathFromString(path), whitelistedFolder.path);
	}) as Array<WhitelistedFolder | WhitelistedPattern>;
}

export function getWhitelistedFolderByPath(
	plugin: FolderNotesPlugin,
	path: string,
): WhitelistedFolder | WhitelistedPattern | undefined {
	return (plugin.settings?.whitelistFolders || []).find((whitelistedFolder: any) => {
		if (whitelistedFolder.path === path) { return true; }
		if (!whitelistedFolder.subFolders) { return false; }
		return isPathWithinFolder(getFolderPathFromString(path), whitelistedFolder.path);
	}) as WhitelistedFolder | WhitelistedPattern | undefined;
}



export function getWhitelistedFolder(
	plugin: FolderNotesPlugin,
	path: string,
): WhitelistedFolder | WhitelistedPattern | undefined {
	let whitelistedFolder: Partial<WhitelistedFolder> | undefined = {};
	const folderName = getFolderNameFromPathString(path);
	const matchedPatterns = getWhitelistedFoldersByPattern(plugin, folderName);
	const whitelistedFolders = getWhitelistedFoldersByPath(plugin, path);
	const combinedWhitelistedFolders = [...matchedPatterns, ...whitelistedFolders];
	const propertiesToCopy: (keyof WhitelistedFolder)[] = [
		'enableAutoCreate' as any,
		'enableFolderNote' as any,
		'enableSync' as any,
		'showInFolderOverview' as any,
	];

	if (combinedWhitelistedFolders.length > 0) {
		for (const matchedFolder of combinedWhitelistedFolders) {
			propertiesToCopy.forEach((property) => {
				const value = (matchedFolder as any)[property];
				if (value === true) {
					(whitelistedFolder as any)[property] = true;
				} else if (!value) {
					(whitelistedFolder as any)[property] = false;
				}
			});
		}
	}

	if (whitelistedFolder && Object.keys(whitelistedFolder).length === 0) {
		whitelistedFolder = undefined;
	}

	return whitelistedFolder as WhitelistedFolder | WhitelistedPattern | undefined;
}

function combineExcluded(
	plugin: FolderNotesPlugin,
	path: string,
	includeDetached: boolean,
	pathOnly?: boolean,
): Array<ExcludedFolder | ExcludePattern> {
	const folderName = getFolderNameFromPathString(path);
	const matchedPatterns = pathOnly ? [] : getExcludedFoldersByPattern(plugin, folderName);
	const excludedByPath = getExcludedFoldersByPath(plugin, path);
	let combined = [...matchedPatterns, ...excludedByPath];
	if (!includeDetached) combined = combined.filter((f: any) => !f.detached);
	return combined;
}

function aggregateFlags(
	combinedExcludedFolders: Array<ExcludedFolder | ExcludePattern>,
): Partial<ExcludedFolder> | undefined {
	if (combinedExcludedFolders.length === 0) return undefined;
	const result: Partial<ExcludedFolder> = {};
	const propertiesToCopy: (keyof ExcludedFolder)[] = [
		'disableAutoCreate',
		'disableFolderNote',
		'disableSync',
		'enableCollapsing',
		'excludeFromFolderOverview',
		'detached' as any,
		'hideInSettings' as any,
		'id' as any,
		'showFolderNote' as any,
	];
	for (const matchedFolder of combinedExcludedFolders) {
		for (const property of propertiesToCopy) {
			const value = (matchedFolder as any)[property];
			if (value === true) {
				(result as any)[property] = true;
			} else if (!value) {
				(result as any)[property] = false;
			}
		}
	}
	return result;
}

function applyWhitelistOverrides(
	excluded: Partial<ExcludedFolder>,
	whitelisted: WhitelistedFolder | WhitelistedPattern,
): Partial<ExcludedFolder> {
	const out: Partial<ExcludedFolder> = { ...excluded };
	const wl = whitelisted as any;
	if (out.disableAutoCreate !== undefined) {
		out.disableAutoCreate = !wl.enableAutoCreate;
	}
	if (out.disableFolderNote !== undefined) {
		out.disableFolderNote = !wl.enableFolderNote;
	}
	if (out.disableSync !== undefined) {
		out.disableSync = !wl.enableSync;
	}
	out.enableCollapsing = !wl.disableCollapsing;
	if (out.excludeFromFolderOverview !== undefined) {
		out.excludeFromFolderOverview = !wl.showInFolderOverview;
	}
	(out as any).showFolderNote = !wl.hideInFileExplorer;
	return out;
}

function defaultExcludedIfEmpty(
	value: Partial<ExcludedFolder> | undefined,
): ExcludedFolder | undefined {
	if (value && Object.keys(value).length === 0) {
		return {
			type: 'folder',
			id: '',
			path: '',
			string: '',
			subFolders: false,
			disableSync: false,
			disableAutoCreate: false,
			disableFolderNote: false,
			enableCollapsing: false,
			position: 0,
			excludeFromFolderOverview: false,
			hideInSettings: false,
			detached: false,
		} as any;
	}
	return value as ExcludedFolder | undefined;
}

export function getExcludedFolder(
	plugin: FolderNotesPlugin,
	path: string,
	includeDetached = false,
	pathOnly = false,
): ExcludedFolder | undefined {
	const combined = combineExcluded(plugin, path, includeDetached, pathOnly);
	let excluded = aggregateFlags(combined);
	const whitelisted = getWhitelistedFolder(plugin, path);
	if (whitelisted && excluded) {
		excluded = applyWhitelistOverrides(excluded, whitelisted);
	}
	return defaultExcludedIfEmpty(excluded);
}

export function getDetachedFolder(
	plugin: FolderNotesPlugin,
	path: string,
): ExcludedFolder | undefined {
	const folderName = getFolderNameFromPathString(path);
	const matchedPatterns = getExcludedFoldersByPattern(plugin, folderName);
	const excludedByPath = getExcludedFoldersByPath(plugin, path);
	const combined = [...matchedPatterns, ...excludedByPath];
	return combined.find((f: any) => f.detached) as ExcludedFolder | undefined;
}

export function addExcludedFolder(
	plugin: FolderNotesPlugin,
	excludeFolder: ExcludedFolder | ExcludePattern,
	save = true,
): void {
	plugin.settings.excludeFolders.push(excludeFolder);
	if (save) void plugin.saveSettings(true);
}

export function updateExcludedFolder(
	plugin: FolderNotesPlugin,
	excludeFolder: ExcludedFolder,
	newExcludedFolder: ExcludedFolder,
): void {
	plugin.settings.excludeFolders = plugin.settings.excludeFolders.filter(
		(folder: any) => folder.id !== excludeFolder.id,
	);
	addExcludedFolder(plugin, newExcludedFolder);
}

export async function deleteExcludedFolder(
	plugin: FolderNotesPlugin,
	excludeFolder: ExcludedFolder | ExcludePattern,
): Promise<void> {
	plugin.settings.excludeFolders = plugin.settings.excludeFolders.filter(
		(folder: any) => folder.id !== excludeFolder.id,
	);
	await plugin.saveSettings(true);
	resyncArray(plugin);
}

export function resyncArray(plugin: FolderNotesPlugin): void {
	plugin.settings.excludeFolders.forEach((folder: any, index: number) => {
		folder.position = index;
	});
	plugin.settings.whitelistFolders.forEach((folder: any, index: number) => {
		folder.position = index;
	});
}

export function addWhitelistedFolder(
	plugin: FolderNotesPlugin,
	whitelistedFolder: WhitelistedFolder | WhitelistedPattern,
): void {
	plugin.settings.whitelistFolders.push(whitelistedFolder);
	void plugin.saveSettings(true);
}

export async function deleteWhitelistedFolder(
	plugin: FolderNotesPlugin,
	whitelistedFolder: WhitelistedFolder | WhitelistedPattern,
): Promise<void> {
	plugin.settings.whitelistFolders = plugin.settings.whitelistFolders.filter(
		(folder: any) => folder.id !== whitelistedFolder.id,
	);
	await plugin.saveSettings(true);
	resyncArray(plugin);
}


export function updateWhitelistedFolder(
	plugin: FolderNotesPlugin,
	whitelistedFolder: WhitelistedFolder,
	newWhitelistFolder: WhitelistedFolder,
): void {
	plugin.settings.whitelistFolders = plugin.settings.whitelistFolders.filter(
		(folder: any) => folder.id !== whitelistedFolder.id,
	);
	addWhitelistedFolder(plugin, newWhitelistFolder);
}
