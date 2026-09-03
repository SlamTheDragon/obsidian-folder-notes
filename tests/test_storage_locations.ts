import { describe, it, expect } from 'bun:test';
import { getFolderNameFromPathString, getFolderPathFromString } from '../src/functions/utils';

describe('Folder Note Storage Location Resolution', () => {
  function computeFolderNotePath(
    folderPath: string,
    storageLocation: 'insideFolder' | 'parentFolder' | 'vaultFolder',
    folderNoteNameTemplate: string,
    extension: string = '.md'
  ): string {
    const folderName = getFolderNameFromPathString(folderPath);
    const fileName = folderNoteNameTemplate.replace(/\{\{folder_name\}\}/g, folderName);

    if (storageLocation === 'parentFolder') {
      const parentFolderPath = getFolderPathFromString(folderPath);
      if (parentFolderPath.trim() === '') {
        return `${fileName}${extension}`;
      }
      return `${parentFolderPath}/${fileName}${extension}`;
    } else if (storageLocation === 'vaultFolder') {
      return `${fileName}${extension}`;
    } else {
      // insideFolder
      return `${folderPath}/${fileName}${extension}`;
    }
  }

  it('resolves insideFolder storage location correctly', () => {
    const path = computeFolderNotePath('Projects/Alpha', 'insideFolder', '{{folder_name}}', '.md');
    expect(path).toBe('Projects/Alpha/Alpha.md');

    const customNamePath = computeFolderNotePath('Projects/Alpha', 'insideFolder', 'index', '.md');
    expect(customNamePath).toBe('Projects/Alpha/index.md');
  });

  it('resolves parentFolder storage location correctly', () => {
    const path = computeFolderNotePath('Projects/Alpha', 'parentFolder', '{{folder_name}}', '.md');
    expect(path).toBe('Projects/Alpha.md');

    const rootSubfolderPath = computeFolderNotePath('Alpha', 'parentFolder', '{{folder_name}}', '.md');
    expect(rootSubfolderPath).toBe('Alpha.md');
  });

  it('resolves vaultFolder storage location correctly', () => {
    const path = computeFolderNotePath('Deep/Nested/Folder/Sub', 'vaultFolder', '{{folder_name}}', '.md');
    expect(path).toBe('Sub.md');
  });

  it('supports Canvas and Excalidraw extensions across storage locations', () => {
    const canvasPath = computeFolderNotePath('Brainstorming', 'insideFolder', '{{folder_name}}', '.canvas');
    expect(canvasPath).toBe('Brainstorming/Brainstorming.canvas');

    const excalidrawPath = computeFolderNotePath('Designs/Mockups', 'insideFolder', '{{folder_name}}', '.excalidraw.md');
    expect(excalidrawPath).toBe('Designs/Mockups/Mockups.excalidraw.md');
  });
});

