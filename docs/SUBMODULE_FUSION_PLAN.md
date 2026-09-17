# Implementation Plan: Submodule Dissolution, In-Tree Fusion & Folder Overview Link Propagation Hardening

## 1. Context & Executive Summary

The `obsidian-folder-overview` submodule (`src/obsidian-folder-overview/`) contains the folder overview code block processor (`folder-overview`) and link list generator. A comprehensive audit revealed deep architectural fragility in the legacy link propagation mechanism, resulting in broken file links, lost background updates, CodeMirror 6 layout distortion, and race conditions on file writes.

This plan details the root causes, presents 3 concrete architectural paths, and maps out the in-tree fusion of the overview subsystem directly into `src/backend/` and `src/frontend/` with zero plugin restart requirements and 100% `data.json` backwards compatibility.

---

## 2. Root Cause Analysis: Why Overview Link Lists Fail & Break Vault Links

Our audit identified **9 intersecting failure points** in the legacy codebase:

### A. IndexedDB (`FvIndexDB`) Desynchronization & Rename Eviction
* **Permanent Index Eviction on Rename**: When a note (or parent folder) is renamed, `VaultSyncHandler` does not notify `FvIndexDB`. On the next background cycle, `getAbstractFileByPath(oldPath)` returns `null`, causing `fvIndexDB.removeNote(oldPath)` to permanently delete the note from the index. The note never receives background link updates again.
* **Missing Index Registration**: Notes are only added to `FvIndexDB` on startup or via the command `Insert folder overview`. If a user creates or pastes a ````folder-overview```` code block manually, it renders in the DOM but is **never registered** in `FvIndexDB`.

### B. The `debounce(...)()` Re-Instantiation Anti-Pattern
* In `main.ts` and `FolderOverview.ts`, `debounce(() => updateAllOverviews(), 2000, true)()` constructs a brand-new debounced closure on every single vault event and immediately executes it. No actual debouncing occurs across events, firing dozens of concurrent `updateAllOverviews()` operations during batch file updates and triggering unqueued disk race conditions.

### C. Top-Level Folder Resolution Bug
* In `functions.ts:71`, `if (!sourceFolderPath.includes('/')) { sourceFolderPath = '/'; }` forcibly overrides any top-level folder (e.g. `folderPath: "Projects"`) to the vault root `'/'`. Background sync then recursively scans the **entire vault** and injects hundreds of unintended links into the note.

