import { describe, it, expect } from 'bun:test';
import { getFolderNameFromPathString, getFolderPathFromString } from '../src/backend/utils/pathUtils';
import { extractFolderName } from '../src/backend/core/FolderNoteResolver';

describe('Folder Rename & Template Synchronization Invariants', () => {
	function computeOldNoteLookupPath(
		folderPath: string,
		oldPath: string,
		template: string,
		storageLocation: 'insideFolder' | 'parentFolder' | 'vaultFolder',
		ext: string = 'md',
	): string {
		const oldFolderName = getFolderNameFromPathString(oldPath);
		const oldNoteBaseName = template.includes('{{folder_name}}')
			? template.replace('{{folder_name}}', oldFolderName)
			: template;

		let searchDir = folderPath;
		if (storageLocation === 'parentFolder') {
			searchDir = getFolderPathFromString(folderPath);
		} else if (storageLocation === 'vaultFolder') {
			searchDir = '/';
		}

		const oldNotePathWithoutExt = searchDir === '/' || searchDir === ''
			? oldNoteBaseName
			: `${searchDir}/${oldNoteBaseName}`;

		return `${oldNotePathWithoutExt}.${ext}`;
	}

	function computeTargetNoteRenamePath(
		folderName: string,
		folderPath: string,
		template: string,
		storageLocation: 'insideFolder' | 'parentFolder' | 'vaultFolder',
		ext: string = 'md',
	): string {
		const newNoteName = template.includes('{{folder_name}}')
			? template.replace('{{folder_name}}', folderName)
			: template;

		if (storageLocation === 'parentFolder') {
			const parentPath = getFolderPathFromString(folderPath);
			if (parentPath.trim() === '' || parentPath === '/') {
				return `${newNoteName}.${ext}`;
			}
			return `${parentPath}/${newNoteName}.${ext}`;
		} else if (storageLocation === 'vaultFolder') {
			return `${newNoteName}.${ext}`;
		}
		return `${folderPath}/${newNoteName}.${ext}`;
	}

	it('correctly resolves old note path for production template "{{folder_name}} - Index" in insideFolder', () => {
		const oldPath = 'Projects/Alpha';
		const newPath = 'Projects/Beta';
		const template = '{{folder_name}} - Index';

		// Obsidian moves folder on disk from Projects/Alpha to Projects/Beta.
		// Old note is located at Projects/Beta/Alpha - Index.md
		const oldLookup = computeOldNoteLookupPath(newPath, oldPath, template, 'insideFolder');
		expect(oldLookup).toBe('Projects/Beta/Alpha - Index.md');

		// Target note rename path should be Projects/Beta/Beta - Index.md
		const targetPath = computeTargetNoteRenamePath('Beta', newPath, template, 'insideFolder');
		expect(targetPath).toBe('Projects/Beta/Beta - Index.md');
	});

	it('correctly resolves old note path for production template "{{folder_name}} - Index" in parentFolder', () => {
		const oldPath = 'Projects/Alpha';
		const newPath = 'Projects/Beta';
		const template = '{{folder_name}} - Index';

		// In parentFolder mode, note is at Projects/Alpha - Index.md
		const oldLookup = computeOldNoteLookupPath(newPath, oldPath, template, 'parentFolder');
		expect(oldLookup).toBe('Projects/Alpha - Index.md');

		// Target rename path should be Projects/Beta - Index.md
		const targetPath = computeTargetNoteRenamePath('Beta', newPath, template, 'parentFolder');
		expect(targetPath).toBe('Projects/Beta - Index.md');
	});

	it('correctly resolves old note path for root folder in parentFolder mode', () => {
		const oldPath = 'Alpha';
		const newPath = 'Beta';
		const template = '{{folder_name}} - Index';

		const oldLookup = computeOldNoteLookupPath(newPath, oldPath, template, 'parentFolder');
		expect(oldLookup).toBe('Alpha - Index.md');

		const targetPath = computeTargetNoteRenamePath('Beta', newPath, template, 'parentFolder');
		expect(targetPath).toBe('Beta - Index.md');
	});

	it('correctly handles prefix and suffix templates', () => {
		const template = 'note_{{folder_name}}_v1';
		const oldLookup = computeOldNoteLookupPath('Beta', 'Alpha', template, 'insideFolder');
		expect(oldLookup).toBe('Beta/note_Alpha_v1.md');

		const targetPath = computeTargetNoteRenamePath('Beta', 'Beta', template, 'insideFolder');
		expect(targetPath).toBe('Beta/note_Beta_v1.md');

		expect(extractFolderName(template, 'note_Beta_v1')).toBe('Beta');
	});

	it('handles static template (index.md) without renaming file on insideFolder', () => {
		const template = 'index';
		const oldLookup = computeOldNoteLookupPath('Projects/Beta', 'Projects/Alpha', template, 'insideFolder');
		expect(oldLookup).toBe('Projects/Beta/index.md');

		const targetPath = computeTargetNoteRenamePath('Beta', 'Projects/Beta', template, 'insideFolder');
		expect(targetPath).toBe('Projects/Beta/index.md');
	});
});
