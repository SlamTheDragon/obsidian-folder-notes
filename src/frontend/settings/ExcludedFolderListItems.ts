import { ButtonComponent, Platform, Setting } from 'obsidian';
import type { SettingsTab } from './SettingsTab';
import {
	ExcludedFolder,
	ExcludePattern,
	WhitelistedFolder,
	WhitelistedPattern,
} from '../../backend/types/exclude';
import {
	addExcludedFolder,
	deleteExcludedFolder,
	updateExcludedFolder,
	addWhitelistedFolder,
	deleteWhitelistedFolder,
	updateWhitelistedFolder,
} from '../../backend/core/ExcludeService';
import { FolderSuggest } from '../suggesters/FolderSuggester';
import { ExcludeFolderModal } from '../modals/ExcludeFolderModal';
import { PatternModal } from '../modals/PatternModal';
import { WhitelistFolderModal } from '../modals/WhitelistFolderModal';
import { WhitelistPatternModal } from '../modals/WhitelistPatternModal';

export function addExcludeFolderListItem(
	settings: SettingsTab,
	containerEl: HTMLElement,
	excludedFolder: ExcludedFolder,
): void {
	const { plugin } = settings;
	const setting = new Setting(containerEl);
	setting.setClass('fn-exclude-folder-list');
	setting.addSearch((cb) => {
		new FolderSuggest(
			cb.inputEl,
			plugin,
			false,
		);
		cb.containerEl.addClass('fn-exclude-folder-path');
		cb.setPlaceholder('Folder path');
		cb.setValue(excludedFolder.path || '');
		cb.onChange((value) => {
			if (value.startsWith('{regex}') || value.includes('*')) {
				void deleteExcludedFolder(plugin, excludedFolder);
				const pattern = new ExcludePattern(
					value,
					plugin.settings.excludeFolders.length,
					undefined,
					plugin,
				);
				addExcludedFolder(plugin, pattern);
				addExcludePatternListItem(settings, containerEl, pattern);
				setting.clear();
				setting.settingEl.remove();
			}
			if (!plugin.app.vault.getAbstractFileByPath(value)) return;
			excludedFolder.path = value;
			updateExcludedFolder(plugin, excludedFolder, excludedFolder);
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('edit');
		cb.setTooltip('Edit folder note');
		cb.onClick(() => {
			new ExcludeFolderModal(plugin.app, plugin, excludedFolder).open();
		});
	});

	if (Platform.isDesktop || Platform.isTablet) {
		setting.addButton((cb) => {
			cb.setIcon('up-chevron-glyph');
			cb.setTooltip('Move up');
			cb.onClick(() => {
				if (excludedFolder.position === 0) { return; }
				excludedFolder.position -= 1;
				updateExcludedFolder(plugin, excludedFolder, excludedFolder);
				const oldExcludedFolder = plugin.settings.excludeFolders.find(
					(folder: any) => folder.position === excludedFolder.position,
				);
				if (oldExcludedFolder) {
					oldExcludedFolder.position += 1;
					updateExcludedFolder(plugin, oldExcludedFolder as any, oldExcludedFolder as any);
				}
				settings.display();
			});
		});

		setting.addButton((cb) => {
			cb.setIcon('down-chevron-glyph');
			cb.setTooltip('Move down');
			cb.onClick(() => {
				if (excludedFolder.position === plugin.settings.excludeFolders.length - 1) {
					return;
				}
				excludedFolder.position += 1;

				updateExcludedFolder(plugin, excludedFolder, excludedFolder);
				const oldExcludedFolder = plugin.settings.excludeFolders.find(
					(folder: any) => folder.position === excludedFolder.position,
				);
				if (oldExcludedFolder) {
					oldExcludedFolder.position -= 1;
					updateExcludedFolder(plugin, oldExcludedFolder as any, oldExcludedFolder as any);
				}

				settings.display();
			});
		});
	}

	setting.addButton((cb) => {
		cb.setIcon('trash-2');
		cb.setTooltip('Delete excluded folder');
		cb.onClick(() => {
			void deleteExcludedFolder(plugin, excludedFolder);
			setting.clear();
			setting.settingEl.remove();
		});
	});
}

export function addExcludePatternListItem(
	settings: SettingsTab,
	containerEl: HTMLElement,
	pattern: ExcludePattern,
): void {
	const { plugin } = settings;
	const setting = new Setting(containerEl);
	setting.setClass('fn-exclude-folder-list');
	setting.addSearch((cb) => {
		cb.containerEl.addClass('fn-exclude-folder-path');
		cb.setPlaceholder('Pattern');
		cb.setValue(pattern.string);
		cb.onChange((value) => {
			const exists = plugin.settings.excludeFolders.some(
				(folder: any) => folder.string === value,
			);
			if (exists) { return; }
			pattern.string = value;
			updateExcludedFolder(plugin, pattern as any, pattern as any);
		});
	});
	setting.addButton((cb) => {
		cb.setIcon('edit');
		cb.setTooltip('Edit pattern');
		cb.onClick(() => {
			new PatternModal(plugin.app, plugin, pattern).open();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('up-chevron-glyph');
		cb.setTooltip('Move up');
		cb.onClick(() => {
			if (pattern.position === 0) { return; }
			pattern.position -= 1;
			updateExcludedFolder(plugin, pattern as any, pattern as any);
			const oldPattern = plugin.settings.excludeFolders.find(
				(folder: any) => folder.position === pattern.position,
			);
			if (oldPattern) {
				oldPattern.position += 1;
				updateExcludedFolder(plugin, oldPattern as any, oldPattern as any);
			}
			settings.display();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('down-chevron-glyph');
		cb.setTooltip('Move down');
		cb.onClick(() => {
			if (pattern.position === plugin.settings.excludeFolders.length - 1) {
				return;
			}
			pattern.position += 1;

			updateExcludedFolder(plugin, pattern as any, pattern as any);
			const oldPattern = plugin.settings.excludeFolders.find(
				(folder: any) => folder.position === pattern.position,
			);
			if (oldPattern) {
				oldPattern.position -= 1;
				updateExcludedFolder(plugin, oldPattern as any, oldPattern as any);
			}
			settings.display();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('trash-2');
		cb.setTooltip('Delete pattern');
		cb.onClick(() => {
			void deleteExcludedFolder(plugin, pattern as any);
			setting.clear();
			setting.settingEl.remove();
		});
	});
}

export function addWhitelistFolderListItem(
	settings: SettingsTab,
	containerEl: HTMLElement,
	whitelistedFolder: WhitelistedFolder,
): void {
	const { plugin } = settings;
	const setting = new Setting(containerEl);
	setting.setClass('fn-exclude-folder-list');

	const inputContainer = setting.settingEl.createDiv({
		cls: 'fn-whitelist-folder-input-container',
	});
	const searchComponent = new Setting(inputContainer);
	searchComponent.addSearch((cb) => {
		new FolderSuggest(
			cb.inputEl,
			plugin,
			true,
		);
		cb.containerEl.addClass('fn-exclude-folder-path');
		cb.setPlaceholder('Folder path');
		cb.setValue(whitelistedFolder.path);
		cb.onChange((value) => {
			if (value.startsWith('{regex}') || value.includes('*')) {
				void deleteWhitelistedFolder(plugin, whitelistedFolder);
				const pattern = new WhitelistedPattern(
					value,
					plugin.settings.whitelistFolders.length,
					undefined,
					plugin,
				);
				addWhitelistedFolder(plugin, pattern);
				addWhitelistedPatternListItem(settings, containerEl, pattern);
				setting.clear();
				setting.settingEl.remove();
			}
			if (!plugin.app.vault.getAbstractFileByPath(value)) return;
			whitelistedFolder.path = value;
			updateWhitelistedFolder(plugin, whitelistedFolder, whitelistedFolder);
		});
	});
	const buttonContainer = setting.settingEl.createDiv({ cls: 'fn-whitelist-folder-buttons' });

	new ButtonComponent(buttonContainer)
		.setIcon('edit')
		.setTooltip('Edit folder note')
		.onClick(() => {
			new WhitelistFolderModal(plugin.app, plugin, whitelistedFolder).open();
		});

	new ButtonComponent(buttonContainer)
		.setIcon('up-chevron-glyph')
		.setTooltip('Move up')
		.onClick(() => {
			if (whitelistedFolder.position === 0) { return; }
			whitelistedFolder.position -= 1;
			updateWhitelistedFolder(plugin, whitelistedFolder, whitelistedFolder);
			const oldWhitelistedFolder = plugin.settings.whitelistFolders.find(
				(folder: any) => folder.position === whitelistedFolder.position,
			);
			if (oldWhitelistedFolder) {
				oldWhitelistedFolder.position += 1;
				updateWhitelistedFolder(plugin, oldWhitelistedFolder as any, oldWhitelistedFolder as any);
			}
			settings.display();
		});

	new ButtonComponent(buttonContainer)
		.setIcon('down-chevron-glyph')
		.setTooltip('Move down')
		.onClick(() => {
			if (whitelistedFolder.position === plugin.settings.whitelistFolders.length - 1) {
				return;
			}
			whitelistedFolder.position += 1;

			updateWhitelistedFolder(plugin, whitelistedFolder, whitelistedFolder);
			const oldWhitelistedFolder = plugin.settings.whitelistFolders.find(
				(folder: any) => folder.position === whitelistedFolder.position,
			);
			if (oldWhitelistedFolder) {
				oldWhitelistedFolder.position -= 1;
				updateWhitelistedFolder(plugin, oldWhitelistedFolder as any, oldWhitelistedFolder as any);
			}

			settings.display();
		});

	new ButtonComponent(buttonContainer)
		.setIcon('trash-2')
		.setTooltip('Delete excluded folder')
		.onClick(() => {
			void deleteWhitelistedFolder(plugin, whitelistedFolder);
			setting.clear();
			setting.settingEl.remove();
		});
}

export function addWhitelistedPatternListItem(
	settings: SettingsTab,
	containerEl: HTMLElement,
	pattern: WhitelistedPattern,
): void {
	const { plugin } = settings;
	const setting = new Setting(containerEl);
	setting.setClass('fn-exclude-folder-list');
	setting.addSearch((cb) => {
		cb.containerEl.addClass('fn-exclude-folder-path');
		cb.setPlaceholder('Pattern');
		cb.setValue(pattern.string);
		cb.onChange((value) => {
			const exists = plugin.settings.whitelistFolders.some(
				(folder: any) => folder.string === value,
			);
			if (exists) { return; }
			pattern.string = value;
			updateWhitelistedFolder(plugin, pattern as any, pattern as any);
		});
	});
	setting.addButton((cb) => {
		cb.setIcon('edit');
		cb.setTooltip('Edit pattern');
		cb.onClick(() => {
			new WhitelistPatternModal(plugin.app, plugin, pattern).open();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('up-chevron-glyph');
		cb.setTooltip('Move up');
		cb.onClick(() => {
			if (pattern.position === 0) { return; }
			pattern.position -= 1;
			updateWhitelistedFolder(plugin, pattern as any, pattern as any);
			const oldPattern = plugin.settings.whitelistFolders.find(
				(folder: any) => folder.position === pattern.position,
			);
			if (oldPattern) {
				oldPattern.position += 1;
				updateWhitelistedFolder(plugin, oldPattern as any, oldPattern as any);
			}
			settings.display();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('down-chevron-glyph');
		cb.setTooltip('Move down');
		cb.onClick(() => {
			if (pattern.position === plugin.settings.whitelistFolders.length - 1) {
				return;
			}
			pattern.position += 1;

			updateWhitelistedFolder(plugin, pattern as any, pattern as any);
			const oldPattern = plugin.settings.whitelistFolders.find(
				(folder: any) => folder.position === pattern.position,
			);
			if (oldPattern) {
				oldPattern.position -= 1;
				updateWhitelistedFolder(plugin, oldPattern as any, oldPattern as any);
			}
			settings.display();
		});
	});

	setting.addButton((cb) => {
		cb.setIcon('trash-2');
		cb.setTooltip('Delete pattern');
		cb.onClick(() => {
			void deleteWhitelistedFolder(plugin, pattern as any);
			setting.clear();
			setting.settingEl.remove();
		});
	});
}
