import { describe, it, expect } from 'bun:test';
import { TFile, TFolder } from 'obsidian';
import { buildLinkList, buildLinkListBlock } from '../src/backend/overview/LinkListService';
import type { defaultOverviewSettings } from '../src/backend/types/overview';

describe('LinkListService Formatting & AST Safety', () => {
	const mockPlugin: any = {
		settings: {
			folderNoteName: '{{folder_name}}',
			defaultOverview: {
				sortBy: 'name',
				sortByAsc: true,
			},
		},
		app: {
			vault: {
				getAbstractFileByPath: () => null,
			},
		},
	};

	const fileA = new TFile();
	fileA.name = 'Task A.md';
	fileA.basename = 'Task A';
	fileA.path = 'Projects/Task A.md';
	fileA.extension = 'md';
	fileA.stat = { ctime: 1000, mtime: 2000, size: 50 };

	const fileB = new TFile();
	fileB.name = 'Design.canvas';
	fileB.basename = 'Design';
	fileB.path = 'Projects/Design.canvas';
	fileB.extension = 'canvas';
	fileB.stat = { ctime: 1200, mtime: 2200, size: 80 };

	const overviewNote = new TFile();
	overviewNote.name = 'Overview.md';
	overviewNote.basename = 'Overview';
	overviewNote.path = 'Projects/Overview.md';
	overviewNote.extension = 'md';
	overviewNote.stat = { ctime: 500, mtime: 500, size: 50 };

	it('formats standard Obsidian wikilinks without raw .md extension to protect rename tracking', async () => {
		const yaml: defaultOverviewSettings = {
			id: 'test-uuid-1',
			folderPath: 'Projects',
			depth: 2,
			useWikilinks: true,
			hideLinkList: false,
			isInCallout: false,
			includeTypes: ['markdown', 'canvas'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		const links = await buildLinkList([fileA, fileB], mockPlugin, yaml, [], overviewNote);
		expect(links).toContain('- [[Projects/Task A|Task A]]');
		expect(links).toContain('- [[Projects/Design.canvas|Design]]');
	});

	it('formats standard Markdown links when useWikilinks is false', async () => {
		const yaml: defaultOverviewSettings = {
			id: 'test-uuid-2',
			folderPath: 'Projects',
			depth: 2,
			useWikilinks: false,
			hideLinkList: false,
			isInCallout: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		const links = await buildLinkList([fileA], mockPlugin, yaml, [], overviewNote);
		expect(links).toContain('- [Task A](Projects/Task%20A.md)');
	});

	it('preserves callout blockquote formatting (> ) when isInCallout is true', async () => {
		const yaml: defaultOverviewSettings = {
			id: 'test-uuid-3',
			folderPath: 'Projects',
			depth: 2,
			useWikilinks: true,
			hideLinkList: false,
			isInCallout: true,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		const links = await buildLinkList([fileA], mockPlugin, yaml, [], overviewNote);
		expect(links[0]).toMatch(/^> - \[\[Projects\/Task A\|Task A\]\]/);

		const block = buildLinkListBlock('test-uuid-3', true);
		expect(block).toContain('> <span class="fv-link-list-start" id="test-uuid-3"></span>');
		expect(block).toContain('> <span class="fv-link-list-end" id="test-uuid-3"></span>');
	});

	it('adds hidden span markers when hideLinkList is true', async () => {
		const yaml: defaultOverviewSettings = {
			id: 'test-uuid-4',
			folderPath: 'Projects',
			depth: 2,
			useWikilinks: true,
			hideLinkList: true,
			isInCallout: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		const links = await buildLinkList([fileA], mockPlugin, yaml, [], overviewNote);
		expect(links[0]).toContain('<span class="fv-link-list-item"></span>');
	});

});