### D. Windows CRLF Line Ending Breakage in Regex Parsers
* Code block matchers (`/```folder-overview\n/`) hardcode Unix `\n` without supporting `\r?\n`. On Windows, `hasOverviewYaml()` fails to match ````folder-overview\r\n````, causing startup indexing to skip Windows notes and `updateAllOverviews` to purge them from IndexedDB.

### E. Live Render vs Background Sync Formatting Thrashing
* Background sync flattens the file tree into pure `TFile`s (generating an un-indented flat list), whereas interactive viewing processes `TFolder` hierarchies (generating an indented tree). The file format continuously thrashes between flat and hierarchical lists on disk.

### F. Exponential $O(2^N)$ Event Listener Leak in List Renderer
* `List.ts` registers a new `vault-change` listener on every render without unhooking previous listeners, producing an exponential event leak that degrades UI responsiveness and locks editor buffers.

### G. Unqueued Nested `vault.process()` Disk Conflicts
* Multiple asynchronous writes to the active file execute concurrently without a sequential mutex queue, corrupting note content, wiping the user's undo/redo history, and resetting the cursor in CodeMirror 6.

### H. Callout Blockquote Formatting Desynchronization
* Inserting overviews into callouts omits blockquote `> ` prefixes on span markers, preventing regex searchers from locating the markers and causing link list updates to fail silently.

### I. In-Memory UUID Desynchronization
* If YAML lacks an explicit `id`, a new UUID is generated in memory on every render pass, causing disk search markers (`<span id="...">`) to never match the in-memory ID.

---

## 3. Fragility of Hidden Span Injections in CodeMirror 6

```markdown
<!-- Legacy Fragile Pattern: Mutating Markdown Text on Disk -->
```folder-overview
folderPath: "Projects"
useActualLinks: true
```
<span class="fv-link-list-start" id="550e8400-e29b-41d4-a716-446655440000"></span>
- [[Projects/Task A.md|Task A]] <span class="fv-link-list-item"></span>
<span class="fv-link-list-end" id="550e8400-e29b-41d4-a716-446655440000"></span>
```

1. **CodeMirror 6 Height-Map Destruction**: Hiding spans via `.cm-line:has(...) { display: none }` breaks CodeMirror 6's virtualized height map, leading to cursor jumping, arrow key traps, and scroll jitter.
2. **Explicit `.md` Wikilink Bug**: Writing `[[path/note.md|note]]` with explicit `.md` extensions bypasses Obsidian's internal link rename tracking, creating stale, broken links when notes are moved.
3. **Dirty Git Diffs & Sync Conflicts**: Persisting dynamic presentation queries directly into the markdown file causes constant git noise and cloud sync merge conflicts.

---

## 4. Architectural Path Options

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               ARCHITECTURAL PATH TRADE-OFF MATRIX                               │
├───────────────────────┬────────────────────────────┬─────────────────────────────┬──────────────┤
│ Feature / Attribute   │ Option 1: Hardened Mutex   │ Option 2: Pure Dynamic      │ Option 3:    │
│                       │ Disk Injection (Legacy Fix)│ Memory Engine (Zero Disk)   │ Hybrid Engine│
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ Graph View / Backlinks│ Yes (via markdown links)   │ Requires API patch          │ Mode-Dependent
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ Disk Writes           │ Always (when enabled)      │ Zero (0)                    │ Opt-in Only  │
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ Git Diff Cleanliness  │ Polluted                   │ Pristine                    │ Clean by Def.│
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ CodeMirror 6 Stability│ Requires Decoration Plugin │ 100% Native DOM             │ 100% Native  │
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ Undo Stack Integrity  │ Can be disrupted           │ Untouched                   │ Untouched*   │
├───────────────────────┼────────────────────────────┼─────────────────────────────┼──────────────┤
│ data.json Backwards   │ 100% Compatible            │ 100% Compatible             │ 100% Compat. │
│ Plugin Restarts Req.  │ None (0)                   │ None (0)                    │ None (0)     │
└───────────────────────┴────────────────────────────┴─────────────────────────────┴──────────────┘
```

### Option 1: Hardened Mutex Disk Injection
* Fix all 9 bugs, replace IndexedDB with `MetadataCache`-backed memory indexing, add a sequential `VaultWriteQueue` mutex, and fix wikilink formats (`[[path|name]]` without `.md`).
* Still writes links to disk when `useActualLinks: true`.

### Option 2: Pure Dynamic Memory Engine (Zero Disk Writes)
* Render overview lists and cards dynamically via `MarkdownPostProcessorContext` directly in DOM.
* Zero disk writes, zero Git noise, zero CodeMirror conflicts.
* Dynamic links do not automatically appear in native Graph View without internal API integration.

### Option 3: Hybrid Architecture with Dual-Mode Link Generation (Recommended)
* **Default Mode (`useActualLinks: false`)**: Pure dynamic memory rendering. Zero disk writes, maximum speed, pristine git diffs.
* **Opt-in Mode (`useActualLinks: true`)**: Hardened, debounced `VaultWriteQueue` with atomic mutex writes, standard wikilinks (`[[path|name]]`), CRLF compatibility, and safe block markers.
* Provides a one-click vault utility: `"Folder Notes: Clean legacy overview link markers from vault notes"`.

---

## 5. Submodule Dissolution & In-Tree Fusion Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SUBMODULE AUDIT & IN-TREE FUSION BLUEPRINT                                │
├────────────────────────────────────────────────────────────┬───────────────────────────────────────────┤
│ Source File (in src/obsidian-folder-overview/)             │ In-Tree Target & Structural Action        │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/FolderOverview.ts                                      │                                           │
│   - Logic (sorting, filtering, YAML parsing, traversal)    │ -> src/backend/overview/FolderOverviewLogic.ts │
│   - UI (MarkdownRenderChild, DOM build, context menus)     │ -> src/frontend/overview/OverviewPostProcessor.ts│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/LinkList.ts                                      │ -> src/backend/overview/LinkListService.ts│
│   (AST-safe, CRLF-safe, standard wikilink formatter)       │                                           │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/IndexDB.ts                                       │ -> src/backend/overview/OverviewIndexService.ts│
│   (Replace IDB with MetadataCache-backed memory index)     │                                           │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/functions.ts                                     │ -> src/backend/overview/overviewUtils.ts  │
│   (Token resolver, path normalization, safe title parser)  │                                           │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/styles/List.ts                                         │ -> src/frontend/overview/renderers/       │
│   (Fix listener leak, clean virtualized list renderer)     │    ListOverviewRenderer.ts                │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/styles/FileExplorer.ts                                 │ -> src/frontend/overview/renderers/       │
│   (Clean DOM builder without cloning global explorer)      │    ExplorerOverviewRenderer.ts            │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/styles/Cards.ts                                        │ -> src/frontend/overview/renderers/       │
│   (Wire up active Cards view, fix debounce bug)            │    CardsOverviewRenderer.ts               │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/styles/Grid.ts (empty stub `export {};`)               │ -> DELETE (dead code)                     │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/view.ts (ItemView leaf)                                │ -> src/frontend/views/FolderOverviewView.ts│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/modals/Settings.ts                                     │ -> src/frontend/modals/FolderOverviewModal.ts│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/settings.ts (Settings UI definitions)                  │ -> src/frontend/settings/FolderOverviewSettingsSection.ts│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/Commands.ts                                            │ -> Merge into src/Commands.ts             │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/EventEmitter.ts                                  │ -> DELETE (use src/backend/events/EventEmitter.ts)│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/ListComponent.ts                                 │ -> DELETE (use src/frontend/components/ListComponent.ts)│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/utils/FmtpHandler.ts                                   │ -> DELETE (use src/backend/events/FrontMatterTitle.ts)│
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/suggesters/FolderSuggester.ts & FileSuggester.ts       │ -> DELETE (use src/frontend/suggesters/)  │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ src/main.ts (Submodule standalone entrypoint)              │ -> DISSOLVE COMPLETELY                    │
├────────────────────────────────────────────────────────────┼───────────────────────────────────────────┤
│ .gitmodules / package.json (`fv-build`, `fv-dev`)          │ -> PURGE submodule configs & scripts      │
└────────────────────────────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 6. Proposed Changes

### [Backend Layer]

#### [NEW] [`src/backend/overview/FolderOverviewLogic.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/overview/FolderOverviewLogic.ts)
- Pure business logic for YAML configuration parsing, sorting algorithms (`alphabetical`, `modifiedTime`, `createdTime`), recursive/depth-limited folder filtering, and note candidate resolution.

#### [NEW] [`src/backend/overview/OverviewIndexService.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/overview/OverviewIndexService.ts)
- High-performance in-memory index backed by Obsidian's `metadataCache.on('changed')` and vault event listeners. Automatically handles file renames, creates, and deletes without stale paths or IndexedDB locks.

#### [NEW] [`src/backend/overview/LinkListService.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/overview/LinkListService.ts)
- CRLF-safe, AST-aware link generator. Formats standard Obsidian wikilinks (`[[path/name|name]]` without `.md`), preserves callout prefixes (`> `), and prevents format thrashing.

#### [NEW] [`src/backend/overview/VaultWriteQueue.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/overview/VaultWriteQueue.ts)
- Sequential asynchronous mutex queue ensuring that file modifications never clash or corrupt active editor buffers.

#### [NEW] [`src/backend/overview/overviewUtils.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/overview/overviewUtils.ts)
- Path resolution functions supporting top-level folders, root `'/'`, dynamic context tokens (`"File’s parent folder path"`), and property interpolation.

#### [MODIFY] [`src/backend/types/settings.ts`](file:///F:/.repo/obsidian-folder-notes/src/backend/types/settings.ts)
- Reconcile `FolderNotesSettings` and `DEFAULT_SETTINGS.defaultOverview` with the canonical overview schema, ensuring 100% roundtrip compatibility with legacy `data.json`.

---

### [Frontend Layer]

#### [NEW] [`src/frontend/overview/OverviewPostProcessor.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/overview/OverviewPostProcessor.ts)
- Codeblock postprocessor for ````folder-overview```` registering lifecycle-managed `MarkdownRenderChild` instances.

#### [NEW] [`src/frontend/overview/renderers/ListOverviewRenderer.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/overview/renderers/ListOverviewRenderer.ts)
- Clean, event-safe List overview renderer with proper listener cleanup.

#### [NEW] [`src/frontend/overview/renderers/CardsOverviewRenderer.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/overview/renderers/CardsOverviewRenderer.ts)
- Card-based overview renderer displaying file thumbnails, descriptions, and tag metadata.

#### [NEW] [`src/frontend/overview/renderers/ExplorerOverviewRenderer.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/overview/renderers/ExplorerOverviewRenderer.ts)
- File tree overview renderer with collapsible folder nodes.

#### [NEW] [`src/frontend/views/FolderOverviewView.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/views/FolderOverviewView.ts)
- Side leaf `ItemView` for inspecting and configuring overview blocks.

#### [NEW] [`src/frontend/modals/FolderOverviewModal.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/modals/FolderOverviewModal.ts)
- Modal dialog for editing code block settings.

#### [MODIFY] [`src/frontend/settings/FolderOverviewSettingsSection.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/settings/FolderOverviewSettingsSection.ts)
- Native settings UI for global overview defaults without submodule indirection.

#### [MODIFY] [`src/frontend/modals/ExcludeFolderModal.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/modals/ExcludeFolderModal.ts), [`PatternModal.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/modals/PatternModal.ts), [`WhitelistFolderModal.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/modals/WhitelistFolderModal.ts), [`WhitelistPatternModal.ts`](file:///F:/.repo/obsidian-folder-notes/src/frontend/modals/WhitelistPatternModal.ts)
- Fix broken import paths directly pointing to `src/backend/types/exclude`.

---

### [Submodule Dissolution & Cleanup]

#### [DELETE] [`src/obsidian-folder-overview/`](file:///F:/.repo/obsidian-folder-notes/src/obsidian-folder-overview/)
- Delete submodule directory, remove `.gitmodules` entries, and prune obsolete `package.json` scripts (`fv-build`, `fv-dev`).

#### [MODIFY] [`src/main.ts`](file:///F:/.repo/obsidian-folder-notes/src/main.ts) & [`src/Commands.ts`](file:///F:/.repo/obsidian-folder-notes/src/Commands.ts)
- Wire lifecycle registration directly to `src/backend/overview/` and `src/frontend/overview/`.

---

## 7. Verification Plan

### Automated Tests
- `bun test --preload ./tests/obsidian_mock.ts`
- Add new test suites:
  - `tests/test_overview_logic.test.ts`: Sorting, depth filtering, top-level path resolution.
  - `tests/test_link_list_service.test.ts`: CRLF safety, callout blockquote formatting, wikilink format validation (`[[path|name]]` without `.md`).
  - `tests/test_overview_index_service.test.ts`: Metadata cache tracking, rename handling, and eviction prevention.

### Build & Package Verification
- `bun run build:css` (Dart Sass compilation)
- `bun run build` (ESBuild bundle generation)
- `bun run package` (Release verification in `dist/`)
