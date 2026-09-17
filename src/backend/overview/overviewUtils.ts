import {
	type MarkdownPostProcessorContext,
	parseYaml,
	stringifyYaml,
	TFile,
	TFolder,
} from 'obsidian';
import type { defaultOverviewSettings, includeTypes } from '../types/overview';
import type FolderNotesPlugin from '../../main';
import { getFolder } from '../core/FolderNoteResolver';
import { vaultWriteQueue } from './VaultWriteQueue';

export function getFolderPathFromString(path: string): string {
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash < 0) {
		return '/';
	}
	const folderPath = path.substring(0, lastSlash);
	return folderPath === '' ? '/' : folderPath;
}

export function resolveSourceFolder(
	plugin: FolderNotesPlugin,
	folderPathSpec: string | undefined,
	sourceFile?: TFile,
): TFolder | null {
	const spec = (folderPathSpec || '').trim();
	if (spec === '' || spec === 'File’s parent folder path') {
		const parentPath = sourceFile ? getFolderPathFromString(sourceFile.path) : '/';
		if (parentPath === '/' || parentPath === '') {
			return plugin.app.vault.getRoot();
		}
		const folder = plugin.app.vault.getAbstractFileByPath(parentPath);
		return folder instanceof TFolder ? folder : null;
	}
	if (spec === 'Path of folder linked to the file') {
		if (!sourceFile) return null;
		const linkedFolder = getFolder(plugin, sourceFile);
		if (linkedFolder instanceof TFolder) return linkedFolder;
		// Fallback to parent folder if sourceFile is not yet named as a linked folder note
		const parentPath = getFolderPathFromString(sourceFile.path);
		if (parentPath === '/' || parentPath === '') {
			return plugin.app.vault.getRoot();
		}
		const folder = plugin.app.vault.getAbstractFileByPath(parentPath);
		return folder instanceof TFolder ? folder : null;
	}
	if (spec === '/') {
		return plugin.app.vault.getRoot();
	}
	const folder = plugin.app.vault.getAbstractFileByPath(spec);
	return folder instanceof TFolder ? folder : null;
}

const CODE_BLOCK_END_NOT_FOUND = -1;
const MAX_CODE_BLOCK_SEARCH_COUNT = 50;

export function getCodeBlockEndLine(text: string, startLine: number, count = 1): number {
	let line = startLine + 1;
	const lines = text.split(/\r?\n/);
	while (line < lines.length) {
		if (count > MAX_CODE_BLOCK_SEARCH_COUNT) {
			return CODE_BLOCK_END_NOT_FOUND;
		}
		if (lines[line].trimStart().startsWith('```')) {
			return line;
		}
		line++;
		count++;
	}
	return CODE_BLOCK_END_NOT_FOUND;
}

export function buildYamlConfig(
	yaml: Partial<defaultOverviewSettings> | undefined,
	defaultSettings: defaultOverviewSettings,
	ctx: MarkdownPostProcessorContext,
	includeTypesParam: includeTypes[],
): defaultOverviewSettings {
	return {
		id: yaml?.id ?? crypto.randomUUID(),
		folderPath:
			yaml?.folderPath?.trim() ??
			getFolderPathFromString(ctx.sourcePath),
		title: yaml?.title ?? defaultSettings.title,
		showTitle: yaml?.showTitle ?? defaultSettings.showTitle,
		depth: yaml?.depth ?? defaultSettings.depth,
		style: yaml?.style ?? defaultSettings.style ?? 'list',
		includeTypes: (includeTypesParam || defaultSettings.includeTypes || ['folder', 'markdown']).map((type) =>
			type.toLowerCase(),
		) as includeTypes[],
		disableFileTag:
			yaml?.disableFileTag ?? defaultSettings.disableFileTag,
		sortBy: yaml?.sortBy ?? defaultSettings.sortBy ?? 'name',
		sortByAsc: yaml?.sortByAsc ?? defaultSettings.sortByAsc ?? true,
		showEmptyFolders:
			yaml?.showEmptyFolders ?? defaultSettings.showEmptyFolders,
		onlyIncludeSubfolders:
			yaml?.onlyIncludeSubfolders ??
			defaultSettings.onlyIncludeSubfolders,
		storeFolderCondition:
			yaml?.storeFolderCondition ??
			defaultSettings.storeFolderCondition,
		showFolderNotes:
			yaml?.showFolderNotes ?? defaultSettings.showFolderNotes,
		disableCollapseIcon:
			yaml?.disableCollapseIcon ??
			defaultSettings.disableCollapseIcon,
		alwaysCollapse:
			yaml?.alwaysCollapse ?? defaultSettings.alwaysCollapse,
		autoSync: yaml?.autoSync ?? defaultSettings.autoSync ?? true,
		allowDragAndDrop:
			yaml?.allowDragAndDrop ?? defaultSettings.allowDragAndDrop,
		hideLinkList:
			yaml?.hideLinkList ?? defaultSettings.hideLinkList,
		hideFolderOverview:
			yaml?.hideFolderOverview ??
			defaultSettings.hideFolderOverview,
		useActualLinks:
			yaml?.useActualLinks ?? defaultSettings.useActualLinks,
		fmtpIntegration:
			yaml?.fmtpIntegration ?? defaultSettings.fmtpIntegration,
		titleSize: yaml?.titleSize ?? defaultSettings.titleSize ?? 1,
		isInCallout: yaml?.isInCallout ?? false,
		useWikilinks: yaml?.useWikilinks ?? defaultSettings.useWikilinks ?? true,
	};
}

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

