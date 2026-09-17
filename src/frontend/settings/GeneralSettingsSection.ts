/* eslint-disable max-len */
import { Setting, Platform } from 'obsidian';
import type { SettingsTab } from './SettingsTab';
import { ListComponent } from '../components/ListComponent';
import { AddSupportedFileTypeModal } from '../modals/AddSupportedFileTypeModal';
import { FrontMatterTitlePluginHandler } from '../../backend/events/FrontMatterTitle';
import { CreateFnForEveryFolderModal } from '../modals/CreateFnForEveryFolderModal';
import { TemplateSuggest } from '../suggesters/TemplateSuggester';
import { refreshAllFolderStyles } from '../../backend/utils/domUtils';
import { BackupWarningModal } from '../modals/BackupWarningModal';
import { RenameFolderNotesModal } from '../modals/RenameFolderNotesModal';

let debounceTimer: number | undefined;

export async function renderGeneral(settingsTab: SettingsTab): Promise<void> {
	const containerEl = settingsTab.settingsPage;
	const nameSetting = new Setting(containerEl)
		.setName('Folder note name template')
		.setDesc('All folder notes will use this name. Use {{folder_name}} to insert the folder’s name. Existing notes won’t update automatically; click on the button to apply the new name.')
		.addText((text) =>
			text
				.setValue(settingsTab.plugin.settings.folderNoteName)
				.onChange(async (value) => {
					if (value.trim() === '') { return; }
					settingsTab.plugin.settings.folderNoteName = value;
					await settingsTab.plugin.saveSettings();

					window.clearTimeout(debounceTimer);
					const FOLDER_NOTE_NAME_DEBOUNCE_MS = 2000;
					debounceTimer = window.setTimeout(() => {
						if (!value.includes('{{folder_name}}')) {
							if (!settingsTab.showFolderNameInTabTitleSetting) {
								settingsTab.display();
								settingsTab.showFolderNameInTabTitleSetting = true;
							}
						} else {
							if (settingsTab.showFolderNameInTabTitleSetting) {
								settingsTab.display();
								settingsTab.showFolderNameInTabTitleSetting = false;
							}
						}
					}, FOLDER_NOTE_NAME_DEBOUNCE_MS);
				}),
		)
		.addButton((button) =>
			button
				.setButtonText('Rename existing folder notes')
				.setCta()
				.onClick(async () => {
					new RenameFolderNotesModal(
						settingsTab.plugin,
						'Rename all existing folder notes',
						'When you click on "Confirm" all existing folder notes will be renamed to the new folder note name.',
						// eslint-disable-next-line @typescript-eslint/unbound-method
						settingsTab.renameFolderNotes.bind(settingsTab),
						[settingsTab.plugin.settings.oldFolderNoteName ?? '{{folder_name}}'])
						.open();
				}),
		);

	if (!settingsTab.plugin.settings.folderNoteName.includes('{{folder_name}}')) {
		new Setting(containerEl)
			.setName('Display folder name in tab title')
			.setDesc('Use the actual folder name in the tab title instead of the custom folder note name (e.g., "folder note").')
			.addToggle((toggle) =>
				toggle
					.setValue(settingsTab.plugin.settings.tabManagerEnabled)
					.onChange(async (value) => {
						if (!value) {
							settingsTab.plugin.tabManager.resetTabs();
						} else {
							settingsTab.plugin.settings.tabManagerEnabled = value;
							settingsTab.plugin.tabManager.updateTabs();
						}
						settingsTab.plugin.settings.tabManagerEnabled = value;
						await settingsTab.plugin.saveSettings();
						settingsTab.display();
					}),
			);
	}

	new Setting(containerEl)
		.setName('Default file type for new folder notes')
		.setDesc('Choose the default file type (canvas, Markdown, ...) used when creating new folder notes.')
		.addDropdown((dropdown) => {
			dropdown.addOption('.ask', 'Ask for file type');
			settingsTab.plugin.settings.supportedFileTypes.forEach((type) => {
				if (type === '.md' || type === 'md') {
					dropdown.addOption('.md', 'Markdown');
				} else {
					dropdown.addOption('.' + type, type);
				}
			});

			if (
				!settingsTab.plugin.settings.supportedFileTypes.includes(
					settingsTab.plugin.settings.folderNoteType.replace('.', ''),
				) &&
				settingsTab.plugin.settings.folderNoteType !== '.ask'
			) {
				dropdown.setValue('.md');
				settingsTab.plugin.settings.folderNoteType = '.md';
				void settingsTab.plugin.saveSettings();
			} else {
				dropdown.setValue(settingsTab.plugin.settings.folderNoteType);
			}

			dropdown.onChange(async (value) => {
				settingsTab.plugin.settings.folderNoteType = value;
				await settingsTab.plugin.saveSettings();
				refreshAllFolderStyles(true, settingsTab.plugin);
			});
		});

	const listComponent = new Setting(containerEl)
		.setName('Supported file types for folder notes')
		.setDesc('Folder notes can use any of these file types. The first item in the list will be used if the default is not supported for a folder note.');
	const list = new ListComponent(listComponent.controlEl, settingsTab.plugin.settings.supportedFileTypes, ['md', 'canvas']);
	list.on('update', async (values: string[]) => {
		settingsTab.plugin.settings.supportedFileTypes = values;
		await settingsTab.plugin.saveSettings();
	});

	listComponent.addButton((button) =>
		button
			.setIcon('plus')
			.setTooltip('Add a supported file type')
			.onClick(async () => {
				new AddSupportedFileTypeModal(
					settingsTab.app,
					settingsTab.plugin,
					settingsTab,
					list,
				).open();
			}),
	);

	new Setting(containerEl)
		.setName('Folder note template')
		.setDesc('Choose a template note that is used when a new folder note is created.')
		.addSearch((search) => {
			new TemplateSuggest(search.inputEl, settingsTab.plugin);
			const templateFile = settingsTab.app.vault.getAbstractFileByPath(
				settingsTab.plugin.settings.templatePath,
			);
			search.setValue(
				templateFile?.name.replace('.md', '') ||
				settingsTab.plugin.settings.templatePath ||
				'',
			);
			search.onChange(async (value) => {
				if (value.trim() === '') {
					settingsTab.plugin.settings.templatePath = '';
					await settingsTab.plugin.saveSettings();
				}
			});
		});

	new Setting(containerEl)
		.setName('Auto-create folder notes on new folders')
		.setDesc('Automatically create a folder note whenever a new folder is created.')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.autoCreate)
				.onChange(async (value) => {
					settingsTab.plugin.settings.autoCreate = value;
					await settingsTab.plugin.saveSettings();
					settingsTab.display();
				}),
		);

	if (settingsTab.plugin.settings.autoCreate) {
		new Setting(containerEl)
			.setName('Focus new note after auto-creation')
			.setDesc('Automatically focus the new note after it has been created.')
			.addToggle((toggle) =>
				toggle
					.setValue(settingsTab.plugin.settings.autoCreateFocusFiles)
					.onChange(async (value) => {
						settingsTab.plugin.settings.autoCreateFocusFiles = value;
						await settingsTab.plugin.saveSettings();
					}),
			);
	}

	const storageSetting = new Setting(containerEl)
		.setName('Storage method')
		.setDesc('Choose how folder notes are saved in your vault.')
		.addDropdown((dropdown) =>
			dropdown
				.addOption('insideFolder', 'Inside folder')
				.addOption('parentFolder', 'Outside folder (in parent folder)')
				.setValue(settingsTab.plugin.settings.storageLocation)
				.onChange(async (value: 'insideFolder' | 'parentFolder') => {
					const oldMethod = settingsTab.plugin.settings.storageLocation;
					settingsTab.plugin.settings.storageLocation = value;
					await settingsTab.plugin.saveSettings();
					refreshAllFolderStyles(true, settingsTab.plugin);
					new BackupWarningModal(
						settingsTab.plugin,
						'Switch storage location',
						'When you click on "Confirm" all folder notes will be moved to the new storage location.',
						// eslint-disable-next-line @typescript-eslint/unbound-method
						settingsTab.switchStorageLocation.bind(settingsTab),
						[oldMethod],
					).open();
				}),
		);

	new Setting(containerEl)
		.setName('Auto-sync folder name')
		.setDesc('Automatically rename the folder note when the folder is renamed and vice versa.')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.syncFolderName)
				.onChange(async (value) => {
					settingsTab.plugin.settings.syncFolderName = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Delete folder note action')
		.setDesc('Choose what should happen when a folder note is deleted.')
		.addDropdown((dropdown) =>
			dropdown
				.addOption('trash', 'Move to system trash')
				.addOption('obsidianTrash', 'Move to Obsidian trash (.trash)')
				.addOption('delete', 'Permanently delete')
				.setValue(settingsTab.plugin.settings.deleteFilesAction)
				.onChange(async (value: 'delete' | 'trash' | 'obsidianTrash') => {
					settingsTab.plugin.settings.deleteFilesAction = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Delete folder note on folder deletion')
		.setDesc('Delete the folder note when the corresponding folder is deleted.')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.syncDelete)
				.onChange(async (value) => {
					settingsTab.plugin.settings.syncDelete = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Sync move with folder')
		.setDesc('Automatically move the folder note when its folder is moved (outside-folder storage only).')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.syncMove)
				.onChange(async (value) => {
					settingsTab.plugin.settings.syncMove = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Front Matter Title plugin integration')
		.setDesc('Allows folder notes to use titles defined by the Front Matter Title plugin.')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.frontMatterTitle.enabled)
				.onChange(async (value) => {
					settingsTab.plugin.settings.frontMatterTitle.enabled = value;
					await settingsTab.plugin.saveSettings();
					if (value) {
						settingsTab.plugin.fmtpHandler = new FrontMatterTitlePluginHandler(settingsTab.plugin);
					} else {
						settingsTab.plugin.fmtpHandler?.deleteEvent();
					}
					settingsTab.display();
				}),
		);

	const advanced = containerEl.createEl('details', { cls: 'fn-advanced-settings' });
	advanced.createEl('summary', { text: 'Advanced settings' });

	new Setting(advanced)
		.setName('Show delete confirmation modal')
		.setDesc('Ask for confirmation when deleting a folder note')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.showDeleteConfirmation)
				.onChange(async (value) => {
					settingsTab.plugin.settings.showDeleteConfirmation = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(advanced)
		.setName('Show rename confirmation modal')
		.setDesc('Ask for confirmation when turning a note into a folder note when a folder note already exists')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.showRenameConfirmation)
				.onChange(async (value) => {
					settingsTab.plugin.settings.showRenameConfirmation = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(advanced)
		.setName('Create a folder note for every folder in the vault')
		.setDesc('Creates a folder note for every folder in your vault that doesn’t already have one.')
		.addButton((button) =>
			button
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					new CreateFnForEveryFolderModal(settingsTab.app, settingsTab.plugin).open();
				}),
		);

	// Diagnostics & Telemetry Section
	const diagnostics = containerEl.createEl('details', { cls: 'fn-advanced-settings' });
	diagnostics.createEl('summary', { text: 'Diagnostics, Telemetry & Logging' });

	new Setting(diagnostics)
		.setName('Enable verbose diagnostic logging')
		.setDesc('Write detailed timestamps, execution traces, DOM operations, and user interactions to .obsidian/plugins/folder-notes/debug.log.')
		.addToggle((toggle) =>
			toggle
				.setValue(settingsTab.plugin.settings.enableVerboseLogging !== false)
				.onChange(async (value) => {
					settingsTab.plugin.settings.enableVerboseLogging = value;
					await settingsTab.plugin.saveSettings();
				}),
		);

	new Setting(diagnostics)
		.setName('Record user observation / finding')
		.setDesc('Log a manual observation or issue to correlate with system execution timings.')
		.addButton((button) =>
			button
				.setButtonText('Record Observation')
				.onClick(() => {
					const { UserFindingModal } = require('../modals/UserFindingModal');
					new UserFindingModal(settingsTab.app, settingsTab.plugin).open();
				}),
		);

	new Setting(diagnostics)
		.setName('Run diagnostic self-test suite')
		.setDesc('Execute non-destructive live action tests in the vault (creates/renames test folders, verifies note sync and DOM classes).')
		.addButton((button) =>
			button
				.setButtonText('Run Self-Test')
				.setCta()
				.onClick(async () => {
					const { DiagnosticRunner } = require('../../backend/diagnostics/DiagnosticRunner');
					await new DiagnosticRunner(settingsTab.plugin).runSuite();
				}),
		);

	new Setting(diagnostics)
		.setName('Scan vault telemetry & health')
		.setDesc('Audit all vault folders for orphaned/desynchronized folder notes and missing styling attributes.')
		.addButton((button) =>
			button
				.setButtonText('Scan Health')
				.onClick(async () => {
					const { TelemetryScanner } = require('../../backend/diagnostics/TelemetryScanner');
					await new TelemetryScanner(settingsTab.plugin).scanVaultHealth();
				}),
		);

	new Setting(diagnostics)
		.setName('Clear diagnostic debug log')
		.setDesc('Wipes the contents of .obsidian/plugins/folder-notes/debug.log.')
		.addButton((button) =>
			button
				.setButtonText('Clear Log')
				.setWarning()
				.onClick(async () => {
					const { Logger } = require('../../backend/utils/Logger');
					await Logger.getInstance().clearLog();
					const { Notice } = require('obsidian');
					new Notice('Folder Notes: debug.log cleared.');
				}),
		);
}

export default renderGeneral;
