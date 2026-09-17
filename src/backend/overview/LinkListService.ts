import { TFile, TFolder, type TAbstractFile } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings } from '../types/overview';
import { getFolderNote } from '../core/FolderNoteResolver';
import { filterFiles, sortFiles } from './FolderOverviewLogic';
import { vaultWriteQueue } from './VaultWriteQueue';

export function buildLinkListBlock(id: string, calloutFlag: boolean, folderPath = ''): string {
	const prefix = calloutFlag ? '> ' : '';
	return `\n${prefix}<!-- folder-overview-start: id="${id}" folderPath="${folderPath}" -->\n${prefix}<!-- folder-overview-end: id="${id}" -->\n`;
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
		const useActualLinks = yaml.useActualLinks ?? true;

		const headingPrefix = '#'.repeat(yaml.titleSize ?? 2);
		const titleLine = (yaml.showTitle !== false && yaml.title) ? `${prefix}${headingPrefix} ${yaml.title}` : '';

		const newBlockLines = [
			`${prefix}<!-- folder-overview-start: id="${yaml.id}" folderPath="${yaml.folderPath ?? ''}" -->`,
			...(titleLine ? [titleLine] : []),
			...fileLinks,
			`${prefix}<!-- folder-overview-end: id="${yaml.id}" -->`,
		];

		// 1. Check for pure Markdown comment block: <!-- folder-overview-start: id="${yaml.id}" ... -->
		let startIdx = lines.findIndex((l) =>
			l.includes('folder-overview-start') && l.includes(yaml.id),
		);
		let endIdx = -1;

		if (startIdx !== -1) {
			for (let i = startIdx + 1; i < lines.length; i++) {
				if (lines[i].includes('folder-overview-end') && lines[i].includes(yaml.id)) {
					endIdx = i;
					break;
				}
			}
		}

		// 2. Fallback: check for legacy ```folder-overview ... ``` codeblock with this ID
		if (startIdx === -1 || endIdx === -1) {
			let inMatchingCodeblock = false;
			let codeblockStart = -1;
			let codeblockEnd = -1;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.includes('```folder-overview')) {
					inMatchingCodeblock = true;
					codeblockStart = i;
				} else if (inMatchingCodeblock) {
					if (line.includes(`id: ${yaml.id}`) || line.includes(`id: "${yaml.id}"`) || line.includes(`id: '${yaml.id}'`)) {
						for (let j = i; j < lines.length; j++) {
							if (lines[j].trim().endsWith('```') && j > i) {
								codeblockEnd = j;
								break;
							}
						}
						break;
					}
					if (line.trim().endsWith('```')) {
						inMatchingCodeblock = false;
						codeblockStart = -1;
					}
				}
			}

			if (codeblockStart !== -1 && codeblockEnd !== -1) {
				startIdx = codeblockStart;
				endIdx = codeblockEnd;

				// Also consume any adjacent legacy div or span markers immediately after codeblock
				for (let k = endIdx + 1; k < lines.length; k++) {
					const l = lines[k];
					if (l.includes('class="fv-link-list"') || l.includes('class="fv-link-list-start"') || l.includes('class="fv-link-list-end"')) {
						endIdx = k;
					} else if (l.includes('</div>') && lines.slice(startIdx, k).some((x) => x.includes('class="fv-link-list"'))) {
						endIdx = k;
						break;
					} else if (l.trim() !== '') {
						break;
					}
				}
			}
		}

		// 3. Fallback: check for standalone legacy <div class="fv-link-list"> or span markers
		if (startIdx === -1 || endIdx === -1) {
			const divStart = lines.findIndex((l) =>
				l.includes('class="fv-link-list"') &&
				(l.includes(`data-folder-overview-id="${yaml.id}"`) || l.includes(`data-id="${yaml.id}"`)),
			);
			if (divStart !== -1) {
				startIdx = divStart;
				for (let i = startIdx + 1; i < lines.length; i++) {
					if (lines[i].includes('</div>')) {
						endIdx = i;
						break;
					}
				}
			} else {
				const legacyStartMarker = `${prefix}<span class="fv-link-list-start" id="${yaml.id}"></span>`;
				const legacyEndMarker = `${prefix}<span class="fv-link-list-end" id="${yaml.id}"></span>`;
				startIdx = lines.findIndex((l) => l.trim() === legacyStartMarker.trim());
				endIdx = lines.findIndex((l) => l.trim() === legacyEndMarker.trim());
			}
		}

		const NOT_FOUND = -1;
		const blockExists = startIdx !== NOT_FOUND && endIdx !== NOT_FOUND && endIdx >= startIdx;

		if (!blockExists) {
			if (!useActualLinks) {
				return text;
			}
			// Append new pure markdown block
			lines.push('', ...newBlockLines, '');
			return lines.join('\n');
		}

		if (yaml.useActualLinks === false) {
			lines.splice(startIdx, endIdx - startIdx + 1);
			return lines.join('\n');
		}

		const existingBlock = lines.slice(startIdx, endIdx + 1).join('\n');
		const newBlock = newBlockLines.join('\n');

		if (existingBlock === newBlock) {
			return text;
		}

		lines.splice(startIdx, endIdx - startIdx + 1, ...newBlockLines);
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
	const depth = yaml.depth ?? plugin?.settings?.defaultOverview?.depth ?? 1;
	const filtered = (
		await filterFiles(
			items,
			plugin,
			yaml.folderPath,
			depth,
			pathBlacklist,
			yaml,
			sourceFile,
		)
	).filter((file): file is TAbstractFile => file !== null);

	const sorted = sortFiles(filtered, yaml, plugin);

	for (const item of sorted) {
		const indentStr = '\t'.repeat(indent);

		if (item instanceof TFile) {
			result.push(buildFileLinkListLine(item, yaml, indentStr, plugin));
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
	plugin?: FolderNotesPlugin,
): string {
	const prefix = yaml.isInCallout ? '> ' : '';
	// Standard wikilink without raw .md extension to preserve Obsidian graph and rename tracking
	const linkTarget = item.path.endsWith('.md')
		? item.path.slice(0, -3)
		: item.path;

	const useWikilinks = yaml.useWikilinks ?? plugin?.settings?.defaultOverview?.useWikilinks ?? true;
	let base: string;
	if (useWikilinks) {
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

		// 1. Check for pure Markdown comment block: <!-- folder-overview-start: id="${yaml.id}" ... -->
		let startIdx = lines.findIndex((l) =>
			l.includes('folder-overview-start') && l.includes(yaml.id),
		);
		let endIdx = -1;

		if (startIdx !== -1) {
			for (let i = startIdx + 1; i < lines.length; i++) {
				if (lines[i].includes('folder-overview-end') && lines[i].includes(yaml.id)) {
					endIdx = i;
					break;
				}
			}
		}

		// 2. Check for legacy codeblock with this ID
		if (startIdx === -1 || endIdx === -1) {
			let inMatchingCodeblock = false;
			let codeblockStart = -1;
			let codeblockEnd = -1;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.includes('```folder-overview')) {
					inMatchingCodeblock = true;
					codeblockStart = i;
				} else if (inMatchingCodeblock) {
					if (line.includes(`id: ${yaml.id}`) || line.includes(`id: "${yaml.id}"`) || line.includes(`id: '${yaml.id}'`)) {
						for (let j = i; j < lines.length; j++) {
							if (lines[j].trim().endsWith('```') && j > i) {
								codeblockEnd = j;
								break;
							}
						}
						break;
					}
					if (line.trim().endsWith('```')) {
						inMatchingCodeblock = false;
						codeblockStart = -1;
					}
				}
			}

			if (codeblockStart !== -1 && codeblockEnd !== -1) {
				startIdx = codeblockStart;
				endIdx = codeblockEnd;
				for (let k = endIdx + 1; k < lines.length; k++) {
					const l = lines[k];
					if (l.includes('class="fv-link-list"') || l.includes('class="fv-link-list-start"') || l.includes('class="fv-link-list-end"')) {
						endIdx = k;
					} else if (l.includes('</div>') && lines.slice(startIdx, k).some((x) => x.includes('class="fv-link-list"'))) {
						endIdx = k;
						break;
					} else if (l.trim() !== '') {
						break;
					}
				}
			}
		}

		// 3. Check for standalone legacy div or span markers
		if (startIdx === -1 || endIdx === -1) {
			const divStart = lines.findIndex((l) =>
				l.includes('class="fv-link-list"') &&
				(l.includes(`data-folder-overview-id="${yaml.id}"`) || l.includes(`data-id="${yaml.id}"`)),
			);
			if (divStart !== -1) {
				startIdx = divStart;
				for (let i = startIdx + 1; i < lines.length; i++) {
					if (lines[i].includes('</div>')) {
						endIdx = i;
						break;
					}
				}
			} else {
				const startMarker = `${prefix}<span class="fv-link-list-start" id="${yaml.id}"></span>`;
				const endMarker = `${prefix}<span class="fv-link-list-end" id="${yaml.id}"></span>`;
				startIdx = lines.findIndex((l) => l.trim() === startMarker.trim());
				endIdx = lines.findIndex((l) => l.trim() === endMarker.trim());
			}
		}

		const NOT_FOUND = -1;
		const blockExists = startIdx !== NOT_FOUND && endIdx !== NOT_FOUND && endIdx >= startIdx;

		if (!blockExists) {
			return text;
		}

		lines.splice(startIdx, endIdx - startIdx + 1);
		return lines.join('\n');
	});
}

