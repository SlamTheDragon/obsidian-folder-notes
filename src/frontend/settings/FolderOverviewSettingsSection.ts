import { Setting } from 'obsidian';
import type { SettingsTab } from './SettingsTab';
import { FolderSuggest } from '../suggesters/FolderSuggester';

export async function renderFolderOverview(settingsTab: SettingsTab): Promise<void> {
	const { plugin } = settingsTab;
	const overview = plugin.settings.defaultOverview;
	const containerEl = settingsTab.settingsPage;

	containerEl.createEl('h3', { text: 'Global overview settings' });

	new Setting(containerEl)
		.setName('Auto-update links without opening the overview')
		.setDesc('If enabled, the links that appear in the graph view will be updated even when you don\'t have the overview open somewhere.')
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.fvGlobalSettings.autoUpdateLinks)
				.onChange(async (value) => {
					plugin.settings.fvGlobalSettings.autoUpdateLinks = value;
					await plugin.saveSettings();
					if (value) {
						await plugin.overviewIndexService?.init(true);
					}
				}),
		);

	containerEl.createEl('h3', { text: 'Overviews default settings' });
	const pEl = containerEl.createEl('p', {
		text: 'Edit the default settings for new folder overviews, ',
		cls: 'setting-item-description',
	});
	const span = createSpan({ text: "this won't apply to already existing overviews.", cls: '' });
	const accentColor = (settingsTab.app.vault.getConfig('accentColor') as string) || '#7d5bed';
	span.setAttr('style', `color: ${accentColor};`);
	pEl.appendChild(span);

	new Setting(containerEl)
		.setName('Auto sync')
		.setDesc('Automatically update overview when you delete, create or rename files/folders')
		.addToggle((toggle) =>
			toggle.setValue(overview.autoSync).onChange(async (value) => {
				overview.autoSync = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Allow drag and drop')
		.setDesc('Enable drag and drop within overview items')
		.addToggle((toggle) =>
			toggle.setValue(overview.allowDragAndDrop).onChange(async (value) => {
				overview.allowDragAndDrop = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Show title')
		.setDesc('Show a title header above the folder overview')
		.addToggle((toggle) =>
			toggle.setValue(overview.showTitle).onChange(async (value) => {
				overview.showTitle = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Title template')
		.setDesc('Default title template (supports {{folderName}}, {{folderPath}}, {{fileName}})')
		.addText((text) =>
			text.setValue(overview.title).onChange(async (value) => {
				overview.title = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Title size')
		.setDesc('Heading level (1 to 6)')
		.addSlider((slider) =>
			slider
				.setValue(overview.titleSize)
				.setLimits(1, 6, 1)
				.setDynamicTooltip()
				.onChange(async (value) => {
					overview.titleSize = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Default presentation style')
		.setDesc('Choose between List, Cards, or File explorer layout')
		.addDropdown((dropdown) =>
			dropdown
				.addOption('list', 'List')
				.addOption('cards', 'Cards')
				.addOption('explorer', 'File explorer')
				.setValue(overview.style)
				.onChange(async (value: any) => {
					overview.style = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Default scan depth')
		.setDesc('How deep into nested subfolders the overview should scan')
		.addSlider((slider) =>
			slider
				.setValue(overview.depth)
				.setLimits(1, 10, 1)
				.setDynamicTooltip()
				.onChange(async (value) => {
					overview.depth = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Sort by')
		.setDesc('Default sort criteria')
		.addDropdown((dropdown) =>
			dropdown
				.addOption('name', 'Name')
				.addOption('created', 'Creation time')
				.addOption('modified', 'Modification time')
				.setValue(overview.sortBy)
				.onChange(async (value: any) => {
					overview.sortBy = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Sort order')
		.setDesc('Default sort order')
		.addDropdown((dropdown) =>
			dropdown
				.addOption('true', 'Ascending (A-Z / Old-New)')
				.addOption('false', 'Descending (Z-A / New-Old)')
				.setValue(String(overview.sortByAsc))
				.onChange(async (value) => {
					overview.sortByAsc = value === 'true';
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName('Show empty folders')
		.setDesc('Show folders even if they contain no files')
		.addToggle((toggle) =>
			toggle.setValue(overview.showEmptyFolders).onChange(async (value) => {
				overview.showEmptyFolders = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Show folder notes')
		.setDesc('Show folder notes as separate entries in overview lists')
		.addToggle((toggle) =>
			toggle.setValue(overview.showFolderNotes).onChange(async (value) => {
				overview.showFolderNotes = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Use actual markdown links')
		.setDesc('Inject real markdown wikilinks into notes so they appear in native Obsidian Graph View')
		.addToggle((toggle) =>
			toggle.setValue(overview.useActualLinks).onChange(async (value) => {
				overview.useActualLinks = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Hide link list')
		.setDesc('Hide the injected markdown link list in Reading / Live Preview mode')
		.addToggle((toggle) =>
			toggle.setValue(overview.hideLinkList).onChange(async (value) => {
				overview.hideLinkList = value;
				await plugin.saveSettings();
			}),
		);
}

export default renderFolderOverview;
