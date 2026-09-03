import type { App, TAbstractFile, Plugin } from 'obsidian';

export interface FileExplorerPluginLike extends Plugin {
	revealInFolder: (file: TAbstractFile) => void;
}

export interface DragManagerLike {
	draggable?: {
		file?: TAbstractFile;
		type?: string;
	} | null;
	setAction(action: string): void;
}

export interface ClipboardManagerLike {
	app: App & {
		dragManager?: DragManagerLike;
	};
	handleDragOver: (evt: DragEvent, ...args: unknown[]) => void;
	handleDrop: (evt: DragEvent, ...args: unknown[]) => void;
}

export interface EditModeLike {
	clipboardManager: ClipboardManagerLike;
}

export interface ViewWithEditModes {
	editMode?: EditModeLike;
	sourceMode?: EditModeLike;
}

export interface ActiveEditorLike {
	editMode?: EditModeLike;
}
