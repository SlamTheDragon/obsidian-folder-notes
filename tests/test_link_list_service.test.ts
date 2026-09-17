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
		expect(block).toContain('> <!-- folder-overview-start: id="test-uuid-3"');
		expect(block).toContain('> <!-- folder-overview-end: id="test-uuid-3"');
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

	it('updates link list between markers without modifying text when content is identical', async () => {
		const { updateLinkList } = await import('../src/backend/overview/LinkListService');
		let processCalled = false;
		let resultingText = '';
		const mockApp: any = {
			vault: {
				process: async (file: TFile, fn: (text: string) => string) => {
					processCalled = true;
					const initialText = `# Header\n<!-- folder-overview-start: id="uuid-x" folderPath="Projects" -->\n- [[Projects/Task A|Task A]]\n<!-- folder-overview-end: id="uuid-x" -->\nFooter`;
					resultingText = fn(initialText);
					return resultingText;
				},
			},
		};
		const customMockPlugin: any = {
			...mockPlugin,
			app: mockApp,
		};
		const yaml: defaultOverviewSettings = {
			id: 'uuid-x',
			folderPath: 'Projects',
			depth: 1,
			useWikilinks: true,
			hideLinkList: false,
			isInCallout: false,
			showTitle: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		await updateLinkList([fileA], customMockPlugin, yaml, [], overviewNote);
		expect(processCalled).toBe(true);
		expect(resultingText).toContain('- [[Projects/Task A|Task A]]');
		expect(resultingText).toContain('<!-- folder-overview-start: id="uuid-x"');
		expect(resultingText).toContain('<!-- folder-overview-end: id="uuid-x" -->');
	});

	it('falls back to parent folder when folderPath is set to linked folder placeholder but note is not yet named as folder note', async () => {
		const { resolveSourceFolder } = await import('../src/backend/overview/overviewUtils');
		const parentFolder = new TFolder();
		parentFolder.path = 'Projects';
		parentFolder.name = 'Projects';

		const fallbackPlugin: any = {
			settings: {
				folderNoteName: '{{folder_name}} - Index',
				storageLocation: 'insideFolder',
			},
			app: {
				vault: {
					getAbstractFileByPath: (path: string) => {
						if (path === 'Projects') return parentFolder;
						return null;
					},
					getRoot: () => new TFolder(),
				},
			},
		};

		const testNote = new TFile();
		testNote.name = 'Untitled.md';
		testNote.basename = 'Untitled';
		testNote.path = 'Projects/Untitled.md';

		const resolved = resolveSourceFolder(fallbackPlugin, 'Path of folder linked to the file', testNote);
		expect(resolved).not.toBeNull();
		expect(resolved?.path).toBe('Projects');
	});

	it('auto-migrates folder-overview codeblock to pure markdown comment block with live links', async () => {
		const { updateLinkList } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const mockApp: any = {
			vault: {
				process: async (file: TFile, fn: (text: string) => string) => {
					const initialText = `# Header\n\`\`\`folder-overview\nid: "uuid-auto-inject"\nfolderPath: "Projects"\n\`\`\`\nFooter Content`;
					resultingText = fn(initialText);
					return resultingText;
				},
			},
		};
		const customMockPlugin: any = {
			...mockPlugin,
			app: mockApp,
		};
		const yaml: defaultOverviewSettings = {
			id: 'uuid-auto-inject',
			folderPath: 'Projects',
			depth: 1,
			useWikilinks: true,
			useActualLinks: true,
			hideLinkList: false,
			showTitle: false,
			isInCallout: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		await updateLinkList([fileA], customMockPlugin, yaml, [], overviewNote);
		expect(resultingText).toContain('<!-- folder-overview-start: id="uuid-auto-inject"');
		expect(resultingText).toContain('- [[Projects/Task A|Task A]]');
		expect(resultingText).toContain('<!-- folder-overview-end: id="uuid-auto-inject" -->');
		expect(resultingText).not.toContain('```folder-overview');
		expect(resultingText).toContain('Footer Content');
	});

	it('migrates legacy span markers to pure markdown comment block', async () => {
		const { updateLinkList } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const mockApp: any = {
			vault: {
				process: async (file: TFile, fn: (text: string) => string) => {
					const initialText = `# Header\n<span class="fv-link-list-start" id="uuid-mig"></span>\n- [[Projects/Old|Old]]\n<span class="fv-link-list-end" id="uuid-mig"></span>\nFooter Content`;
					resultingText = fn(initialText);
					return resultingText;
				},
			},
		};
		const customMockPlugin: any = {
			...mockPlugin,
			app: mockApp,
		};
		const yaml: defaultOverviewSettings = {
			id: 'uuid-mig',
			folderPath: 'Projects',
			depth: 1,
			useWikilinks: true,
			useActualLinks: true,
			hideLinkList: false,
			showTitle: false,
			isInCallout: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		await updateLinkList([fileA], customMockPlugin, yaml, [], overviewNote);
		expect(resultingText).toContain('<!-- folder-overview-start: id="uuid-mig"');
		expect(resultingText).not.toContain('<span class="fv-link-list-start"');
		expect(resultingText).toContain('- [[Projects/Task A|Task A]]');
		expect(resultingText).toContain('Footer Content');
	});

	it('strips link list when useActualLinks is explicitly set to false', async () => {
		const { updateLinkList } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const mockApp: any = {
			vault: {
				process: async (file: TFile, fn: (text: string) => string) => {
					const initialText = `# Header\n<!-- folder-overview-start: id="uuid-strip" folderPath="Projects" -->\n- [[Projects/Task A|Task A]]\n<!-- folder-overview-end: id="uuid-strip" -->\nFooter Content`;
					resultingText = fn(initialText);
					return resultingText;
				},
			},
		};
		const customMockPlugin: any = {
			...mockPlugin,
			app: mockApp,
		};
		const yaml: defaultOverviewSettings = {
			id: 'uuid-strip',
			folderPath: 'Projects',
			depth: 1,
			useWikilinks: true,
			useActualLinks: false,
			hideLinkList: false,
			isInCallout: false,
			includeTypes: ['markdown'],
			sortBy: 'name',
			sortByAsc: true,
		} as defaultOverviewSettings;

		await updateLinkList([fileA], customMockPlugin, yaml, [], overviewNote);
		expect(resultingText).not.toContain('<!-- folder-overview-start: id="uuid-strip"');
		expect(resultingText).not.toContain('- [[Projects/Task A|Task A]]');
		expect(resultingText).toContain('# Header\nFooter Content');
	});
});

describe('Tamper Detection & Remediation Engine', () => {
	const mockPlugin: any = {
		settings: {
			folderNoteName: '{{folder_name}}',
			defaultOverview: {
				sortBy: 'name',
				sortByAsc: true,
				useWikilinks: true,
				useActualLinks: true,
				hideLinkList: false,
				isInCallout: false,
			},
		},
		app: {
			vault: {
				getAbstractFileByPath: () => null,
				getAllLoadedFiles: () => [],
				read: async () => '',
				process: async () => '',
			},
		},
	};

	const testFile = new TFile();
	testFile.name = 'Overview.md';
	testFile.basename = 'Overview';
	testFile.path = 'Projects/Overview.md';
	testFile.extension = 'md';

	it('detects unclosed or broken container tags', async () => {
		const { detectTamperedOverviews } = await import('../src/backend/overview/LinkListService');
		const content = `# My Note
<!-- folder-overview-start: id="broken-uuid-2" folderPath="Projects" -->
- [[Projects/Task A|Task A]]
No closing tag here!`;

		const customPlugin: any = {
			...mockPlugin,
			app: {
				vault: {
					read: async () => content,
				},
			},
		};

		const detections = await detectTamperedOverviews(customPlugin, testFile, content);
		expect(detections.length).toBe(1);
		expect(detections[0].id).toBe('broken-uuid-2');
		expect(detections[0].type).toBe('broken-tags');
	});

	it('purgeOverviewContainer completely removes orphaned container and enclosed links', async () => {
		const { purgeOverviewContainer } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const initialContent = `# Header
<!-- folder-overview-start: id="purge-uuid" folderPath="Projects" -->
- [[Projects/Task A|Task A]]
- [[Projects/Task B|Task B]]
<!-- folder-overview-end: id="purge-uuid" -->
Footer Content`;

		const customPlugin: any = {
			...mockPlugin,
			app: {
				vault: {
					process: async (file: TFile, fn: (text: string) => string) => {
						resultingText = fn(initialContent);
						return resultingText;
					},
				},
			},
		};

		await purgeOverviewContainer(customPlugin, testFile, 'purge-uuid');
		expect(resultingText).not.toContain('purge-uuid');
		expect(resultingText).not.toContain('Task A');
		expect(resultingText).toContain('# Header\nFooter Content');
	});

	it('decoupleOverviewContainer strips markup wrappers leaving links as standard markdown', async () => {
		const { decoupleOverviewContainer } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const initialContent = `# Header
<!-- folder-overview-start: id="decouple-uuid" folderPath="Projects" -->
- [[Projects/Task A|Task A]]
- [[Projects/Task B|Task B]]
<!-- folder-overview-end: id="decouple-uuid" -->
Footer Content`;

		const customPlugin: any = {
			...mockPlugin,
			app: {
				vault: {
					process: async (file: TFile, fn: (text: string) => string) => {
						resultingText = fn(initialContent);
						return resultingText;
					},
				},
			},
		};

		await decoupleOverviewContainer(customPlugin, testFile, 'decouple-uuid');
		expect(resultingText).not.toContain('<!-- folder-overview-start');
		expect(resultingText).not.toContain('<!-- folder-overview-end');
		expect(resultingText).toContain('- [[Projects/Task A|Task A]]');
		expect(resultingText).toContain('- [[Projects/Task B|Task B]]');
		expect(resultingText).toContain('Footer Content');
	});

	it('rebuildOverviewContainer restores valid container and link structure', async () => {
		const { rebuildOverviewContainer } = await import('../src/backend/overview/LinkListService');
		let resultingText = '';
		const initialContent = `# Header
<!-- folder-overview-start: id="rebuild-uuid" folderPath="Projects" -->
Broken orphaned remnant`;

		const fileItem = new TFile();
		fileItem.name = 'Task C.md';
		fileItem.basename = 'Task C';
		fileItem.path = 'Projects/Task C.md';
		fileItem.extension = 'md';

		const parentFolder = new TFolder();
		parentFolder.path = 'Projects';
		parentFolder.name = 'Projects';
		parentFolder.children = [fileItem];

		const customPlugin: any = {
			...mockPlugin,
			settings: {
				folderNoteName: '{{folder_name}}',
				storageLocation: 'insideFolder',
				defaultOverview: {
					sortBy: 'name',
					sortByAsc: true,
					useWikilinks: true,
					useActualLinks: true,
					hideLinkList: false,
					showTitle: false,
					isInCallout: false,
				},
			},
			app: {
				vault: {
					read: async () => initialContent,
					getAbstractFileByPath: (path: string) => {
						if (path === 'Projects') return parentFolder;
						return null;
					},
					getAllLoadedFiles: () => [fileItem],
					process: async (file: TFile, fn: (text: string) => string) => {
						resultingText = fn(initialContent);
						return resultingText;
					},
				},
			},
		};

		await rebuildOverviewContainer(customPlugin, testFile, 'rebuild-uuid');
		expect(resultingText).toContain('<!-- folder-overview-start: id="rebuild-uuid"');
		expect(resultingText).toContain('- [[Projects/Task C|Task C]]');
		expect(resultingText).toContain('<!-- folder-overview-end: id="rebuild-uuid" -->');
	});
});