export interface TamperDetectionResult {
	id: string;
	type: 'orphaned' | 'broken-tags' | 'mismatched';
	details: string;
	rawBlock?: string;
	startLine?: number;
	endLine?: number;
}

export async function detectTamperedOverviews(
	plugin: FolderNotesPlugin,
	file: TFile,
	content: string,
): Promise<TamperDetectionResult[]> {
	const results: TamperDetectionResult[] = [];
	const { getOverviews } = await import('./FolderOverviewLogic');
	const overviews = await getOverviews(plugin, file);
	const activeOverviewIds = new Set(overviews.map((ov) => ov.id).filter(Boolean));

	// 1. Scan for unclosed pure markdown comment start tags: <!-- folder-overview-start: id="X" ... -->
	const startCommentRegex = /<!--\s*folder-overview-start(?::|\s+)[^>]*id=["']([^"']+)["'][^>]*-->/g;
	let match: RegExpExecArray | null;
	while ((match = startCommentRegex.exec(content)) !== null) {
		const id = match[1];
		const endCommentPattern = new RegExp(`<!--\\s*folder-overview-end(?::|\\s+)[^>]*id=["']${id}["'][^>]*-->`);
		if (!endCommentPattern.test(content)) {
			results.push({
				id,
				type: 'broken-tags',
				details: 'Overview comment block is missing its closing folder-overview-end tag.',
				rawBlock: match[0],
			});
		}
	}

	// 2. Scan for unclosed / broken legacy div tags
	const divRegex = /<div\s+class=["']fv-link-list["'][^>]*data-(?:folder-overview-)?id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/g;
	const detectedDivIds = new Set<string>();
	while ((match = divRegex.exec(content)) !== null) {
		detectedDivIds.add(match[1]);
	}

	const unclosedDivRegex = /<div\s+class=["']fv-link-list["'][^>]*data-(?:folder-overview-)?id=["']([^"']+)["'][^>]*>(?![\s\S]*?<\/div>)/g;
	while ((match = unclosedDivRegex.exec(content)) !== null) {
		const id = match[1];
		if (!detectedDivIds.has(id)) {
			results.push({
				id,
				type: 'broken-tags',
				details: 'Legacy link container tag is missing closing </div> tag.',
				rawBlock: match[0],
			});
		}
	}

	return results;
}

export async function rebuildOverviewContainer(
	plugin: FolderNotesPlugin,
	file: TFile,
	overviewId: string,
): Promise<void> {
	const { getOverviews } = await import('./FolderOverviewLogic');
	const { resolveSourceFolder } = await import('./overviewUtils');
	const overviews = await getOverviews(plugin, file);
	const foundOverview = overviews.find((ov) => ov.id === overviewId);
	const overview: defaultOverviewSettings = {
		...plugin.settings.defaultOverview,
		...(foundOverview ?? {}),
		id: overviewId,
	};

	const sourceFolder = resolveSourceFolder(plugin, overview.folderPath, file);
	const files: TAbstractFile[] = sourceFolder
		? ((sourceFolder.path === '/' || sourceFolder.isRoot?.())
			? plugin.app.vault.getAllLoadedFiles().filter((f) => f.parent?.path === '/' || !f.path.includes('/'))
			: sourceFolder.children)
		: [];

	await updateLinkList(files, plugin, overview, [], file);
}

export async function purgeOverviewContainer(
	plugin: FolderNotesPlugin,
	file: TFile,
	overviewId: string,
): Promise<void> {
	await removeLinkList(plugin, file, { id: overviewId } as any);
}

export async function decoupleOverviewContainer(
	plugin: FolderNotesPlugin,
	file: TFile,
	overviewId: string,
): Promise<void> {
	await vaultWriteQueue.enqueueProcess(plugin.app, file, (text) => {
		const lines = text.split(/\r?\n/);

		// 1. Check for pure Markdown comment block
		let startIdx = lines.findIndex((l) =>
			l.includes('folder-overview-start') && l.includes(overviewId),
		);
		let endIdx = -1;

		if (startIdx !== -1) {
			for (let i = startIdx + 1; i < lines.length; i++) {
				if (lines[i].includes('folder-overview-end') && lines[i].includes(overviewId)) {
					endIdx = i;
					break;
				}
			}
		}

		if (startIdx !== -1 && endIdx !== -1) {
			lines.splice(endIdx, 1);
			lines.splice(startIdx, 1);
			return lines.join('\n');
		}

		// 2. Fallback: check for legacy div container
		const divStart = lines.findIndex((l) =>
			l.includes('class="fv-link-list"') &&
			(l.includes(`data-folder-overview-id="${overviewId}"`) || l.includes(`data-id="${overviewId}"`)),
		);
		let divEnd = -1;

		if (divStart !== -1) {
			for (let i = divStart + 1; i < lines.length; i++) {
				if (lines[i].includes('</div>')) {
					divEnd = i;
					break;
				}
			}
		}

		if (divStart !== -1 && divEnd !== -1) {
			lines.splice(divEnd, 1);
			lines.splice(divStart, 1);
			return lines.join('\n');
		}

		return text
			.replace(new RegExp(`\\n?>?\\s*<span class="fv-link-list-start" id="${overviewId}"><\\/span>`, 'g'), '')
			.replace(new RegExp(`\\n?>?\\s*<span class="fv-link-list-end" id="${overviewId}"><\\/span>`, 'g'), '');
	});
}
