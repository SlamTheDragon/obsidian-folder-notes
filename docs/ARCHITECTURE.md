# Obsidian Folder Notes — Architecture & Subsystems

This document outlines the software architecture, module decomposition, lifecycle events, and design rules for the **Obsidian Folder Notes** plugin.

---

## 1. System Decomposition & Module Layering

The plugin is structured into five modular layers:

```
+-------------------------------------------------------------------------+
│                              VIEWS LAYER                                │
│  File Explorer Overlay  •  Breadcrumb Injector  •  Folder Overview      │
│  Components: ListComponent, SettingsTab, ExclusionModals                │
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
│                           EVENT & HOOK LAYER                            │
│  MutationObserver (File Explorer)  •  handleClick (Click Interception)  │
│  handleRename (Sync Sync)          •  handleCreate / handleDelete       │
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
│                         CORE FUNCTIONAL LAYER                           │
│  folderNoteFunctions: Path calculations, Token replacements, Open/Create│
│  styleFunctions: DOM class injection (.has-folder-note, active highlights│
│  template: Note templating and metadata variable substitutions           │
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
│                          STORAGE & VAULT LAYER                          │
│  Obsidian Vault API • data.json settings • Markdown/Canvas/Excalidraw   │
+-------------------------------------------------------------------------+
```

---

## 2. Core Subsystems

### A. File Explorer Mutation Observer (`src/events/MutationObserver.ts`)
- **Dynamic DOM Binding**: Observes the Obsidian File Explorer leaf for newly rendered folder items.
- **Idempotency**: Efficiently tracks affected paths and updates `.has-folder-note` CSS markers without causing layout thrashing or redraw loops.
- **Breadcrumb Synchronization**: Injects clickable breadcrumbs in note headers allowing fast parent folder note navigation.

### B. Click Interception & Navigation (`src/events/handleClick.ts`)
- **Configurable Click Triggers**: Intercepts folder element clicks according to user preferences (`Single Click`, `Ctrl+Click`, `Alt+Click`).
- **Seamless Note Opening**: Routes folder clicks to either reveal folder contents, open the associated folder note, or trigger interactive folder note creation.

### C. Folder Note Resolver (`src/functions/folderNoteFunctions.ts`)
- **Deterministic Storage Locations**:
  - `insideFolder`: Note resides at `<folderPath>/<folderName>.md`.
  - `parentFolder`: Note resides at `<parentFolderPath>/<folderName>.md`.
  - `vaultFolder`: Note resides at `<vaultRoot>/<folderName>.md`.
- **Naming Template Engine**: Replaces `{{folder_name}}` tokens dynamically.

### D. Settings & Preferences Engine (`src/settings/`)
- **Modular Sub-Tabs**: Splits configuration across General, File Explorer, Path, Excluded Folders, and Folder Overview tabs.
- **Persistent State**: Settings are loaded on plugin startup and persisted via Obsidian's `data.json` API.

---

## 3. Invariant Contracts

1. **Zero Unicode Emojis**: Use Lucide SVG icons exclusively in UI views, notices, modals, and settings tabs (`setIcon(el, "...")`).
2. **Safe Mutation Cycles**: DOM listeners must be debounced and cleaned up on plugin unload.
3. **Non-Destructive File Syncing**: Renaming and deleting folders must strictly verify user confirmation flags before performing operations.

---

## 4. Source Tree Layout & Build Packaging

- **`src/`**: TypeScript source code and modules.
- **`public/`**: Static source assets (`public/manifest.json`, `public/styles.css`).
- **`dist/`**: Generated release bundle (`dist/main.js`, `dist/manifest.json`, `dist/styles.css`). Excluded from VCS via `.gitignore`.
- **`tests/`**: In-repo automated test harness running natively on Bun.

