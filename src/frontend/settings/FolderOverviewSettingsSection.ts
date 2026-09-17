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
		.setName('Only include subfolders')
		.setDesc('Only display contents of immediate subfolders')
		.addToggle((toggle) =>
			toggle.setValue(overview.onlyIncludeSubfolders).onChange(async (value) => {
				overview.onlyIncludeSubfolders = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Disable collapse icon')
		.setDesc('Hide the collapse icon next to folders in list/explorer views')
		.addToggle((toggle) =>
			toggle.setValue(overview.disableCollapseIcon).onChange(async (value) => {
				overview.disableCollapseIcon = value;
				await plugin.saveSettings();
			}),
		);

	new Setting(containerEl)
		.setName('Always collapse folders')
		.setDesc('Default folders to collapsed state on initial load')
		.addToggle((toggle) =>
			toggle.setValue(overview.alwaysCollapse).onChange(async (value) => {
				overview.alwaysCollapse = value;
				await plugin.saveSettings();
			}),
		);

	containerEl.createEl('h4', { text: 'Included File Types' });
	const ALL_FILE_TYPES: { key: any; label: string }[] = [
		{ key: 'folder', label: 'Folders' },
		{ key: 'markdown', label: 'Markdown Notes (.md)' },
		{ key: 'canvas', label: 'Canvas (.canvas)' },
		{ key: 'pdf', label: 'PDF Documents (.pdf)' },
		{ key: 'image', label: 'Images (jpg, png, gif, svg, webp)' },
		{ key: 'audio', label: 'Audio files (mp3, wav, m4a, etc.)' },
		{ key: 'video', label: 'Video files (mp4, webm, mov, etc.)' },
		{ key: 'other', label: 'Other file extensions' },
	];

	for (const fileType of ALL_FILE_TYPES) {
		new Setting(containerEl)
			.setName(fileType.label)
			.addToggle((toggle) => {
				const isIncluded = (overview.includeTypes || []).includes(fileType.key);
				toggle.setValue(isIncluded).onChange(async (value) => {
					let currentTypes = [...(overview.includeTypes || [])];
					if (value && !currentTypes.includes(fileType.key)) {
						currentTypes.push(fileType.key);
					} else if (!value && currentTypes.includes(fileType.key)) {
						currentTypes = currentTypes.filter((t) => t !== fileType.key);
					}
					overview.includeTypes = currentTypes;
					await plugin.saveSettings();
				});
			});
	}

	containerEl.createEl('h4', { text: 'Graph View & Markdown Links' });

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

	new Setting(containerEl)
		.setName('Use wikilinks format')
		.setDesc('Use [[filename]] wikilinks syntax instead of [filename](path) markdown links')
		.addToggle((toggle) =>
			toggle.setValue(overview.useWikilinks).onChange(async (value) => {
				overview.useWikilinks = value;
				await plugin.saveSettings();
			}),
		);
}

export default renderFolderOverview;
