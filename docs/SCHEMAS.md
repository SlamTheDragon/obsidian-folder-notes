# Data Schemas & Model Reference

This document defines the TypeScript interfaces, JSON structures, and plugin settings schemas.

---

## 1. Plugin Settings Schema (`FolderNotesSettings`)

Stored in standard Obsidian `data.json`:

```typescript
export interface FolderNotesSettings {
  syncFolderName: boolean;                     // Auto-sync folder note name on folder rename
  ctrlKey: boolean;                            // Require Ctrl key for click action
  altKey: boolean;                             // Require Alt key for click action
  hideFolderNote: boolean;                     // Hide folder note from file explorer children
  templatePath: string;                        // Path to template note
  autoCreate: boolean;                         // Auto-create folder note when creating folder
  autoCreateForAttachmentFolder: boolean;      // Auto-create for attachment directories
  autoCreateFocusFiles: boolean;               // Focus file after auto-creation
  autoCreateForFiles: boolean;                 // Auto-create on file creation
  enableCollapsing: boolean;                   // Enable collapsing behavior
  excludeFolders: (ExcludePattern | ExcludedFolder)[]; // Excluded folders list
  whitelistFolders: (WhitelistedFolder | WhitelistedPattern)[]; // Whitelisted folders list
  showDeleteConfirmation: boolean;             // Confirm before deleting notes
  showRenameConfirmation: boolean;             // Confirm before renaming notes
  underlineFolder: boolean;                    // Underline folder titles with notes
  stopWhitespaceCollapsing: boolean;           // Prevent whitespace collapse
  underlineFolderInPath: boolean;              // Underline breadcrumb path
  openFolderNoteOnClickInPath: boolean;        // Open on breadcrumb click
  openInNewTab: boolean;                       // Open notes in new tab
  focusExistingTab: boolean;                   // Switch to tab if already open
  folderNoteName: string;                      // Name template (e.g. '{{folder_name}}')
  newFolderNoteName: string;                   // Next name template
  folderNoteType: string;                      // Default file type ('.md', '.canvas', '.ask')
  disableFolderHighlighting: boolean;          // Disable active highlight styling
  storageLocation: 'insideFolder' | 'parentFolder' | 'vaultFolder';
  syncDelete: boolean;                         // Delete note when folder is deleted
  defaultOverview: defaultOverviewSettings;    // Folder overview configuration
  useSubmenus: boolean;                        // Context menu submenu grouping
  syncMove: boolean;                           // Sync note location on folder move
  supportedFileTypes: string[];                // Supported extensions list
  boldName: boolean;                           // Bold folder name
  cursiveName: boolean;                        // Italicize folder name
  tabManagerEnabled: boolean;                  // Sync folder names to tab titles
  deleteFilesAction: 'delete' | 'trash' | 'obsidianTrash';
}
```

