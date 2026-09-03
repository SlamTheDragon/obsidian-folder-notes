import { describe, it, expect } from 'bun:test';
import {
  extractFolderName,
  getFolderInfo,
  buildFullPath,
  normalizeFolderNoteType
} from '../src/backend/core/FolderNoteResolver';

describe('Folder Note Resolver Logic', () => {
  it('extracts folder name accurately based on naming template', () => {
    expect(extractFolderName('{{folder_name}}', 'ProjectAlpha')).toBe('ProjectAlpha');
    expect(extractFolderName('{{folder_name}}_note', 'ProjectAlpha_note')).toBe('ProjectAlpha');
    expect(extractFolderName('note_{{folder_name}}', 'note_ProjectAlpha')).toBe('ProjectAlpha');
    expect(extractFolderName('custom_index', 'custom_index')).toBe('custom_index');
  });

  it('extracts folder info correctly', () => {
    const info = getFolderInfo('Work/Projects/Alpha');
    expect(info).not.toBeNull();
    expect(info?.name).toBe('Alpha');
    expect(info?.path).toBe('Work/Projects/Alpha');
  });

  it('builds full paths correctly for root and nested paths', () => {
    expect(buildFullPath({ path: 'Work/Projects' }, 'Projects.md')).toBe('Work/Projects/Projects.md');
    expect(buildFullPath({ path: '/' }, 'RootNote.md')).toBe('RootNote.md');
  });

  it('normalizes folder note types', () => {
    expect(normalizeFolderNoteType('.md')).toBe('.md');
    expect(normalizeFolderNoteType('.canvas')).toBe('.canvas');
    expect(normalizeFolderNoteType('.excalidraw')).toBe('.md');
  });
});
