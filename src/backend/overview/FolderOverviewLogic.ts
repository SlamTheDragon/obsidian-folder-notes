import {
	type MarkdownPostProcessorContext,
	parseYaml,
	stringifyYaml,
	type TAbstractFile,
	TFile,
	TFolder,
} from 'obsidian';
import type { defaultOverviewSettings, includeTypes } from '../types/overview';
import type FolderNotesPlugin from '../../main';
import { getExcludedFolder } from '../core/ExcludeService';
import {
	getFolderPathFromString,
	getCodeBlockEndLine,
	getYamlBlocks,
	cleanYamlBlock,
	buildNewBlock,
	buildLinkListBlock,
	updateYamlById,
} from './overviewUtils';
import { vaultWriteQueue } from './VaultWriteQueue';

export function sortFiles(
	files: TAbstractFile[],
	yaml: defaultOverviewSettings,
	plugin?: FolderNotesPlugin,
): TAbstractFile[] {
	const sortBy = yaml?.sortBy ?? plugin?.settings?.defaultOverview?.sortBy ?? 'name';
	const sortByAsc = yaml?.sortByAsc ?? plugin?.settings?.defaultOverview?.sortByAsc ?? true;

	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

	const FOLDER_FIRST = -1;
	const FILE_FIRST = 1;
	const EQUAL = 0;

	function compareFilesAndFolders(a: TAbstractFile, b: TAbstractFile): number {
		const aIsFolder = a instanceof TFolder;
		const bIsFolder = b instanceof TFolder;
		const aIsFile = a instanceof TFile;
		const bIsFile = b instanceof TFile;

		if (aIsFolder && !bIsFolder) {
			return FOLDER_FIRST;
		}

		if (!aIsFolder && bIsFolder) {
			return FILE_FIRST;
		}

		if (aIsFolder && bIsFolder) {
			return sortByAsc
				? collator.compare(a.name, b.name)
				: collator.compare(b.name, a.name);
		}

		if (aIsFile && bIsFile) {
			return compareFiles(a, b);
		}

		return EQUAL;
	}

	function compareFiles(a: TFile, b: TFile): number {
		if (sortBy === 'created') {
			return sortByAsc ? a.stat.ctime - b.stat.ctime : b.stat.ctime - a.stat.ctime;
		} else if (sortBy === 'modified') {
			return sortByAsc ? a.stat.mtime - b.stat.mtime : b.stat.mtime - a.stat.mtime;
		} else if (sortBy === 'name') {
			return sortByAsc
				? collator.compare(a.basename, b.basename)
				: collator.compare(b.basename, a.basename);
		}
		return 0;
	}

	const sorted = [...files];
	sorted.sort(compareFilesAndFolders);
	return sorted;
}

export async function filterFiles(
	files: TAbstractFile[],
	plugin: FolderNotesPlugin,
	sourceFolderPath: string,
	depth: number,
	pathBlacklist: string[],
	yaml: defaultOverviewSettings,
	sourceFile: TFile | undefined,
): Promise<TAbstractFile[]> {
	const filteredFiles = await Promise.all(
		files.map(async (file) =>
			filterSingleFile(
				file,
				plugin,
				sourceFolderPath,
				depth,
				pathBlacklist,
				yaml,
				sourceFile,
			),
		),
	);

	return filteredFiles.filter((file): file is TAbstractFile => file !== null);
}

