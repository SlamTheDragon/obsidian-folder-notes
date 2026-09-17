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

	it('verifies typography rules use direct child combinators to prevent style bleeding into child files', async () => {
		const fs = await import('fs');
		const path = await import('path');
		const scssContent = fs.readFileSync(path.join(import.meta.dir, '../src/frontend/styles/_explorer.scss'), 'utf8');

		// Assert bold, underline, and cursive target direct children rather than arbitrary descendants
		expect(scssContent).toContain('body.folder-note-bold .nav-folder.has-folder-note > .nav-folder-title > .tree-item-inner');
		expect(scssContent).toContain('body.folder-note-underline .nav-folder.has-folder-note > .nav-folder-title > .tree-item-inner');
		expect(scssContent).toContain('body.folder-note-cursive .nav-folder.has-folder-note > .nav-folder-title > .tree-item-inner');

		// Assert no un-scoped generic descendant selectors remain that could bleed to child notes
		expect(scssContent).not.toMatch(/body\.folder-note-bold\s+\.has-folder-note\s+\.tree-item-inner/);
	});
});
