# Development & Runtime Environment

This project is built and verified with modern JavaScript/TypeScript tooling using **Bun** and **Node.js LTS (v26.7.0 / v22.x)**.

---

## Tooling & Runtime Matrix

| Runtime / Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v26.7.0` (or `v22.x` LTS) | JavaScript runtime & ecosystem support |
| **NVM** | `1.2.x+` (Windows) / `0.40.x+` | Node Version Manager (`.nvmrc` targets `26.7.0`) |
| **Bun** | `1.3.x+` | Primary high-performance test runner, bundler & script executor |
| **esbuild** | `0.24.x+` | Production TypeScript bundling & tree-shaking |

---

## Environment Setup with NVM

```bash
# Switch to the configured Node version
nvm use 26.7.0

# Verify active version
node -v
```

---

## Unified Development & Build Pipeline

All workflows are orchestrated via **Bun**:

```bash
# Install dependencies
bun install

# Run all automated test suites
bun run test:all

# Build for development / production & sync to test vault
bun run build

# Package distribution files (dist/main.js, dist/manifest.json, dist/styles.css)
bun run package
```

---

## Vault Synchronization (`.env`)

To automatically synchronize compiled files to an active Obsidian test vault upon building:
1. Copy `.env.example` to `.env`.
2. Set `OBSIDIAN_VAULT_DIR` to your plugin directory:
   ```env
   OBSIDIAN_VAULT_DIR=C:/Users/Username/Documents/MyVault/.obsidian/plugins/folder-notes
   ```
3. Run `bun run dev` or `bun run build`. Files in `dist/` will be copied directly to the vault.