async function filterSingleFile(
	file: TAbstractFile,
	plugin: FolderNotesPlugin,
	sourceFolderPath: string,
	depth: number,
	pathBlacklist: string[],
	yaml: defaultOverviewSettings,
	sourceFile: TFile | undefined,
): Promise<TAbstractFile | null> {
	const folderPath = getFolderPathFromString(file.path);
	const dontShowFolderNote = pathBlacklist.includes(file.path);
	const isSubfolder = isFileInSubfolder(sourceFolderPath, folderPath);
	const isSourceFile = sourceFile ? file.path === sourceFile.path : false;
	const isFile = file instanceof TFile;
	const includeTypes = yaml.includeTypes || [];
	const extension = isFile ? file.extension.toLowerCase() : '';

	const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
	const videoTypes = ['mp4', 'webm', 'ogv', 'mov', 'mkv'];
	const audioTypes = ['mp3', 'wav', 'm4a', '3gp', 'flac', 'ogg', 'oga', 'opus'];

	if (isFile && !isFileTypeIncluded(extension, includeTypes, imageTypes, videoTypes, audioTypes)) {
		return null;
	}

	const isExcludedFromOverview = await getIsExcludedFromOverview(plugin, file);

	if (
		shouldExcludeFile(
			dontShowFolderNote,
			yaml.showFolderNotes,
			isSubfolder,
			isSourceFile,
			isExcludedFromOverview,
		)
	) {
		return null;
	}

	const fileDepth = getFileDepth(file.path, sourceFolderPath);
	return fileDepth <= depth ? file : null;
}

export function isFileTypeIncluded(
	extension: string,
	includeTypes: includeTypes[],
	imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
	videoTypes = ['mp4', 'webm', 'ogv', 'mov', 'mkv'],
	audioTypes = ['mp3', 'wav', 'm4a', '3gp', 'flac', 'ogg', 'oga', 'opus'],
): boolean {
	if (includeTypes.length === 0 || includeTypes.includes('all')) return true;
	if ((extension === 'md' || extension === 'markdown') && includeTypes.includes('markdown')) return true;
	if (extension === 'canvas' && includeTypes.includes('canvas')) return true;
	if (extension === 'pdf' && includeTypes.includes('pdf')) return true;
	if (imageTypes.includes(extension) && includeTypes.includes('image')) return true;
	if (videoTypes.includes(extension) && includeTypes.includes('video')) return true;
	if (audioTypes.includes(extension) && includeTypes.includes('audio')) return true;
	if (
		includeTypes.includes('other') &&
		!['md', 'markdown', 'canvas', 'pdf', ...imageTypes, ...videoTypes, ...audioTypes].includes(extension)
	) {
		return true;
	}
	return false;
}

export function isFileInSubfolder(sourceFolderPath: string, folderPath: string): boolean {
	if (sourceFolderPath === '/' || sourceFolderPath === '') return true;
	if (folderPath === sourceFolderPath) return true;
	const prefix = sourceFolderPath.endsWith('/') ? sourceFolderPath : `${sourceFolderPath}/`;
	return folderPath.startsWith(prefix);
}

export async function getIsExcludedFromOverview(
	plugin: FolderNotesPlugin,
	file: TAbstractFile,
): Promise<boolean> {
	if (plugin) {
		const excluded = getExcludedFolder(plugin, file.path, true);
		return excluded?.excludeFromFolderOverview ?? false;
	}
	return false;
}

export function shouldExcludeFile(
	dontShowFolderNote: boolean,
	showFolderNotes: boolean,
	isSubfolder: boolean,
	isSourceFile: boolean,
	isExcludedFromOverview: boolean,
): boolean {
	return (
		(dontShowFolderNote && !showFolderNotes) ||
		!isSubfolder ||
		isSourceFile ||
		isExcludedFromOverview
	);
}

export function getFileDepth(filePath: string, sourceFolderPath: string): number {
	const normalizedSource = sourceFolderPath === '/' || sourceFolderPath === '' ? '' : sourceFolderPath;
	const sourceSegments = normalizedSource ? normalizedSource.split('/').length : 0;
	const fileSegments = filePath.split('/').length;
	return fileSegments - sourceSegments;
}

export function getAllFiles(
	files: TAbstractFile[],
	sourceFolderPath: string,
	depth: number,
): TAbstractFile[] {
	const allFiles: TAbstractFile[] = [];

	const getDepth = (filePath: string): number => {
		const normalizedSource = sourceFolderPath === '/' || sourceFolderPath === '' ? '' : sourceFolderPath;
		const sourceSegments = normalizedSource ? normalizedSource.split('/').length : 0;
		return filePath.split('/').length - sourceSegments;
	};

	files.forEach((file) => {
		const fileDepth = getDepth(file.path);

		if (file instanceof TFolder) {
			if (fileDepth < depth) {
				allFiles.push(...getAllFiles(file.children, sourceFolderPath, depth));
			}
		} else {
			allFiles.push(file);
		}
	});

	return allFiles;
}

