# Obsidian Plugin Release & Discovery Guide

This guide describes the release pipeline and version synchronization for **Folder Notes**.

---

## 1. Version Synchronization Architecture

Three synchronized files govern the plugin's versioning:
1. **`public/manifest.json`**: Primary source manifest containing plugin ID, name, version, minAppVersion.
2. **`versions.json`**: Historical version map required by Obsidian.
3. **`package.json`**: npm package version metadata.

---

## 2. Automated Version Bumping

Run the automated version bumper:

```bash
# For bug fixes (1.8.26 -> 1.8.27)
bun run version:patch

# For minor features (1.8.26 -> 1.9.0)
bun run version:minor

# For major architectural changes (1.8.26 -> 2.0.0)
bun run version:major
```

---

## 3. Packaging & Verification

To verify production bundling and package readiness:

```bash
bun run package
```

The script will compile TypeScript via esbuild, bundle assets into `dist/`, and verify that `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` exist and have non-zero file sizes.

