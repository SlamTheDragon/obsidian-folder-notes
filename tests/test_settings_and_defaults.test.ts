import { describe, it, expect } from 'bun:test';
import { DEFAULT_SETTINGS, type FolderNotesSettings } from '../src/backend/types/settings';

describe('Folder Notes Settings & Defaults', () => {
  it('contains expected default settings configuration', () => {
    expect(DEFAULT_SETTINGS.folderNoteName).toBe('{{folder_name}}');
    expect(DEFAULT_SETTINGS.storageLocation).toBe('insideFolder');
    expect(DEFAULT_SETTINGS.hideFolderNote).toBe(true);
    expect(DEFAULT_SETTINGS.syncFolderName).toBe(true);
    expect(DEFAULT_SETTINGS.folderNoteType).toBe('.md');
    expect(DEFAULT_SETTINGS.underlineFolder).toBe(true);
    expect(DEFAULT_SETTINGS.showDeleteConfirmation).toBe(true);
  });

  it('preserves array structures in default settings', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.excludeFolders)).toBe(true);
    expect(Array.isArray(DEFAULT_SETTINGS.whitelistFolders)).toBe(true);
    expect(Array.isArray(DEFAULT_SETTINGS.supportedFileTypes)).toBe(true);
  });

  it('merges legacy settings correctly without dropping values', () => {
    const legacySavedData: Partial<FolderNotesSettings> = {
      folderNoteName: 'custom_index',
      storageLocation: 'parentFolder',
      hideFolderNote: false,
    };

    const mergedSettings: FolderNotesSettings = Object.assign({}, DEFAULT_SETTINGS, legacySavedData);

    expect(mergedSettings.folderNoteName).toBe('custom_index');
    expect(mergedSettings.storageLocation).toBe('parentFolder');
    expect(mergedSettings.hideFolderNote).toBe(false);
    expect(mergedSettings.syncFolderName).toBe(true); // preserved from default
  });

  it('deeply merges nested configuration objects preserving defaults', () => {
    const legacySavedData: any = {
      defaultOverview: {
        sortBy: 'created',
      },
      fvGlobalSettings: {},
      frontMatterTitle: {
        enabled: true,
      },
    };

    const merged = Object.assign({}, DEFAULT_SETTINGS, legacySavedData, {
      defaultOverview: Object.assign({}, DEFAULT_SETTINGS.defaultOverview, legacySavedData.defaultOverview),
      frontMatterTitle: Object.assign({}, DEFAULT_SETTINGS.frontMatterTitle, legacySavedData.frontMatterTitle),
      persistentSettingsTab: Object.assign({}, DEFAULT_SETTINGS.persistentSettingsTab, legacySavedData.persistentSettingsTab),
      fvGlobalSettings: Object.assign({}, DEFAULT_SETTINGS.fvGlobalSettings, legacySavedData.fvGlobalSettings),
      openSidebar: Object.assign({}, DEFAULT_SETTINGS.openSidebar, legacySavedData.openSidebar),
      excludeFolderDefaultSettings: Object.assign({}, DEFAULT_SETTINGS.excludeFolderDefaultSettings, legacySavedData.excludeFolderDefaultSettings),
      excludePatternDefaultSettings: Object.assign({}, DEFAULT_SETTINGS.excludePatternDefaultSettings, legacySavedData.excludePatternDefaultSettings),
    });

    expect(merged.defaultOverview.sortBy).toBe('created');
    expect(merged.defaultOverview.depth).toBe(DEFAULT_SETTINGS.defaultOverview.depth);
    expect(merged.fvGlobalSettings.autoUpdateLinks).toBe(true);
    expect(merged.frontMatterTitle.enabled).toBe(true);
    expect(merged.frontMatterTitle.explorer).toBe(true);
  });
});

