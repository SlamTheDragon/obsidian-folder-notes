import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Repository Invariants & Quality Audit', () => {
  it('verifies public/manifest.json and public/styles.css exist', () => {
    const manifestPath = path.resolve('public/manifest.json');
    const stylesPath = path.resolve('public/styles.css');

    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(stylesPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.id).toBe('folder-notes');
    expect(typeof manifest.version).toBe('string');
  });

  it('verifies .nvmrc and .env.example exist', () => {
    expect(fs.existsSync(path.resolve('.nvmrc'))).toBe(true);
    expect(fs.existsSync(path.resolve('.env.example'))).toBe(true);
  });

  it('verifies scripts directory contains required automation scripts', () => {
    expect(fs.existsSync(path.resolve('scripts/package.mjs'))).toBe(true);
    expect(fs.existsSync(path.resolve('scripts/version-bump.mjs'))).toBe(true);
    expect(fs.existsSync(path.resolve('scripts/extract-release-notes.mjs'))).toBe(true);
  });

  it('verifies .agents rules and skills exist', () => {
    expect(fs.existsSync(path.resolve('.agents/rules/clarification-and-handover.md'))).toBe(true);
    expect(fs.existsSync(path.resolve('.agents/skills/folder-notes-studio/SKILL.md'))).toBe(true);
  });
});

