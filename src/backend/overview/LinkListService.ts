import { TFile, TFolder, type TAbstractFile } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings } from '../types/overview';
import { getFolderNote } from '../core/FolderNoteResolver';
import { filterFiles, sortFiles } from './FolderOverviewLogic';
import { vaultWriteQueue } from './VaultWriteQueue';

export function buildLinkListBlock(id: string, calloutFlag: boolean): string {
	if (calloutFlag) {
		return (
			'\n> <span class="fv-link-list-start" id="' +
			id +
			'"></span>\n> <span class="fv-link-list-end" id="' +
			id +
			'"></span>'
		);
	}

	return (
		'\n<span class="fv-link-list-start" id="' +
		id +
		'"></span>\n<span class="fv-link-list-end" id="' +
		id +
		'"></span>'
	);
}

export async function updateLinkList(
	files: TAbstractFile[] = [],
	plugin: FolderNotesPlugin,
	yaml: defaultOverviewSettings,
	pathBlacklist: string[],
	sourceFile: TFile,
): Promise<void> {
	if (!(sourceFile instanceof TFile)) return;

	const fileLinks = await buildLinkList(files, plugin, yaml, pathBlacklist, sourceFile);

	await vaultWriteQueue.enqueueProcess(plugin.app, sourceFile, (text) => {
		const lines = text.split(/\r?\n/);
		const prefix = yaml.isInCallout ? '> ' : '';
		const startMarker = `${prefix}<span class="fv-link-list-start" id="${yaml.id}"></span>`;
		const endMarker = `${prefix}<span class="fv-link-list-end" id="${yaml.id}"></span>`;

		const startIdx = lines.findIndex((l) => l.trim() === startMarker.trim());
		const endIdx = lines.findIndex((l) => l.trim() === endMarker.trim());

		const NOT_FOUND = -1;
		const linkListExists = startIdx !== NOT_FOUND && endIdx !== NOT_FOUND;
		const isInvalidLinkList = endIdx < startIdx;
		if (!linkListExists || isInvalidLinkList) {
			return text;
		}

		lines.splice(startIdx, endIdx - startIdx + 1);

		const newBlock = [
			startMarker,
			...fileLinks,
			endMarker,
		];
		lines.splice(startIdx, 0, ...newBlock);

		return lines.join('\n');
	});
}

export async function buildLinkList(
	items: TAbstractFile[],
	plugin: FolderNotesPlugin,
	yaml: defaultOverviewSettings,
	pathBlacklist: string[],
	sourceFile: TFile,
	indent = 0,
): Promise<string[]> {
	const result: string[] = [];
	const filtered = (
		await filterFiles(
			items,
			plugin,
			yaml.folderPath,
			yaml.depth,
			pathBlacklist,
			yaml,
			sourceFile,
		)
	).filter((file): file is TAbstractFile => file !== null);

	const sorted = sortFiles(filtered, yaml, plugin);

	for (const item of sorted) {
		const indentStr = '\t'.repeat(indent);

		if (item instanceof TFile) {
			result.push(buildFileLinkListLine(item, yaml, indentStr));
		} else if (item instanceof TFolder) {
			const folderLines = await buildFolderLinkListLines(
				item,
				plugin,
				yaml,
				pathBlacklist,
				sourceFile,
				indentStr,
				indent,
			);
			result.push(...folderLines);
		}
	}
	return result;
}

function buildFileLinkListLine(
	item: TFile,
	yaml: defaultOverviewSettings,
	indentStr: string,
): string {
	const prefix = yaml.isInCallout ? '> ' : '';
	// Standard wikilink without raw .md extension to preserve Obsidian graph and rename tracking
	const linkTarget = item.path.endsWith('.md')
		? item.path.slice(0, -3)
		: item.path;

	let base: string;
	if (yaml.useWikilinks) {
		base = `${prefix}${indentStr}- [[${linkTarget}|${item.basename}]]`;
	} else {
		base = `${prefix}${indentStr}- [${item.basename}](${encodeURI(item.path)})`;
	}

	if (yaml.hideLinkList) {
		return `${base} <span class="fv-link-list-item"></span>`;
	}
	return base;
}

async function buildFolderLinkListLines(
	item: TFolder,
	plugin: FolderNotesPlugin,
	yaml: defaultOverviewSettings,
	pathBlacklist: string[],
	sourceFile: TFile,
	indentStr: string,
	indent: number,
): Promise<string[]> {
	const lines: string[] = [];
	const prefix = yaml.isInCallout ? '> ' : '';
	let line = `${prefix}${indentStr}- ${item.name}`;
	let folderNote: TFile | null | undefined = null;

	if (plugin) {
		folderNote = getFolderNote(plugin, item.path);
	}

	if (folderNote) {
		const linkTarget = folderNote.path.endsWith('.md')
			? folderNote.path.slice(0, -3)
			: folderNote.path;

		if (yaml.useWikilinks) {
			line = `${prefix}${indentStr}- [[${linkTarget}|${item.name}]]`;
		} else {
			line = `${prefix}${indentStr}- [${item.name}](${encodeURI(folderNote.path)})`;
		}
	}

	if (yaml.hideLinkList) {
		line += ' <span class="fv-link-list-item"></span>';
	}
	lines.push(line);

	const children = item.children.filter(
		(child) => !(child instanceof TFile && folderNote && child.path === folderNote.path),
	);
	if (children.length > 0) {
		const childLinks = await buildLinkList(
			children,
			plugin,
			yaml,
			pathBlacklist,
			sourceFile,
			indent + 1,
		);
		lines.push(...childLinks);
	}
	return lines;
}

export async function removeLinkList(
	plugin: FolderNotesPlugin,
	sourceFile: TFile | undefined,
	yaml: defaultOverviewSettings,
): Promise<void> {
	if (!sourceFile || !(sourceFile instanceof TFile)) return;

	await vaultWriteQueue.enqueueProcess(plugin.app, sourceFile, (text) => {
		const lines = text.split(/\r?\n/);
		const prefix = yaml.isInCallout ? '> ' : '';
		const startMarker = `${prefix}<span class="fv-link-list-start" id="${yaml.id}"></span>`;
		const endMarker = `${prefix}<span class="fv-link-list-end" id="${yaml.id}"></span>`;

		const startIdx = lines.findIndex((l) => l.trim() === startMarker.trim());
		const endIdx = lines.findIndex((l) => l.trim() === endMarker.trim());

		const NOT_FOUND = -1;
		const linkListExists = startIdx !== NOT_FOUND && endIdx !== NOT_FOUND;
		const isInvalidLinkList = endIdx < startIdx;

		if (!linkListExists || isInvalidLinkList) {
			return text;
		}

		lines.splice(startIdx, endIdx - startIdx + 1);
		return lines.join('\n');
	});
}
