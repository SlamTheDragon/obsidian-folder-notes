import { describe, it, expect } from 'bun:test';
import { OverviewIndexService } from '../src/backend/overview/OverviewIndexService';

describe('OverviewIndexService Reactive In-Memory Tracking', () => {
	const mockPlugin: any = {
		settings: {
			fvGlobalSettings: {
				autoUpdateLinks: true,
			},
			defaultOverview: {
				sortBy: 'name',
				sortByAsc: true,
			},
		},
		app: {
			vault: {
				getMarkdownFiles: () => [],
				getAbstractFileByPath: () => null,
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
});
