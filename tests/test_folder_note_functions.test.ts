import { describe, it, expect } from 'bun:test';
import {
  getFolderNameFromPathString,
  getFolderPathFromString,
  removeExtension,
  getFileNameFromPathString
} from '../src/functions/utils';

describe('Folder Note Utilities & Path Parsing', () => {
  it('should correctly extract folder name from path string', () => {
    expect(getFolderNameFromPathString('Notes/Work/Projects')).toBe('Projects');
    expect(getFolderNameFromPathString('SingleFolder')).toBe('SingleFolder');
    // When given a file path, extracts containing folder name
    expect(getFolderNameFromPathString('Notes/Daily.md')).toBe('Notes');
    expect(getFolderNameFromPathString('Research/Projects/Canvas.canvas')).toBe('Projects');
  });

  it('should correctly extract parent folder path from string', () => {
    expect(getFolderPathFromString('Notes/Work/Projects')).toBe('Notes/Work');
    expect(getFolderPathFromString('Notes/Work')).toBe('Notes');
    // Root level folder's parent is '/'
    expect(getFolderPathFromString('SingleFolder')).toBe('/');
  });

  it('should remove file extensions reliably', () => {
    expect(removeExtension('ProjectNote.md')).toBe('ProjectNote');
    expect(removeExtension('Diagram.canvas')).toBe('Diagram');
    expect(removeExtension('Drawing.excalidraw.md')).toBe('Drawing.excalidraw');
  });

  it('should extract file name from path string', () => {
    expect(getFileNameFromPathString('Notes/Work/Projects/Tasks.md')).toBe('Tasks.md');
    expect(getFileNameFromPathString('RootNote.md')).toBe('RootNote.md');
  });

  it('should replace {{folder_name}} template token accurately', () => {
    const template = '{{folder_name}} Note';
    const folderPath = 'Research/Quantum Computing';
    const folderName = getFolderNameFromPathString(folderPath);
    const resolvedName = template.replace(/\{\{folder_name\}\}/g, folderName);

    expect(resolvedName).toBe('Quantum Computing Note');
  });
});

