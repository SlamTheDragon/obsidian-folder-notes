import { Modal, ButtonComponent } from 'obsidian';
import type FolderNotesPlugin from '../../main';

export class BackupWarningModal extends Modal {
	plugin: FolderNotesPlugin;
	title: string;
	desc: string;
	callback: (oldMethod: string) => void;
	args: [string];

	constructor(
		plugin: FolderNotesPlugin,
		title: string,
		description: string,
		callback: (oldMethod: string) => void,
		args: [string],
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.title = title;
		this.callback = callback;
		this.args = args;
		this.desc = description;
	}

	onOpen(): void {
		this.modalEl.addClass('fn-backup-warning-modal');
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.desc });
		contentEl.createEl('p', { text: 'Make sure to backup your vault before using this feature.' }).addClass('fn-warning-text');

		this.insertCustomHtml();

		const buttonContainer = contentEl.createDiv({ cls: 'fn-modal-button-container' });
		const confirmButton = new ButtonComponent(buttonContainer);
		confirmButton.setButtonText('Confirm')
			.setCta()
			.onClick(() => {
				this.callback(...this.args);
				this.close();
			});

		const cancelButton = new ButtonComponent(buttonContainer);
		cancelButton.setButtonText('Cancel')
			.onClick(() => {
				this.close();
			});
	}

	insertCustomHtml(): void {
		// Can be overridden by subclasses
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default BackupWarningModal;
