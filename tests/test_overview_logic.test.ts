import { describe, it, expect } from 'bun:test';
import { TFile, TFolder } from 'obsidian';
import {
	sortFiles,
	isFileTypeIncluded,
	isFileInSubfolder,
	getFileDepth,
	getAllFiles,
} from '../src/backend/overview/FolderOverviewLogic';
import {
	replacePropertiesInTitle,
	replaceVariablesInTitle,
	getCodeBlockEndLine,
	getFolderPathFromString,
	cleanYamlBlock,
	buildNewBlock,
} from '../src/backend/overview/overviewUtils';
import type { defaultOverviewSettings } from '../src/backend/types/overview';

describe('Folder Overview Logic & Sorting', () => {
	const mockFolder1 = new TFolder();
	mockFolder1.name = 'Alpha Folder';
	mockFolder1.path = 'Projects/Alpha Folder';

	const mockFolder2 = new TFolder();
	mockFolder2.name = 'Beta Folder';
	mockFolder2.path = 'Projects/Beta Folder';

	const mockFile1 = new TFile();
	mockFile1.name = 'File A.md';
	mockFile1.basename = 'File A';
	mockFile1.path = 'Projects/File A.md';
	mockFile1.extension = 'md';
	mockFile1.stat = { ctime: 1000, mtime: 5000, size: 100 };

	const mockFile2 = new TFile();
	mockFile2.name = 'File B.md';
	mockFile2.basename = 'File B';
	mockFile2.path = 'Projects/File B.md';
	mockFile2.extension = 'md';
	mockFile2.stat = { ctime: 2000, mtime: 3000, size: 200 };

	it('should always sort folders before files', () => {
		const items = [mockFile1, mockFolder2, mockFile2, mockFolder1];
		const yaml: defaultOverviewSettings = {
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		const sorted = sortFiles(items, yaml);
		expect(sorted[0]).toBe(mockFolder1);
		expect(sorted[1]).toBe(mockFolder2);
		expect(sorted[2]).toBe(mockFile1);
		expect(sorted[3]).toBe(mockFile2);
	});

	it('should sort files by name descending', () => {
		const items = [mockFile1, mockFile2];
		const yaml: defaultOverviewSettings = {
			sortBy: 'name',
			sortByAsc: false,
		} as defaultOverviewSettings;

		const sorted = sortFiles(items, yaml);
		expect(sorted[0]).toBe(mockFile2);
		expect(sorted[1]).toBe(mockFile1);
	});

	it('should sort files by created time ascending and descending', () => {
		const items = [mockFile1, mockFile2];

		const sortedAsc = sortFiles(items, { sortBy: 'created', sortByAsc: true } as any);
		expect(sortedAsc[0]).toBe(mockFile1);
		expect(sortedAsc[1]).toBe(mockFile2);

		const sortedDesc = sortFiles(items, { sortBy: 'created', sortByAsc: false } as any);
		expect(sortedDesc[0]).toBe(mockFile2);
		expect(sortedDesc[1]).toBe(mockFile1);
	});

	it('should sort files by modified time ascending and descending', () => {
		const items = [mockFile1, mockFile2];

		const sortedAsc = sortFiles(items, { sortBy: 'modified', sortByAsc: true } as any);
		expect(sortedAsc[0]).toBe(mockFile2);
		expect(sortedAsc[1]).toBe(mockFile1);

		const sortedDesc = sortFiles(items, { sortBy: 'modified', sortByAsc: false } as any);
		expect(sortedDesc[0]).toBe(mockFile1);
		expect(sortedDesc[1]).toBe(mockFile2);
	});
});

describe('Folder Overview File Type Filtering', () => {
	it('includes markdown files when markdown is specified', () => {
		expect(isFileTypeIncluded('md', ['markdown'])).toBe(true);
		expect(isFileTypeIncluded('canvas', ['markdown'])).toBe(false);
	});

	it('includes canvas files when canvas is specified', () => {
		expect(isFileTypeIncluded('canvas', ['canvas'])).toBe(true);
		expect(isFileTypeIncluded('md', ['canvas'])).toBe(false);
	});

	it('includes images and pdfs correctly', () => {
		expect(isFileTypeIncluded('png', ['image'])).toBe(true);
		expect(isFileTypeIncluded('jpg', ['image'])).toBe(true);
		expect(isFileTypeIncluded('pdf', ['pdf'])).toBe(true);
		expect(isFileTypeIncluded('pdf', ['image'])).toBe(false);
	});

	it('includes other filetypes when other is specified', () => {
		expect(isFileTypeIncluded('json', ['other'])).toBe(true);
		expect(isFileTypeIncluded('py', ['other'])).toBe(true);
		expect(isFileTypeIncluded('md', ['other'])).toBe(false);
	});

	it('includes all filetypes when all is specified or includeTypes is empty', () => {
		expect(isFileTypeIncluded('md', ['all'])).toBe(true);
		expect(isFileTypeIncluded('png', ['all'])).toBe(true);
		expect(isFileTypeIncluded('xyz', [])).toBe(true);
	});
});

describe('Folder Overview Path & Depth Calculation', () => {
	it('calculates file depth accurately relative to source folder', () => {
		expect(getFileDepth('Projects/Note.md', 'Projects')).toBe(1);
		expect(getFileDepth('Projects/Sub/Note.md', 'Projects')).toBe(2);
		expect(getFileDepth('Projects/Sub/Deep/Note.md', 'Projects')).toBe(3);
		expect(getFileDepth('Note.md', '/')).toBe(1);
	});

	it('determines subfolder membership correctly without false positive prefix matches', () => {
		expect(isFileInSubfolder('Projects', 'Projects/Sub')).toBe(true);
		expect(isFileInSubfolder('Projects', 'Projects_Archive')).toBe(false);
		expect(isFileInSubfolder('/', 'Any/Path')).toBe(true);
	});

	it('correctly handles getFolderPathFromString', () => {
		expect(getFolderPathFromString('Folder/Doc.md')).toBe('Folder');
		expect(getFolderPathFromString('Doc.md')).toBe('/');
		expect(getFolderPathFromString('')).toBe('/');
	});
});

describe('Title Interpolation & Code Block Parsing', () => {
	it('replaces variables in title template', () => {
		const template = '{{folderName}} Overview (Path: {{folderPath}})';
		const variables = { folderName: 'Projects', folderPath: 'Work/Projects' };
		expect(replaceVariablesInTitle(template, variables)).toBe('Projects Overview (Path: Work/Projects)');
	});

	it('replaces frontmatter properties in title template', () => {
		const template = 'Project: {{properties.title}} by {{properties.author}}';
		const frontmatter = { title: 'Folder Notes Fusion', author: 'Obsidian Team' };
		expect(replacePropertiesInTitle(template, frontmatter)).toBe('Project: Folder Notes Fusion by Obsidian Team');
	});

	it('finds codeblock end line safely across CRLF and LF lines', () => {
		const unixDoc = '```folder-overview\nid: 123\n```\nSome other text';
		expect(getCodeBlockEndLine(unixDoc, 0)).toBe(2);

		const windowsDoc = '```folder-overview\r\nid: 123\r\n```\r\nSome other text';
		expect(getCodeBlockEndLine(windowsDoc, 0)).toBe(2);
	});

	it('cleans and builds YAML code blocks across standard and callout formats', () => {
		const rawStandard = '```folder-overview\nid: abc\ntitle: test\n```';
		const cleaned = cleanYamlBlock(rawStandard, false);
		expect(cleaned.trim()).toBe('id: abc\ntitle: test');

		const rawCallout = '> ```folder-overview\n> id: abc\n> title: test\n> ```';
		const cleanedCallout = cleanYamlBlock(rawCallout, true);
		expect(cleanedCallout.trim()).toBe('id: abc\ntitle: test');

		const rebuiltCallout = buildNewBlock('id: abc\n', true);
		expect(rebuiltCallout).toContain('> ```folder-overview\n> id: abc\n> ```');
	});
});
