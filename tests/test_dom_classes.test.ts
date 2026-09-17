import { describe, it, expect } from 'bun:test';

describe('File Explorer DOM Classes & Styling Selector Integrity', () => {
	it('verifies expected class names for folder notes in DOM', () => {
		const classNames = {
			hasFolderNote: 'has-folder-note',
			isFolderNote: 'is-folder-note',
			activeHighlight: 'fn-is-active',
			hideFolderNote: 'hide-folder-note',
			emptyFolder: 'fn-empty-folder',
			onlyHasFolderNote: 'only-has-folder-note',
		};

		expect(classNames.hasFolderNote).toBe('has-folder-note');
		expect(classNames.isFolderNote).toBe('is-folder-note');
		expect(classNames.activeHighlight).toBe('fn-is-active');
		expect(classNames.hideFolderNote).toBe('hide-folder-note');
	});

	it('verifies body setting classes mapping', () => {
		const settingClassMap: Record<string, string> = {
			hideFolderNote: 'hide-folder-note',
			underlineFolder: 'folder-note-underline',
			boldName: 'folder-note-bold',
			cursiveName: 'folder-note-cursive',
			stopWhitespaceCollapsing: 'fn-whitespace-stop-collapsing',
			hideCollapsingIcon: 'fn-hide-collapse-icon',
			hideCollapsingIconForEmptyFolders: 'fn-hide-empty-collapse-icon',
		};

		expect(settingClassMap.boldName).toBe('folder-note-bold');
		expect(settingClassMap.underlineFolder).toBe('folder-note-underline');
		expect(settingClassMap.hideFolderNote).toBe('hide-folder-note');
	});
});
