import {
	Notice,
	PluginSettingTab,
	TFile,
	TFolder,
	type App,
	type MarkdownPostProcessorContext,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { ExcludedFolder } from '../../ExcludeFolders/ExcludeFolder';
import { extractFolderName, getFolderNote } from '../../backend/core/FolderNoteResolver';
import type { defaultOverviewSettings } from '../../obsidian-folder-overview/src/FolderOverview';
import { renderGeneral } from './GeneralSettingsSection';
import { renderFileExplorer } from './FileExplorerSettingsSection';
import { renderPath } from './PathSettingsSection';
import { renderFolderOverview } from './FolderOverviewSettingsSection';
import { renderExcludeFolders } from './ExcludedFoldersSettingsSection';
import { getFolderPathFromString } from '../../backend/utils/pathUtils';

export class SettingsTab extends PluginSettingTab {
	plugin: FolderNotesPlugin;
	app: App;
	excludeFolders!: ExcludedFolder[];
	settingsPage!: HTMLElement;
	showFolderNameInTabTitleSetting!: boolean;

	TABS = {
		GENERAL: {
			name: 'General',
			id: 'general',
		},
		FOLDER_OVERVIEW: {
			name: 'Folder overview',
			id: 'folder_overview',
		},
		EXCLUDE_FOLDERS: {
			name: 'Exclude folders',
			id: 'exclude_folders',
		},
		FILE_EXPLORER: {
			name: 'File explorer',
			id: 'file_explorer',
		},
		PATH: {
			name: 'Path',
			id: 'path',
		},
	};

	constructor(app: App, plugin: FolderNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.app = app;
	}

	renderSettingsPage(tabId: string): void {
		if (!this.settingsPage) return;
		this.settingsPage.empty();
		switch (tabId.toLocaleLowerCase()) {
			case this.TABS.GENERAL.id:
				void renderGeneral(this);
				break;
			case this.TABS.FOLDER_OVERVIEW.id:
				void renderFolderOverview(this);
				break;
			case this.TABS.EXCLUDE_FOLDERS.id:
				void renderExcludeFolders(this);
				break;
			case this.TABS.FILE_EXPLORER.id:
				void renderFileExplorer(this);
				break;
			case this.TABS.PATH.id:
				void renderPath(this);
				break;
		}
	}

	display(
		_contentEl?: HTMLElement,
		_yaml?: defaultOverviewSettings,
		plugin?: FolderNotesPlugin,
		_defaultSettings?: boolean,
		_display?: CallableFunction,
		_el?: HTMLElement,
		_ctx?: MarkdownPostProcessorContext,
		_file?: TFile | null,
		settingsTab?: this,
	): void {
		plugin = this?.plugin ?? plugin;
		if (plugin) {
			plugin.settingsOpened = true;
		}
		settingsTab = this ?? settingsTab;
		const { containerEl } = settingsTab;
		if (plugin && !plugin.settings.persistentSettingsTab.afterChangingTab) {
			plugin.settings.settingsTab = this.TABS.GENERAL.id;
		}

		containerEl.empty();

		const tabBar = containerEl.createEl('nav', { cls: 'fn-settings-tab-bar' });
		for (const [tabId, tabInfo] of Object.entries(settingsTab.TABS)) {
			const tabEl = tabBar.createEl('div', { cls: 'fn-settings-tab' });
			tabEl.createEl('div', { cls: 'fn-settings-tab-name', text: tabInfo.name });
			if (
				plugin &&
				plugin.settings.settingsTab.toLocaleLowerCase() ===
					tabId.toLocaleLowerCase()
			) {
				tabEl.addClass('fn-settings-tab-active');
			}
			tabEl.addEventListener('click', () => {
				for (const child of Array.from(tabBar.children)) {
					(child as HTMLElement).classList.remove('fn-settings-tab-active');
					if (!plugin) { return; }
					plugin.settings.settingsTab = tabId.toLocaleLowerCase();
					void plugin.saveSettings();
				}
				tabEl.addClass('fn-settings-tab-active');
				if (!settingsTab) { return; }
				settingsTab.renderSettingsPage(tabId);
			});
		}
		settingsTab.settingsPage = containerEl.createDiv({ cls: 'fn-settings-page' });
		if (plugin) {
			if (plugin.settings.persistentSettingsTab) {
				settingsTab.renderSettingsPage(plugin.settings.settingsTab);
			} else {
				settingsTab.renderSettingsPage(this.TABS.GENERAL.id);
			}
		}
	}

	renameFolderNotes(): void {
		new Notice('Starting to update folder notes...');
		const oldTemplate = this.plugin.settings.oldFolderNoteName ?? '{{folder_name}}';

		for (const folder of this.app.vault.getAllLoadedFiles()) {
			if (folder instanceof TFolder) {
				const folderNote = getFolderNote(
					this.plugin,
					folder.path,
					undefined,
					undefined,
					oldTemplate,
				);
				if (!(folderNote instanceof TFile)) { continue; }

				const folderName = extractFolderName(oldTemplate, folderNote.basename) ?? '';
				const newFolderNoteName = this.plugin.settings.folderNoteName
					.replace('{{folder_name}}', folderName);
				let newPath = '';

				if (this.plugin.settings.storageLocation === 'parentFolder') {
					if (getFolderPathFromString(folder.path).trim() === '/') {
						newPath = `${newFolderNoteName}.${folderNote.extension}`;
					} else {
						newPath = `${folderNote.parent?.path}/${newFolderNoteName}.${folderNote.extension}`;
					}
				} else if (this.plugin.settings.storageLocation === 'insideFolder') {
					newPath = `${folder.path}/${newFolderNoteName}.${folderNote.extension}`;
				}

				void this.app.fileManager.renameFile(folderNote, newPath);
			}
		}

		this.plugin.settings.oldFolderNoteName = this.plugin.settings.folderNoteName;
		void this.plugin.saveSettings();
		new Notice('Finished updating folder notes');
	}

	switchStorageLocation(oldMethod: string): void {
		new Notice('Starting to switch storage location...');
		this.app.vault.getAllLoadedFiles().forEach((file) => {
			if (file instanceof TFolder) {
				const folderNote = getFolderNote(this.plugin, file.path, oldMethod);
				if (folderNote instanceof TFile) {
					if (this.plugin.settings.storageLocation === 'parentFolder') {
						let newPath = '';
						if (getFolderPathFromString(file.path).trim() === '' || getFolderPathFromString(file.path) === '/') {
							newPath = `${folderNote.name}`;
						} else {
							newPath = `${getFolderPathFromString(file.path)}/${folderNote.name}`;
						}
						void this.plugin.app.fileManager.renameFile(folderNote, newPath);
					} else if (this.plugin.settings.storageLocation === 'insideFolder') {
						if (getFolderPathFromString(folderNote.path) === file.path) {
							return;
						}
						const newPath = `${file.path}/${folderNote.name}`;
						void this.plugin.app.fileManager.renameFile(folderNote, newPath);
					}
				}
			}
		});
		new Notice('Finished switching storage location');
	}

	onClose(): void {
		this.plugin.settingsOpened = false;
	}
}

export default SettingsTab;