export function getYamlBlocks(text: string, callout: boolean): RegExpMatchArray | null {
	return callout
		? text.match(/^>\s*```folder-overview\r?\n([\s\S]*?)```/gm)
		: text.match(/^(?!>).*```folder-overview\r?\n(?:^(?!>).*[\r\n]*)*?^```$/gm);
}

export function cleanYamlBlock(block: string, callout: boolean): string {
	if (callout) {
		const cleaned = block.replace(/^>\s*```folder-overview\r?\n/, '').replace(/```$/, '');
		return cleaned.replace(/^>\s?/gm, '');
	}
	return block.replace(/^```folder-overview\r?\n/, '').replace(/```$/, '');
}

export function buildNewBlock(stringYaml: string, calloutFlag: boolean): string {
	const trimmed = stringYaml.trim();
	if (calloutFlag) {
		const yamlLines = trimmed
			.split(/\r?\n/)
			.map((line) => `> ${line}`)
			.join('\n');
		return `> \`\`\`folder-overview\n${yamlLines}\n> \`\`\``;
	}
	return `\`\`\`folder-overview\n${trimmed}\n\`\`\``;
}


export async function updateYamlById(
	plugin: FolderNotesPlugin,
	overviewId: string,
	file: TFile,
	newYaml: defaultOverviewSettings,
	addLinkList: boolean,
	isCallout = false,
): Promise<void> {
	await vaultWriteQueue.enqueueProcess(plugin.app, file, (text) => {
		const yamlBlocks = getYamlBlocks(text, isCallout);
		if (!yamlBlocks) return text;

		let updatedText = text;
		for (const block of yamlBlocks) {
			const cleanedBlock = cleanYamlBlock(block, isCallout);
			const yaml = parseYaml(cleanedBlock);
			if (!yaml) continue;

			if (yaml.id === overviewId) {
				let stringYaml = stringifyYaml(newYaml);
				if (!stringYaml.endsWith('\n')) {
					stringYaml += '\n';
				}

				let newBlock = buildNewBlock(stringYaml, isCallout);

				const hasExistingLinkList = updatedText.includes(`class="fv-link-list-start" id="${newYaml.id}"`);
				if (addLinkList && !hasExistingLinkList) {
					newBlock += buildLinkListBlock(newYaml.id, isCallout);
				}

				updatedText = updatedText.replace(block, newBlock);
			}
		}
		return updatedText;
	});
}

export function replacePropertiesInTitle(
	title: string,
	frontmatter: Record<string, unknown>,
): string {
	const propertyRegex = /\{\{properties\.([\w-]+)\}\}/g;
	return title.replace(propertyRegex, (_, prop) => {
		const value = frontmatter[prop];
		return value !== undefined ? String(value) : '';
	});
}

export function replaceVariablesInTitle(
	title: string,
	variables: Record<string, string>,
): string {
	return title.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

export async function parseOverviewTitle(
	overview: defaultOverviewSettings,
	plugin: FolderNotesPlugin,
	sourceFolder: TFolder | null,
	sourceFolderPath: string,
	sourceFile: TFile,
): Promise<string> {
	let { title } = overview;
	let fmtpFileName = '';
	if (plugin.fmtpHandler) {
		try {
			fmtpFileName = (await plugin.fmtpHandler.getNewFileName(sourceFile)) ?? '';
		} catch {
			fmtpFileName = '';
		}
	}

	const variables: Record<string, string> = {
		folderName: sourceFolder?.path === '/' || sourceFolderPath === '/' || sourceFolderPath === ''
			? 'Vault'
			: sourceFolder?.name ?? '',
		folderPath: sourceFolder?.path ?? sourceFolderPath ?? '',
		filePath: sourceFile.path,
		fileName: sourceFile instanceof TFile ? sourceFile.basename : '',
		fmtpFileName,
	};

	const fileCache = plugin.app.metadataCache.getFileCache(sourceFile);
	const frontmatter = (fileCache?.frontmatter as Record<string, unknown>) ?? {};
	title = replacePropertiesInTitle(title, frontmatter);
	title = replaceVariablesInTitle(title, variables);

	return title;
}
