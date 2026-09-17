import {
	Modal,
	type App,
	type MarkdownPostProcessorContext,
	Setting,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings, includeTypes, OverviewSortBy, OverviewStyle } from '../../backend/types/overview';
import { buildYamlConfig } from '../../backend/overview/overviewUtils';
import { updateYaml } from '../../backend/overview/FolderOverviewLogic';
import { FolderSuggest } from '../suggesters/FolderSuggester';
import { Logger } from '../../backend/utils/Logger';

const ALL_FILE_TYPES: { key: includeTypes; label: string }[] = [
	{ key: 'folder', label: 'Folders' },
	{ key: 'markdown', label: 'Markdown Notes (.md)' },
	{ key: 'canvas', label: 'Canvas (.canvas)' },
	{ key: 'pdf', label: 'PDF Documents (.pdf)' },
	{ key: 'image', label: 'Images (jpg, png, gif, svg, webp)' },
	{ key: 'audio', label: 'Audio files (mp3, wav, m4a, etc.)' },
	{ key: 'video', label: 'Video files (mp4, webm, mov, etc.)' },
	{ key: 'other', label: 'Other file extensions' },
];

export class FolderOverviewModal extends Modal {
	private plugin: FolderNotesPlugin;
	public yaml: defaultOverviewSettings;
	private ctx?: MarkdownPostProcessorContext;
	private el?: HTMLElement;
	private defaultSettings: defaultOverviewSettings;

	constructor(
		app: App,
		plugin: FolderNotesPlugin,
		yaml: defaultOverviewSettings,
		ctx?: MarkdownPostProcessorContext,
		el?: HTMLElement,
		defaultSettings?: defaultOverviewSettings,
	) {
		super(app);
		this.plugin = plugin;
		this.ctx = ctx;
		this.el = el;
		this.defaultSettings = defaultSettings ?? plugin.settings.defaultOverview;
		this.yaml = this.initializeYaml(yaml, ctx, this.defaultSettings);
	}

	private initializeYaml(
		yaml: defaultOverviewSettings,
		ctx: MarkdownPostProcessorContext | undefined,
		defaultSettings: defaultOverviewSettings,
	): defaultOverviewSettings {
		if (!yaml) {
			return { ...defaultSettings };
		}
		if (ctx) {
			const includeTypes =
				yaml?.includeTypes ||
				defaultSettings.includeTypes ||
				['folder', 'markdown'];
			return buildYamlConfig(yaml, defaultSettings, ctx, includeTypes);
		}
		return { ...yaml };
	}

	public onOpen(): void {
		Logger.getInstance().logInteraction('FolderOverviewModal_Open', {
			id: this.yaml.id,
			folderPath: this.yaml.folderPath,
			sourcePath: this.ctx?.sourcePath,
		}, 'FolderOverviewModal.onOpen');
		this.display();
	}

