import type FolderNotesPlugin from '../../main';
import {
	type Listener,
	type Events,
	type ApiInterface,
	type DeferInterface,
	type ListenerRef,
	type EventDispatcherInterface,
	getDefer,
} from 'front-matter-plugin-api-provider';
import { type App, TFile, TFolder } from 'obsidian';
import { getFolder, getFolderNote } from '../core/FolderNoteResolver';

interface UpdateData {
	id: string;
	result: boolean;
	path: string;
	pathOnly: boolean;
	breadcrumb?: HTMLElement;
}

interface WrappedUpdateData {
	data: UpdateData;
}

export class FrontMatterTitlePluginHandler {
	plugin: FolderNotesPlugin;
	app!: App;
	api: ApiInterface | null = null;
	deffer: DeferInterface | null = null;
	modifiedFolders: Map<string, TFolder> = new Map();
	eventRef: ListenerRef<'manager:update'> | null = null;
	dispatcher: EventDispatcherInterface<Events> | null = null;
	constructor(plugin: FolderNotesPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;

		(async (): Promise<void> => {
			this.deffer = getDefer(this.app);
			if (this.deffer.isPluginReady()) {
				this.api = this.deffer.getApi();
			} else {
				await this.deffer.awaitPlugin();
				this.api = this.deffer.getApi();
				if (!this.deffer.isFeaturesReady()) {
					await this.deffer.awaitFeatures();
				}
			}
			if (plugin.settings.frontMatterTitle.enabled) {
				const dispatcher = this.api?.getEventDispatcher();
				if (dispatcher) {
					this.dispatcher = dispatcher;
				}
				const event: Listener<Events, 'manager:update'> = {
					name: 'manager:update',
					cb: (data): void => {
						this.fmptUpdateFileName(data as unknown as UpdateData, true);
					},
				};
				const ref = dispatcher?.addListener(event);
				if (ref) {
					this.eventRef = ref;
				}
				plugin.updateAllBreadcrumbs();
			}
		})();
	}

	deleteEvent(): void {
		if (this.eventRef && this.dispatcher) {
			this.dispatcher.removeListener(this.eventRef);
		}
	}

	async fmptUpdateFileName(data: UpdateData, isEvent: boolean): Promise<void> {
		const hasNestedData = 'data' in (data as unknown as Record<string, unknown>);
		const actualData: UpdateData = hasNestedData
			? (data as unknown as WrappedUpdateData).data
			: data;
		const file = this.app.vault.getAbstractFileByPath(actualData.path);
		if (!(file instanceof TFile)) { return; }

		const resolver = this.api?.getResolverFactory()?.createResolver('#feature-id#');
		const newName = resolver?.resolve(file?.path ?? '');
		const folder = getFolder(this.plugin, file);
		if (!(folder instanceof TFolder)) { return; }

		const folderNote = getFolderNote(this.plugin, folder.path);
		if (!folderNote) { return; }
		if (folderNote !== file) { return; }
		if (!actualData.pathOnly) {
			this.plugin.changeFolderNameInExplorer(folder, newName);
		}

		const { breadcrumb } = actualData;
		if (breadcrumb) {
			if (!newName) { return; }
			breadcrumb.innerText = newName;
		}
	}
}
