import { Modal, type App, Setting, ButtonComponent, type TFile } from 'obsidian';
import type FolderNotesPlugin from '../../main';
import {
	rebuildOverviewContainer,
	purgeOverviewContainer,
	decoupleOverviewContainer,
	type TamperDetectionResult,
} from '../../backend/overview/LinkListService';
import { Logger } from '../../backend/utils/Logger';

export class TamperedOverviewModal extends Modal {
	private plugin: FolderNotesPlugin;
	private file: TFile;
	private detections: TamperDetectionResult[];
	private onResolved?: () => void;

	constructor(
		app: App,
		plugin: FolderNotesPlugin,
		file: TFile,
		detections: TamperDetectionResult[],
		onResolved?: () => void,
	) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.detections = detections;
		this.onResolved = onResolved;
	}

	public onOpen(): void {
		Logger.getInstance().logInteraction('TamperedOverviewModal_Open', {
			file: this.file.path,
			detectionCount: this.detections.length,
		}, 'TamperedOverviewModal.onOpen');
		this.display();
	}

	public display(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Folder Overview Structure Discrepancy' });

		contentEl.createEl('p', {
			text: `One or more link list containers in "${this.file.basename}" appear tampered, broken, or orphaned from their parent codeblock.`,
			cls: 'setting-item-description',
		});

		const detectionList = contentEl.createEl('div', { cls: 'fn-tamper-detection-list' });
		for (const det of this.detections) {
			const itemEl = detectionList.createEl('div', { cls: 'fn-tamper-item' });
			itemEl.createEl('strong', {
				text: det.type === 'orphaned'
					? 'Orphaned Link Container'
					: det.type === 'broken-tags'
						? 'Corrupted / Broken Container Tags'
						: 'Mismatched Container Structure',
			});
			itemEl.createEl('p', {
				text: `${det.details} (ID: ${det.id.slice(0, 8)}...)`,
				cls: 'setting-item-description',
			});
		}

		contentEl.createEl('h3', { text: 'Choose Remediation Action' });

		new Setting(contentEl)
			.setName('Rebuild & Restore Structure')
			.setDesc('Re-synthesize valid container wrappers and regenerate links from vault state.')
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText('Rebuild & Restore')
					.setCta()
					.onClick(async () => {
						for (const det of this.detections) {
							await rebuildOverviewContainer(this.plugin, this.file, det.id);
						}
						this.close();
						this.onResolved?.();
					}),
			);

		new Setting(contentEl)
			.setName('Complete Cleanup / Purge')
			.setDesc('Completely remove all orphaned or tampered wrapper blocks and their enclosed links.')
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText('Purge Containers')
					.setWarning()
					.onClick(async () => {
						for (const det of this.detections) {
							await purgeOverviewContainer(this.plugin, this.file, det.id);
						}
						this.close();
						this.onResolved?.();
					}),
			);

		new Setting(contentEl)
			.setName('Decouple to Static Plain Text')
			.setDesc('Strip wrapper markup and leave current links as standard static Markdown text.')
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText('Decouple as Plain Text')
					.onClick(async () => {
						for (const det of this.detections) {
							await decoupleOverviewContainer(this.plugin, this.file, det.id);
						}
						this.close();
						this.onResolved?.();
					}),
			);

		new Setting(contentEl)
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText('Cancel / Restore Structure')
					.onClick(async () => {
						for (const det of this.detections) {
							await rebuildOverviewContainer(this.plugin, this.file, det.id);
						}
						this.close();
						this.onResolved?.();
					}),
			);
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
