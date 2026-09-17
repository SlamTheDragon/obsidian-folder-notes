import type { ExcludePattern, ExcludedFolder, WhitelistedFolder, WhitelistedPattern } from './exclude';
import { type defaultOverviewSettings, DEFAULT_OVERVIEW_SETTINGS } from './overview';

export interface FolderNotesSettings {
	syncFolderName: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	hideFolderNote: boolean;
	templatePath: string;
	autoCreate: boolean;
	autoCreateForAttachmentFolder: boolean;
	autoCreateFocusFiles: boolean;
	autoCreateForFiles: boolean;
	enableCollapsing: boolean;
	excludeFolders: (ExcludePattern | ExcludedFolder)[];
	whitelistFolders: (WhitelistedFolder | WhitelistedPattern)[];
	showDeleteConfirmation: boolean;
	showRenameConfirmation: boolean;
	underlineFolder: boolean;
	stopWhitespaceCollapsing: boolean;
	underlineFolderInPath: boolean;
	openFolderNoteOnClickInPath: boolean;
	openInNewTab: boolean;
	focusExistingTab: boolean;
	oldFolderNoteName: string | undefined;
	folderNoteName: string;
	newFolderNoteName: string;
	folderNoteType: string;
	disableFolderHighlighting: boolean;
	storageLocation: 'insideFolder' | 'parentFolder' | 'vaultFolder';
	syncDelete: boolean;
	defaultOverview: defaultOverviewSettings;
	useSubmenus: boolean;
	syncMove: boolean;
	frontMatterTitle: {
		enabled: boolean;
		explorer: boolean;
		path: boolean;
	};
	settingsTab: string;
	supportedFileTypes: string[];
	boldName: boolean;
	boldNameInPath: boolean;
	cursiveName: boolean;
	cursiveNameInPath: boolean;
	disableOpenFolderNoteOnClick: boolean;
	openByClick: boolean;
	openWithCtrl: boolean;
	openWithAlt: boolean;
	excludeFolderDefaultSettings: {
		subFolders: boolean;
		disableSync: boolean;
		disableAutoCreate: boolean;
		disableFolderNote: boolean;
		enableCollapsing: boolean;
		excludeFromFolderOverview: boolean;
		showFolderNote: boolean;
	};
	excludePatternDefaultSettings: {
		subFolders: boolean;
		disableSync: boolean;
		disableAutoCreate: boolean;
		disableFolderNote: boolean;
		enableCollapsing: boolean;
		excludeFromFolderOverview: boolean;
		showFolderNote: boolean;
	};
	hideCollapsingIcon: boolean;
	hideCollapsingIconForEmptyFolders: boolean;
	ignoreAttachmentFolder: boolean;
	tabManagerEnabled: boolean;
	deleteFilesAction: 'delete' | 'trash' | 'obsidianTrash';
	openSidebar: {
		mobile: boolean;
		desktop: boolean;
	};
	highlightFolder: boolean;
	persistentSettingsTab: {
		afterRestart: boolean;
		afterChangingTab: boolean;
	};
	firstTimeInsertOverview: boolean;
	fvGlobalSettings: {
		autoUpdateLinks: boolean;
	};
	hideFolderNoteNameInPath: boolean;
	fileExplorerRevealMargin: number;
}

export const DEFAULT_SETTINGS: FolderNotesSettings = {
	syncFolderName: true,
	ctrlKey: true,
	altKey: false,
	hideFolderNote: true,
	templatePath: '',
	autoCreate: false,
	autoCreateFocusFiles: true,
	autoCreateForAttachmentFolder: false,
	autoCreateForFiles: false,
	enableCollapsing: false,
	excludeFolders: [],
	whitelistFolders: [],
	showDeleteConfirmation: true,
	underlineFolder: true,
	stopWhitespaceCollapsing: true,
	underlineFolderInPath: true,
	openFolderNoteOnClickInPath: true,
	openInNewTab: false,
	focusExistingTab: false,
	oldFolderNoteName: undefined,
	folderNoteName: '{{folder_name}}',
	folderNoteType: '.md',
	disableFolderHighlighting: false,
	newFolderNoteName: '{{folder_name}}',
	storageLocation: 'insideFolder',
	syncDelete: false,
	showRenameConfirmation: true,
	defaultOverview: { ...DEFAULT_OVERVIEW_SETTINGS },
	useSubmenus: true,
	syncMove: true,
	frontMatterTitle: {
		enabled: false,
		explorer: true,
		path: true,
	},
	settingsTab: 'general',
	supportedFileTypes: ['md', 'canvas'],
	boldName: false,
	boldNameInPath: false,
	cursiveName: false,
	cursiveNameInPath: false,
	disableOpenFolderNoteOnClick: false,
	openByClick: true,
	openWithCtrl: false,
	openWithAlt: false,
	excludeFolderDefaultSettings: {
		subFolders: false,
		disableSync: false,
		disableAutoCreate: false,
		disableFolderNote: false,
		enableCollapsing: false,
		excludeFromFolderOverview: false,
		showFolderNote: false,
	},
	excludePatternDefaultSettings: {
		subFolders: false,
		disableSync: false,
		disableAutoCreate: false,
		disableFolderNote: false,
		enableCollapsing: false,
		excludeFromFolderOverview: false,
		showFolderNote: false,
	},
	hideCollapsingIcon: false,
	hideCollapsingIconForEmptyFolders: false,
	ignoreAttachmentFolder: false,
	tabManagerEnabled: false,
	deleteFilesAction: 'trash',
	openSidebar: {
		mobile: false,
		desktop: false,
	},
	highlightFolder: true,
	persistentSettingsTab: {
		afterRestart: true,
		afterChangingTab: true,
	},
	firstTimeInsertOverview: false,
	fvGlobalSettings: {
		autoUpdateLinks: true,
	},
	hideFolderNoteNameInPath: false,
	fileExplorerRevealMargin: 100,
};

export type LegacySettingsData = Partial<FolderNotesSettings> & {
	allowWhitespaceCollapsing?: boolean;
	defaultOverview?: defaultOverviewSettings;
};

