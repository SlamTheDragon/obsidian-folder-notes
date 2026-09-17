export type includeTypes =
	| 'folder'
	| 'markdown'
	| 'canvas'
	| 'other'
	| 'pdf'
	| 'image'
	| 'audio'
	| 'video'
	| 'all';

export type OverviewSortBy = 'name' | 'created' | 'modified';

export type OverviewStyle = 'list' | 'grid' | 'explorer' | 'cards';

export interface defaultOverviewSettings {
	id: string;
	folderPath: string;
	title: string;
	showTitle: boolean;
	depth: number;
	includeTypes: includeTypes[];
	style: OverviewStyle;
	disableFileTag: boolean;
	sortBy: OverviewSortBy;
	sortByAsc: boolean;
	showEmptyFolders: boolean;
	onlyIncludeSubfolders: boolean;
	storeFolderCondition: boolean;
	showFolderNotes: boolean;
	disableCollapseIcon: boolean;
	alwaysCollapse: boolean;
	autoSync: boolean;
	allowDragAndDrop: boolean;
	hideLinkList: boolean;
	hideFolderOverview: boolean;
	useActualLinks: boolean;
	fmtpIntegration: boolean;
	titleSize: number;
	isInCallout: boolean;
	useWikilinks: boolean;
}

export const OVERVIEW_SETTINGS: defaultOverviewSettings = {
	id: '',
	folderPath: '',
	title: '{{folderName}} overview',
	showTitle: false,
	depth: 3,
	includeTypes: ['folder', 'markdown'],
	style: 'list',
	disableFileTag: false,
	sortBy: 'name',
	sortByAsc: true,
	showEmptyFolders: false,
	onlyIncludeSubfolders: false,
	storeFolderCondition: true,
	showFolderNotes: false,
	disableCollapseIcon: true,
	alwaysCollapse: false,
	autoSync: true,
	allowDragAndDrop: true,
	hideLinkList: true,
	hideFolderOverview: false,
	useActualLinks: false,
	fmtpIntegration: false,
	titleSize: 1,
	isInCallout: false,
	useWikilinks: true,
};

export const DEFAULT_OVERVIEW_SETTINGS = OVERVIEW_SETTINGS;

export interface globalOverviewSettings {
	autoUpdateLinks: boolean;
}

export const DEFAULT_GLOBAL_OVERVIEW_SETTINGS: globalOverviewSettings = {
	autoUpdateLinks: false,
};
