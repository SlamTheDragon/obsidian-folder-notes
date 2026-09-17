import {
	ItemView,
	Setting,
	type TFile,
	type WorkspaceLeaf,
} from 'obsidian';
import type FolderNotesPlugin from '../../main';
import type { defaultOverviewSettings } from '../../backend/types/overview';
import { FolderSuggest } from '../suggesters/FolderSuggester';

export const FOLDER_OVERVIEW_VIEW = 'folder-overview-view';

export class FolderOverviewView extends ItemView {
	private plugin: FolderNotesPlugin;
	public activeFile: TFile | null = null;
	public yaml: defaultOverviewSettings;
	private contentElRef: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: FolderNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.yaml = { ...plugin.settings.defaultOverview };
		this.contentElRef = this.containerEl.children[1] as HTMLElement;

		this.registerEvent(
			this.plugin.app.workspace.on('file-open', (file) => {
				this.activeFile = file;
				this.display();
			}),
		);
	}

	public getViewType(): string {
		return FOLDER_OVERVIEW_VIEW;
	}

	public getDisplayText(): string {
		return 'Folder Overview settings';
	}

	public getIcon(): string {
		return 'settings';
	}

	public async onOpen(): Promise<void> {
		this.activeFile = this.plugin.app.workspace.getActiveFile();
		this.display();
	}

	public display(): void {
		const contentEl = this.contentElRef || (this.containerEl.children[1] as HTMLElement);
		contentEl.empty();

		contentEl.createEl('h4', {
			cls: 'fn-folder-overview-header',
			text: 'Folder Overview Settings',
		});

		if (!this.activeFile) {
			contentEl.createEl('p', {
				text: 'No active markdown note opened.',
				cls: 'setting-item-description',
			});
			return;
		}

		new Setting(contentEl)
			.setName('Target folder')
			.setDesc('Folder path for the active overview')
			.addSearch((search) => {
				new FolderSuggest(this.plugin.app, search.inputEl);
				search.setValue(this.yaml.folderPath).onChange((value) => {
					this.yaml.folderPath = value;
				});
			});

		new Setting(contentEl)
			.setName('Style')
			.setDesc('Presentation layout')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('list', 'List')
					.addOption('cards', 'Cards')
					.addOption('explorer', 'File explorer')
					.setValue(this.yaml.style)
					.onChange((value: any) => {
						this.yaml.style = value;
					}),
			);

		new Setting(contentEl)
			.setName('Auto sync')
			.setDesc('Automatically update on vault changes')
			.addToggle((toggle) =>
				toggle.setValue(this.yaml.autoSync).onChange((value) => {
					this.yaml.autoSync = value;
				}),
			);
	}
}
