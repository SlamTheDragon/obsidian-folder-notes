import { describe, it, expect } from 'bun:test';
import {
	extractFolderName,
	adjustFolderPathForStorage,
	buildFullPath,
} from '../src/backend/core/FolderNoteResolver';

describe('FolderNoteResolver Regex Escaping & Storage Locations', () => {
	it('safely handles naming templates with regex special characters', () => {
		// Template with brackets and parentheses
		const template = '[fn] {{folder_name}} (note)';
		const fileName = '[fn] Project Alpha (note)';

		const extracted = extractFolderName(template, fileName);
		expect(extracted).toBe('Project Alpha');
	});

	it('safely handles templates with dots and dollar signs', () => {
		const template = 'fn.{{folder_name}}.$doc';
		const fileName = 'fn.Quarterly Report.$doc';

		const extracted = extractFolderName(template, fileName);
		expect(extracted).toBe('Quarterly Report');
	});

	it('adjusts folder path for storage location vaultFolder', () => {
		const folder = { path: 'Deeply/Nested/Folder', name: 'Folder' };
		const mockPlugin: any = {
			settings: {
				storageLocation: 'vaultFolder',
			},
		};

		adjustFolderPathForStorage(folder, 'Deeply/Nested/Folder', mockPlugin);
		expect(folder.path).toBe('/');
		expect(buildFullPath(folder, 'Folder.md')).toBe('Folder.md');
	});
});