export async function getOverviews(
	plugin: FolderNotesPlugin,
	file: TFile | null,
): Promise<defaultOverviewSettings[]> {
	if (!file) return [];
	const overviews: defaultOverviewSettings[] = [];
	const content = await plugin.app.vault.read(file);
	if (!content) return overviews;

	const calloutYamlBlocks = content.match(/^>\s*```folder-overview\r?\n([\s\S]*?)```/gm);
	if (calloutYamlBlocks) {
		for (const block of calloutYamlBlocks) {
			const cleanedBlock = block
				.replace(/^>\s*```folder-overview\r?\n/, '')
				.replace(/```$/, '')
				.replace(/^>\s?/gm, '');
			const yaml = parseYaml(cleanedBlock);
			if (yaml) {
				yaml.isInCallout = true;
				overviews.push(yaml);
			}
		}
	}

	const regularYamlBlocks = content.match(/^(?!>).*```folder-overview\r?\n(?:^(?!>).*[\r\n]*)*?^```$/gm);
	if (regularYamlBlocks) {
		for (const block of regularYamlBlocks) {
			const cleanedBlock = block.replace(/^```folder-overview\r?\n/, '').replace(/```$/, '');
			const yaml = parseYaml(cleanedBlock);
			if (yaml) {
				yaml.isInCallout = false;
				overviews.push(yaml);
			}
		}
	}

	return overviews;
}

export async function hasOverviewYaml(
	plugin: FolderNotesPlugin,
	file: TFile,
): Promise<boolean> {
	const content = await plugin.app.vault.read(file);
	if (!content) return false;
	const yamlBlocks = content.match(/```folder-overview\r?\n([\s\S]*?)```/g);
	return !!yamlBlocks;
}

export async function updateYaml(
	plugin: FolderNotesPlugin,
	ctx: MarkdownPostProcessorContext | undefined,
	el: HTMLElement | undefined,
	yaml: defaultOverviewSettings,
	addLinkList: boolean,
): Promise<void> {
	if (!ctx) return;
	const NO_CODEBLOCK_END = -1;
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(file instanceof TFile)) return;

	let stringYaml = stringifyYaml(yaml);
	if (!stringYaml.endsWith('\n')) {
		stringYaml += '\n';
	}

	await vaultWriteQueue.enqueueProcess(plugin.app, file, async (text) => {
		const isCallout = yaml.isInCallout ?? false;
		const info = el ? ctx.getSectionInfo(el) : null;
		if (info) {
			const { lineStart } = info;
			const lineEnd = getCodeBlockEndLine(text, lineStart);
			if (lineEnd === NO_CODEBLOCK_END || lineEnd === undefined) return text;
			const lineLength = lineEnd - lineStart;
			const lines = text.split(/\r?\n/);
			let overviewBlock = buildNewBlock(stringYaml, isCallout);
			if (addLinkList) {
				overviewBlock += buildLinkListBlock(yaml.id, isCallout);
			}
			lines.splice(lineStart, lineLength + 1, overviewBlock);
			return lines.join('\n');
		}

		// Fallback: update by ID
		const overviews = await getOverviews(plugin, file);
		let updatedText = text;
		for (const overview of overviews) {
			if (overview.id === yaml.id) {
				const blockIsCallout = overview.isInCallout ?? false;
				const yamlBlocks = getYamlBlocks(updatedText, blockIsCallout);
				if (yamlBlocks) {
					for (const block of yamlBlocks) {
						const cleaned = cleanYamlBlock(block, blockIsCallout);
						const parsed = parseYaml(cleaned);
						if (parsed?.id === yaml.id) {
							let newBlock = buildNewBlock(stringYaml, blockIsCallout);
							if (addLinkList) {
								newBlock += buildLinkListBlock(yaml.id, blockIsCallout);
							}
							updatedText = updatedText.replace(block, newBlock);
						}
					}
				}
			}
		}
		return updatedText;
	});
}
