import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const hideLineDecoration = Decoration.line({
	class: 'fn-overview-comment-line',
});

function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = view.state.doc.lineAt(pos);
			const text = line.text.trim();
			if (
				text.startsWith('<!-- folder-overview-start') ||
				text.startsWith('<!-- folder-overview-end') ||
				text.startsWith('> <!-- folder-overview-start') ||
				text.startsWith('> <!-- folder-overview-end')
			) {
				builder.add(line.from, line.from, hideLineDecoration);
			}
			pos = line.to + 1;
		}
	}
	return builder.finish();
}

export const overviewCommentHiderExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);
