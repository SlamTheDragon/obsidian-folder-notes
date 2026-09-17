import { describe, it, expect } from 'bun:test';
import {
	getExcludedFolderByPath,
	deleteExcludedFolder,
	deleteWhitelistedFolder,
} from '../src/backend/core/ExcludeService';
import { ExcludedFolder, ExcludePattern } from '../src/backend/types/exclude';

describe('ExcludeService Bug Fix Verification', () => {
	it('does not false-positive match sibling folders that share a prefix name', () => {
		const mockPlugin: any = {
			settings: {
				excludeFolderDefaultSettings: {
					subFolders: true,
					disableSync: false,
					disableAutoCreate: false,
					disableFolderNote: false,
					enableCollapsing: false,
					excludeFromFolderOverview: false,
					showFolderNote: false,
				},
				excludeFolders: [
					{
						type: 'folder',
						id: '1',
						path: 'Notes',
						subFolders: true,
					},
				],
				whitelistFolders: [],
			},
		};

		// "Notes/Sub" should match
		const subMatch = getExcludedFolderByPath(mockPlugin, 'Notes/Sub/Note.md');
		expect(subMatch).toBeDefined();

		// "Notes_Archive/Sub" should NOT match "Notes"
		const siblingMatch = getExcludedFolderByPath(mockPlugin, 'Notes_Archive/Sub/Note.md');
		expect(siblingMatch).toBeUndefined();

		// "Notes" itself should match
		const exactMatch = getExcludedFolderByPath(mockPlugin, 'Notes');
		expect(exactMatch).toBeDefined();
	});

	it('deletes pattern exclusions by ID successfully', async () => {
		const patternItem = {
			type: 'pattern',
			id: 'pat-123',
			string: '*draft*',
			position: 0,
		} as any;

		const folderItem = {
			type: 'folder',
			id: 'fld-456',
			path: 'Archive',
			position: 1,
		} as any;

		const mockPlugin: any = {
			settings: {
				excludeFolders: [patternItem, folderItem],
				whitelistFolders: [],
			},
			saveSettings: async () => {},
		};

		await deleteExcludedFolder(mockPlugin, patternItem);
		expect(mockPlugin.settings.excludeFolders.length).toBe(1);
		expect(mockPlugin.settings.excludeFolders[0].id).toBe('fld-456');
	});

	it('deletes whitelisted pattern exclusions by ID successfully', async () => {
		const patternItem = {
			type: 'pattern',
			id: 'wpat-123',
			string: '*white*',
			position: 0,
		} as any;

		const mockPlugin: any = {
			settings: {
				excludeFolders: [],
				whitelistFolders: [patternItem],
			},
			saveSettings: async () => {},
		};

		await deleteWhitelistedFolder(mockPlugin, patternItem);
		expect(mockPlugin.settings.whitelistFolders.length).toBe(0);
	});
});
