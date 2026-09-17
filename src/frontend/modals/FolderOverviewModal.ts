import {
	Modal,
	type App,
	type MarkdownPostProcessorContext,
	type TFile,
	Setting,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings, includeTypes } from '../../backend/types/overview';
import { getFolderPathFromString, buildYamlConfig } from '../../backend/overview/overviewUtils';
import { updateYaml } from '../../backend/overview/FolderOverviewLogic';
import { FolderSuggest } from '../suggesters/FolderSuggester';

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
		this.display();
	}

	public display(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Folder Overview Settings' });

		new Setting(contentEl)
			.setName('Auto sync')
			.setDesc('Choose if the overview should automatically update on vault changes')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.autoSync).onChange((value) => {
					this.yaml.autoSync = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Show title')
			.setDesc('Choose if the title above the folder overview should be shown')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showTitle).onChange((value) => {
					this.yaml.showTitle = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Title')
			.setDesc('Title template (supports {{folderName}}, {{folderPath}}, {{fileName}})')
			.addText((text) =>
				text.setValue(this.yaml.title).onChange((value) => {
					this.yaml.title = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Folder path')
			.setDesc('Path of the folder to display (leave empty for current folder)')
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl);
				search.setValue(this.yaml.folderPath).onChange((value) => {
					this.yaml.folderPath = value;
					this.saveOverview();
				});
			});

		new Setting(contentEl)
			.setName('Style')
			.setDesc('Visual presentation style')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('list', 'List')
					.addOption('cards', 'Cards')
					.addOption('explorer', 'File explorer')
					.setValue(this.yaml.style)
					.onChange((value: any) => {
						this.yaml.style = value;
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Depth')
			.setDesc('How deep into subfolders the overview should scan')
			.addSlider((slider) =>
				slider
					.setValue(this.yaml.depth)
					.setLimits(1, 10, 1)
					.setDynamicTooltip()
					.onChange((value) => {
						this.yaml.depth = value;
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Sort by')
			.setDesc('Criteria to sort files and folders')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('name', 'Name')
					.addOption('created', 'Creation time')
					.addOption('modified', 'Modification time')
					.setValue(this.yaml.sortBy)
					.onChange((value: any) => {
						this.yaml.sortBy = value;
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Sort order')
			.setDesc('Ascending or Descending')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('true', 'Ascending (A-Z / Old-New)')
					.addOption('false', 'Descending (Z-A / New-Old)')
					.setValue(String(this.yaml.sortByAsc))
					.onChange((value) => {
						this.yaml.sortByAsc = value === 'true';
						this.saveOverview();
					}),
			);

		new Setting(contentEl)
			.setName('Show folder notes')
			.setDesc('Display folder notes alongside regular files in the overview')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showFolderNotes).onChange((value) => {
					this.yaml.showFolderNotes = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Use actual markdown links')
			.setDesc('Inject clickable markdown links into the note document for Graph View integration')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.useActualLinks).onChange((value) => {
					this.yaml.useActualLinks = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Hide link list')
			.setDesc('Hide the injected link list in Live Preview / Reading mode')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.hideLinkList).onChange((value) => {
					this.yaml.hideLinkList = value;
					this.saveOverview();
				}),
			);
	}

	private saveOverview(): void {
		if (this.ctx) {
			void updateYaml(this.plugin, this.ctx, this.el, this.yaml, this.yaml.useActualLinks);
		}
	}
}
