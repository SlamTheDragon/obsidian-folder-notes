# Folder Notes Standards & Storage Configurations

This document outlines the standard conventions, file path resolution patterns, and naming rules supported by **Folder Notes**.

---

## 1. Storage Location Modes

| Storage Location | Description | Note Path Example |
| :--- | :--- | :--- |
| **`insideFolder`** *(Default)* | Note resides directly inside the target folder. | `Projects/ProjectA/ProjectA.md` |
| **`parentFolder`** | Note resides next to the target folder in the parent directory. | `Projects/ProjectA.md` |
| **`vaultFolder`** | Note resides at the root level of the vault. | `ProjectA.md` |

---

## 2. Naming Conventions & Templates

- **Default Name Template**: `{{folder_name}}`
- **Dynamic Variable Substitution**:
  - `{{folder_name}}`: Replaced with the basename of the containing folder.
- **Custom Name Formats**:
  - `index` $\to$ `Folder/index.md`
  - `README` $\to$ `Folder/README.md`
  - `{{folder_name}} Note` $\to$ `Folder/Folder Note.md`

---

## 3. Supported File Types

- **Markdown**: `.md` *(Default)*
- **Canvas**: `.canvas`
- **Excalidraw**: `.excalidraw` / `.excalidraw.md`
- **Interactive Choice**: `.ask` (Prompts user upon creation)

