import { App, Modal, Setting, Notice } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import { Logger } from '../../backend/utils/Logger';

export class UserFindingModal extends Modal {
	private plugin: FolderNotesPlugin;
	private findingText = '';

	constructor(app: App, plugin: FolderNotesPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('fn-finding-modal');

		contentEl.createEl('h2', { text: 'Record Diagnostic Finding / Observation' });
		contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Enter your observation, unexpected behavior, or expected outcome. This will be correlated with recent user interactions and execution timestamps in debug.log.',
		});

		new Setting(contentEl)
			.setName('Observation / Feedback')
			.setDesc('Describe what action you performed, what you expected, and what actually occurred.')
			.addTextArea((text) => {
				text
					.setPlaceholder('e.g., I renamed folder "Alpha" to "Beta" but the note was still "Alpha - Index.md"...')
					.setValue(this.findingText)
					.onChange((value) => {
						this.findingText = value;
					});
				text.inputEl.rows = 5;
				text.inputEl.style.width = '100%';
				text.inputEl.focus();
			});

		new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					});
			})
			.addButton((btn) => {
				btn.setButtonText('Submit Finding')
					.setCta()
					.onClick(() => {
						this.submitFinding();
					});
			});
	}

	private submitFinding(): void {
		if (!this.findingText.trim()) {
			new Notice('Please enter an observation before submitting.');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		const contextSnapshot = {
			activeFilePath: activeFile?.path ?? null,
			activeFolderDomPath: this.plugin.activeFolderDom?.getAttribute('data-path') ?? null,
			storageLocation: this.plugin.settings.storageLocation,
			folderNoteName: this.plugin.settings.folderNoteName,
			syncFolderName: this.plugin.settings.syncFolderName,
			hideFolderNote: this.plugin.settings.hideFolderNote,
			timestamp: new Date().toISOString(),
		};

		Logger.getInstance().logFinding(this.findingText.trim(), contextSnapshot);
		new Notice('Diagnostic finding saved to debug.log');
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
