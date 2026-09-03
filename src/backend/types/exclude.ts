import type FolderNotesPlugin from '../../main';
import { generateId } from '../utils/idUtils';

export class ExcludedFolder {
	type: string;
	id: string;
	path: string;
	string: string;
	subFolders: boolean;
	disableSync: boolean;
	disableAutoCreate: boolean;
	disableFolderNote: boolean;
	enableCollapsing: boolean;
	position: number;
	excludeFromFolderOverview: boolean;
	hideInSettings: boolean;
	detached: boolean = false;
	detachedFilePath?: string;
	showFolderNote: boolean;
	constructor(path: string, position: number, id: string | undefined, plugin: FolderNotesPlugin) {
		this.type = 'folder';
		this.id = id || generateId();
		this.path = path;
		this.subFolders = plugin.settings.excludeFolderDefaultSettings.subFolders;
		this.disableSync = plugin.settings.excludeFolderDefaultSettings.disableSync;
		this.disableAutoCreate = plugin.settings.excludeFolderDefaultSettings.disableAutoCreate;
		this.disableFolderNote = plugin.settings.excludeFolderDefaultSettings.disableFolderNote;
		this.enableCollapsing = plugin.settings.excludeFolderDefaultSettings.enableCollapsing;
		this.position = position;
		this.excludeFromFolderOverview = plugin.settings.excludeFolderDefaultSettings.excludeFromFolderOverview;
		this.string = '';
		this.hideInSettings = false;
		this.showFolderNote = plugin.settings.excludeFolderDefaultSettings.showFolderNote;
	}
}

export class ExcludePattern {
	type: string;
	id: string;
	string: string;
	path: string;
	position: number;
	subFolders: boolean;
	disableSync: boolean;
	disableAutoCreate: boolean;
	disableFolderNote: boolean;
	enableCollapsing: boolean;
	excludeFromFolderOverview: boolean;
	hideInSettings: boolean;
	detached: boolean = false;
	detachedFilePath?: string;
	showFolderNote: boolean;
	constructor(
		pattern: string,
		position: number,
		id: string | undefined,
		plugin: FolderNotesPlugin,
	) {
		this.type = 'pattern';
		this.id = id || generateId();
		this.string = pattern;
		this.position = position;
		this.subFolders = plugin.settings.excludePatternDefaultSettings.subFolders;
		this.disableSync = plugin.settings.excludePatternDefaultSettings.disableSync;
		this.disableAutoCreate = plugin.settings.excludePatternDefaultSettings.disableAutoCreate;
		this.disableFolderNote = plugin.settings.excludePatternDefaultSettings.disableFolderNote;
		this.enableCollapsing = plugin.settings.excludePatternDefaultSettings.enableCollapsing;
		this.excludeFromFolderOverview = plugin.settings.excludePatternDefaultSettings.excludeFromFolderOverview;
		this.path = '';
		this.hideInSettings = false;
		this.showFolderNote = plugin.settings.excludePatternDefaultSettings.showFolderNote;
	}
}

export class WhitelistedFolder {
	type: string;
	id: string;
	path: string;
	string: string;
	subFolders: boolean;
	enableSync: boolean = false;
	enableAutoCreate: boolean = false;
	enableFolderNote: boolean = false;
	disableCollapsing: boolean = false;
	showInFolderOverview: boolean = false;
	hideInFileExplorer: boolean = false;
	position: number;
	hideInSettings: boolean = false;
	constructor(path: string, position: number, id: string | undefined, plugin: FolderNotesPlugin) {
		this.type = 'folder';
		this.id = id || generateId();
		this.path = path;
		this.subFolders = plugin.settings.excludeFolderDefaultSettings.subFolders;
		this.position = position;
		this.string = '';
	}
}

export class WhitelistedPattern {
	type: string;
	id: string;
	string: string;
	path: string;
	position: number;
	subFolders: boolean;
	enableSync: boolean = false;
	enableAutoCreate: boolean = false;
	enableFolderNote: boolean = false;
	disableCollapsing: boolean = false;
	showInFolderOverview: boolean = false;
	hideInFileExplorer: boolean = false;
	hideInSettings: boolean = false;
	constructor(
		pattern: string,
		position: number,
		id: string | undefined,
		plugin: FolderNotesPlugin,
	) {
		this.type = 'pattern';
		this.id = id || generateId();
		this.subFolders = plugin.settings.excludePatternDefaultSettings.subFolders;
		this.position = position;
		this.string = pattern;
		this.path = '';
	}
}
