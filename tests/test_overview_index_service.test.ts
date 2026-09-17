import { describe, it, expect } from 'bun:test';
import { OverviewIndexService } from '../src/backend/overview/OverviewIndexService';
import { resolveSourceFolder } from '../src/backend/overview/overviewUtils';
import { TFile, TFolder } from 'obsidian';

describe('OverviewIndexService Reactive In-Memory Tracking', () => {
	const rootFolder = new TFolder('/', '');
	const projectsFolder = new TFolder('Projects', 'Projects');
	const projectAlpha = new TFile('Projects/Alpha.md', 'Alpha.md', 'md');
	projectsFolder.children = [projectAlpha];
	projectAlpha.parent = projectsFolder;

	const mockPlugin: any = {
		settings: {
			folderNoteName: '{{folder_name}}',
			storageLocation: 'insideFolder',
			supportedFileTypes: ['md', 'canvas'],
			fvGlobalSettings: {
				autoUpdateLinks: true,
			},
			defaultOverview: {
				sortBy: 'name',
				sortByAsc: true,
				useWikilinks: true,
				depth: 2,
				includeTypes: ['folder', 'markdown'],
			},
		},
		app: {
			vault: {
				getRoot: () => rootFolder,
				getMarkdownFiles: () => [projectAlpha],
				getAbstractFileByPath: (path: string) => {
					if (path === '/' || path === '') return rootFolder;
					if (path === 'Projects') return projectsFolder;
					if (path === 'Projects/Alpha.md') return projectAlpha;
					return null;
				},
				getAllLoadedFiles: () => [projectsFolder, projectAlpha],
				read: async () => '```folder-overview\nid: "overview-1"\nuseActualLinks: true\n```\n<span class="fv-link-list-start" id="overview-1"></span>\n<span class="fv-link-list-end" id="overview-1"></span>',
				process: async (file: any, fn: any) => fn('```folder-overview\nid: "overview-1"\nuseActualLinks: true\n```\n<span class="fv-link-list-start" id="overview-1"></span>\n<span class="fv-link-list-end" id="overview-1"></span>'),
			},
		},
	};

	it('adds and removes notes from the in-memory index', () => {
		const service = new OverviewIndexService(mockPlugin);
		service.addNote('Folder A/Overview.md');
		service.addNote('Folder B/Overview.md');

		expect(service.getAllNotes()).toContain('Folder A/Overview.md');
		expect(service.getAllNotes()).toContain('Folder B/Overview.md');

		service.removeNote('Folder A/Overview.md');
		expect(service.getAllNotes()).not.toContain('Folder A/Overview.md');
		expect(service.getAllNotes()).toContain('Folder B/Overview.md');
	});

	it('preserves index entries across note renames without evicting them', () => {
		const service = new OverviewIndexService(mockPlugin);
		service.addNote('Projects/Legacy Note.md');

		service.handleRename('Projects/Legacy Note.md', 'Projects/Modern Note.md');

		expect(service.getAllNotes()).not.toContain('Projects/Legacy Note.md');
		expect(service.getAllNotes()).toContain('Projects/Modern Note.md');
	});

	it('handles file deletion cleanly', () => {
		const service = new OverviewIndexService(mockPlugin);
		service.addNote('Temporary/Note.md');
		service.handleDelete('Temporary/Note.md');

		expect(service.getAllNotes()).not.toContain('Temporary/Note.md');
	});

	it('resolves source folder paths uniformly via resolveSourceFolder', () => {
		const resolvedRoot = resolveSourceFolder(mockPlugin, '/');
		expect(resolvedRoot?.path).toBe('/');

		const resolvedParent = resolveSourceFolder(mockPlugin, '', projectAlpha);
		expect(resolvedParent?.path).toBe('Projects');

		const resolvedNamed = resolveSourceFolder(mockPlugin, 'Projects');
		expect(resolvedNamed?.path).toBe('Projects');

		const resolvedLinked = resolveSourceFolder(mockPlugin, 'Path of folder linked to the file', projectAlpha);
		expect(resolvedLinked?.path).toBe('Projects');
	});

	it('executes updateAllOverviews successfully for indexed notes', async () => {
		const service = new OverviewIndexService(mockPlugin);
		service.addNote('Projects/Alpha.md');

		await service.updateAllOverviews();
		expect(service.getAllNotes()).toContain('Projects/Alpha.md');
	});
});
