import {
	ItemView,
	Setting,
	type TFile,
	type WorkspaceLeaf,
	stringifyYaml,
	ButtonComponent,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings, includeTypes, OverviewSortBy, OverviewStyle } from '../../backend/types/overview';
import { FolderSuggest } from '../suggesters/FolderSuggester';
import { getOverviews } from '../../backend/overview/FolderOverviewLogic';
import { updateYamlById } from '../../backend/overview/overviewUtils';
import { Logger } from '../../backend/utils/Logger';

export const FOLDER_OVERVIEW_VIEW = 'folder-overview-view';

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

export class FolderOverviewView extends ItemView {
	private plugin: FolderNotesPlugin;
	public activeFile: TFile | null = null;
	public currentOverviews: defaultOverviewSettings[] = [];
	public selectedOverviewIndex = 0;
	public yaml: defaultOverviewSettings;
	private contentElRef: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: FolderNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.yaml = { ...plugin.settings.defaultOverview };
		this.contentElRef = this.containerEl.children[1] as HTMLElement;

		this.registerEvent(
			this.plugin.app.workspace.on('file-open', async (file) => {
				this.activeFile = file;
				await this.reloadAndDisplay();
			}),
		);

		this.registerEvent(
			this.plugin.app.workspace.on('active-leaf-change', async () => {
				const activeFile = this.plugin.app.workspace.getActiveFile();
				if (activeFile?.path !== this.activeFile?.path) {
					this.activeFile = activeFile;
					await this.reloadAndDisplay();
				}
			}),
		);
	}


	public getViewType(): string {
		return FOLDER_OVERVIEW_VIEW;
	}

	public getDisplayText(): string {
		return 'Folder Overview Settings';
	}

	public getIcon(): string {
		return 'settings';
	}

	public async onOpen(): Promise<void> {
		this.activeFile = this.plugin.app.workspace.getActiveFile();
		await this.reloadAndDisplay();
	}

	public async reloadAndDisplay(): Promise<void> {
		if (this.activeFile && this.activeFile.extension === 'md') {
			this.currentOverviews = await getOverviews(this.plugin, this.activeFile);
			if (this.currentOverviews.length > 0) {
				if (this.selectedOverviewIndex >= this.currentOverviews.length) {
					this.selectedOverviewIndex = 0;
				}
				this.yaml = { ...this.plugin.settings.defaultOverview, ...this.currentOverviews[this.selectedOverviewIndex] };
			}
		} else {
			this.currentOverviews = [];
		}
		this.display();
	}

	public display(): void {
		const contentEl = this.contentElRef || (this.containerEl.children[1] as HTMLElement);
		contentEl.empty();

		contentEl.createEl('h4', {
			cls: 'fn-folder-overview-header',
			text: 'Folder Overview Settings',
		});

		if (!this.activeFile || this.activeFile.extension !== 'md') {
			contentEl.createEl('p', {
				text: 'No active markdown note opened. Open a note to configure its folder overviews.',
				cls: 'setting-item-description',
			});
			return;
		}

		if (this.currentOverviews.length === 0) {
			contentEl.createEl('p', {
				text: `No folder overview codeblock found in "${this.activeFile.basename}".`,
				cls: 'setting-item-description',
			});

			new Setting(contentEl)
				.setName('Insert Folder Overview')
				.setDesc('Add a default folder-overview codeblock to this note')
				.addButton((button: ButtonComponent) =>
					button
						.setButtonText('Insert Overview')
						.setCta()
						.onClick(async () => {
							const newId = crypto.randomUUID();
							const initialConfig = {
								...this.plugin.settings.defaultOverview,
								id: newId,
								folderPath: this.yaml.folderPath || '',
							};
							const block = `\n\`\`\`folder-overview\n${stringifyYaml(initialConfig)}\`\`\`\n`;
							await this.plugin.app.vault.append(this.activeFile!, block);
							Logger.getInstance().logInteraction('FolderOverviewView_InsertBlock', {
								file: this.activeFile?.path,
								id: newId,
							}, 'FolderOverviewView.insertOverview');
							await this.reloadAndDisplay();
						}),
				);
			return;
		}

		// If multiple overviews exist, allow selecting which one to edit
		if (this.currentOverviews.length > 1) {
			new Setting(contentEl)
				.setName('Select overview block')
				.setDesc('Choose which overview in this note to edit')
				.addDropdown((dropdown) => {
					this.currentOverviews.forEach((ov, index) => {
						const label = `Block #${index + 1}: ${ov.folderPath || 'Current Folder'} (${ov.style || 'list'})`;
						dropdown.addOption(String(index), label);
					});
					dropdown.setValue(String(this.selectedOverviewIndex));
					dropdown.onChange((value) => {
						this.selectedOverviewIndex = parseInt(value, 10);
						this.yaml = { ...this.plugin.settings.defaultOverview, ...this.currentOverviews[this.selectedOverviewIndex] };
						this.display();
					});
				});
		}

		// --- Section: General & Target ---
		contentEl.createEl('h5', { text: 'General & Target' });

		new Setting(contentEl)
			.setName('Target folder')
			.setDesc('Folder path for the active overview (leave empty for current parent folder)')
			.addSearch((search) => {
				new FolderSuggest(this.plugin.app, search.inputEl);
				search.setValue(this.yaml.folderPath || '').onChange((value) => {
					this.yaml.folderPath = value;
					this.saveOverview();
				});
			});

		new Setting(contentEl)
			.setName('Auto sync')
			.setDesc('Automatically update on vault changes')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.autoSync).onChange((value) => {
					this.yaml.autoSync = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Allow drag and drop')
			.setDesc('Enable dragging items from overview')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.allowDragAndDrop).onChange((value) => {
					this.yaml.allowDragAndDrop = value;
					this.saveOverview();
				}),
			);

		// --- Section: Layout & Presentation ---
		contentEl.createEl('h5', { text: 'Layout & Presentation' });

		new Setting(contentEl)
			.setName('Style')
			.setDesc('Presentation layout')
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
			.setDesc('Subfolder depth levels to scan')
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
		contentEl.createEl('h5', { text: 'Title & Heading' });

		new Setting(contentEl)
			.setName('Show title')
			.setDesc('Display title heading')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showTitle).onChange((value) => {
					this.yaml.showTitle = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Title template')
			.setDesc('Supports {{folderName}}, {{folderPath}}, {{fileName}}')
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

		// --- Section: Sorting ---
		contentEl.createEl('h5', { text: 'Sorting & Ordering' });

		new Setting(contentEl)
			.setName('Sort by')
			.setDesc('Criteria to sort files')
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
		contentEl.createEl('h5', { text: 'Folders & Visibility' });

		new Setting(contentEl)
			.setName('Show folder notes')
			.setDesc('Display folder notes alongside regular files')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showFolderNotes).onChange((value) => {
					this.yaml.showFolderNotes = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Show empty folders')
			.setDesc('Show folders with no matching files')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.showEmptyFolders).onChange((value) => {
					this.yaml.showEmptyFolders = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Only include subfolders')
			.setDesc('Exclude root files')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.onlyIncludeSubfolders).onChange((value) => {
					this.yaml.onlyIncludeSubfolders = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Disable collapse icon')
			.setDesc('Hide folding chevron')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.disableCollapseIcon).onChange((value) => {
					this.yaml.disableCollapseIcon = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Always collapse folders')
			.setDesc('Default folders collapsed')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.alwaysCollapse).onChange((value) => {
					this.yaml.alwaysCollapse = value;
					this.saveOverview();
				}),
			);

		// --- Section: File Types ---
		contentEl.createEl('h5', { text: 'Included File Types' });
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

		// --- Section: Links & Graph ---
		contentEl.createEl('h5', { text: 'Graph View & Markdown Links' });

		new Setting(contentEl)
			.setName('Use actual markdown links')
			.setDesc('Inject clickable markdown links for Graph View')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.useActualLinks).onChange((value) => {
					this.yaml.useActualLinks = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Hide link list')
			.setDesc('Hide injected links in Reading / Live Preview')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.hideLinkList).onChange((value) => {
					this.yaml.hideLinkList = value;
					this.saveOverview();
				}),
			);

		new Setting(contentEl)
			.setName('Use wikilinks format')
			.setDesc('Use [[filename]] syntax')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.useWikilinks).onChange((value) => {
					this.yaml.useWikilinks = value;
					this.saveOverview();
				}),
			);
	}

	private saveOverview(): void {
		if (!this.activeFile || !this.yaml.id) return;

		Logger.getInstance().logInteraction('FolderOverviewView_Save', {
			id: this.yaml.id,
			file: this.activeFile.path,
			folderPath: this.yaml.folderPath,
			style: this.yaml.style,
		}, 'FolderOverviewView.saveOverview');

		void updateYamlById(
			this.plugin,
			this.yaml.id,
			this.activeFile,
			this.yaml,
			this.yaml.useActualLinks,
			this.yaml.isInCallout ?? false,
		);
	}
}