	public display(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Folder Overview Settings' });

		// --- Section: General & Target ---
		contentEl.createEl('h3', { text: 'General & Target' });

		new Setting(contentEl)
			.setName('Target folder')
			.setDesc('Path of the folder to display (leave empty for current note\'s parent folder)')
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl);
				search.setValue(this.yaml.folderPath || '').onChange((value) => {
					this.yaml.folderPath = value;
					this.saveOverview();
				});
			});

		new Setting(contentEl)
			.setName('Auto sync')
			.setDesc('Automatically update overview when files or folders are created, renamed, or deleted')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.autoSync).onChange((value) => {
					this.yaml.autoSync = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Allow drag and drop')
			.setDesc('Enable dragging items from the overview into other views or notes')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.allowDragAndDrop).onChange((value) => {
					this.yaml.allowDragAndDrop = value;
					this.saveOverview();
				}),
			);

		// --- Section: Layout & Presentation ---
		contentEl.createEl('h3', { text: 'Layout & Presentation' });

		new Setting(contentEl)
			.setName('Presentation style')
			.setDesc('Visual layout mode for items in the overview')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('list', 'List')
					.addOption('cards', 'Cards')
					.addOption('explorer', 'File explorer')
					.setValue(this.yaml.style || 'list')
					.onChange((value: string) => {
						this.yaml.style = value as OverviewStyle;
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Scan depth')
			.setDesc('How many levels of nested subfolders to include')
			.addSlider((slider) =>
				slider
					.setValue(this.yaml.depth ?? 3)
					.setLimits(1, 10, 1)
					.setDynamicTooltip()
					.onChange((value) => {
						this.yaml.depth = value;
						this.saveOverview();
					}),
			);

		// --- Section: Title & Heading ---
		contentEl.createEl('h3', { text: 'Title & Heading' });

		new Setting(contentEl)
			.setName('Show title')
			.setDesc('Display a title heading above the overview')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showTitle).onChange((value) => {
					this.yaml.showTitle = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Title template')
			.setDesc('Template string (supports {{folderName}}, {{folderPath}}, {{fileName}})')
			.addText((text) =>
				text.setValue(this.yaml.title || '').onChange((value) => {
					this.yaml.title = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Title heading level')
			.setDesc('Heading size from H1 to H6')
			.addSlider((slider) =>
				slider
					.setValue(this.yaml.titleSize ?? 1)
					.setLimits(1, 6, 1)
					.setDynamicTooltip()
					.onChange((value) => {
						this.yaml.titleSize = value;
						this.saveOverview();
					}),
			);

		// --- Section: Sorting & Ordering ---
		contentEl.createEl('h3', { text: 'Sorting & Ordering' });

		new Setting(contentEl)
			.setName('Sort by')
			.setDesc('Attribute to sort files and folders')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('name', 'Name')
					.addOption('created', 'Creation time')
					.addOption('modified', 'Modification time')
					.setValue(this.yaml.sortBy || 'name')
					.onChange((value: string) => {
						this.yaml.sortBy = value as OverviewSortBy;
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Sort order')
			.setDesc('Ascending or Descending')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('true', 'Ascending (A-Z / Oldest first)')
					.addOption('false', 'Descending (Z-A / Newest first)')
					.setValue(String(this.yaml.sortByAsc ?? true))
					.onChange((value) => {
						this.yaml.sortByAsc = value === 'true';
						this.saveOverview();
					}),
			);

		// --- Section: Folders & Visibility ---
		contentEl.createEl('h3', { text: 'Folders & Visibility' });

		new Setting(contentEl)
			.setName('Show folder notes')
			.setDesc('Include linked folder notes as standalone file entries in the overview')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showFolderNotes).onChange((value) => {
					this.yaml.showFolderNotes = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Show empty folders')
			.setDesc('Show folders even when they contain no matching files')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showEmptyFolders).onChange((value) => {
					this.yaml.showEmptyFolders = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Only include subfolders')
			.setDesc('Exclude root-level files and only list subfolders')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.onlyIncludeSubfolders).onChange((value) => {
					this.yaml.onlyIncludeSubfolders = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Disable collapse icon')
			.setDesc('Hide the fold/unfold triangle indicator on folders in list/cards')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.disableCollapseIcon).onChange((value) => {
					this.yaml.disableCollapseIcon = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Always collapse folders')
			.setDesc('Default folders to collapsed state on initial render')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.alwaysCollapse).onChange((value) => {
					this.yaml.alwaysCollapse = value;
					this.saveOverview();
				}),
			);

		// --- Section: File Types to Include ---
		contentEl.createEl('h3', { text: 'File Types to Include' });
		const typeDesc = contentEl.createEl('p', {
			text: 'Select which types of vault items appear in this overview:',
			cls: 'setting-item-description',
		});

		const currentTypes = new Set<string>(this.yaml.includeTypes || ['folder', 'markdown']);

		for (const type of ALL_FILE_TYPES) {
			new Setting(contentEl)
				.setName(type.label)
				.addToggle((toggle) =>
					toggle.setValue(currentTypes.has(type.key)).onChange((checked) => {
						if (checked) {
							currentTypes.add(type.key);
						} else {
							currentTypes.delete(type.key);
						}
						this.yaml.includeTypes = Array.from(currentTypes) as includeTypes[];
						this.saveOverview();
					}),
				);
		}

		// --- Section: Graph View & Markdown Links ---
		contentEl.createEl('h3', { text: 'Graph View & Markdown Links' });

		new Setting(contentEl)
			.setName('Use actual markdown links')
			.setDesc('Inject real markdown links into note content so items appear connected in Obsidian Graph View')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.useActualLinks).onChange((value) => {
					this.yaml.useActualLinks = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Hide link list')
			.setDesc('Hide the injected link list markup when in Reading or Live Preview mode')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.hideLinkList).onChange((value) => {
					this.yaml.hideLinkList = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Use wikilinks format')
			.setDesc('Format injected links as [[filename]] rather than markdown [filename](path)')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.useWikilinks).onChange((value) => {
					this.yaml.useWikilinks = value;
					this.saveOverview();
				}),
			);
	}

	private saveOverview(): void {
		Logger.getInstance().logInteraction('FolderOverviewModal_Save', {
			id: this.yaml.id,
			folderPath: this.yaml.folderPath,
			style: this.yaml.style,
			useActualLinks: this.yaml.useActualLinks,
		}, 'FolderOverviewModal.saveOverview');

		if (this.ctx) {
			void updateYaml(this.plugin, this.ctx, this.el, this.yaml, this.yaml.useActualLinks);
		}
	}
}

