import type { ExcludePattern } from './exclude';
import type { ExcludedFolder } from './exclude';
import type { WhitelistedFolder } from './exclude';
import type { WhitelistedPattern } from './exclude';
import type { defaultOverviewSettings } from '../../obsidian-folder-overview/src/FolderOverview';

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
	excludeFolderDefaultSettings: ExcludedFolder;
	excludePatternDefaultSettings: ExcludePattern;
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
	defaultOverview: {
		id: '',
		folderPath: '',
		style: 'cards',
		includeSubfolders: false,
		sortKey: 'name',
		sortOrder: 'asc',
		fields: ['name', 'path'],
		cardSize: 'medium',
		showBreadcrumbs: true,
		showTags: true,
		titleLength: 0,
		descriptionLength: 0,
		contentLength: 0,
		dateFormat: 'YYYY-MM-DD',
		timeFormat: 'HH:mm',
		customCSS: '',
	},
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
		path: '',
		hideFolder: false,
		disableFolderNote: false,
		disableStyle: false,
		disableAutoCreate: false,
		disableFolderOverview: false,
		id: '',
	},
	excludePatternDefaultSettings: {
		path: '',
		hideFolder: false,
		disableFolderNote: false,
		disableStyle: false,
		disableAutoCreate: false,
		disableFolderOverview: false,
		id: '',
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
