import fs from 'fs';
import path from 'path';

const changelogPath = path.resolve('CHANGELOG.md');
const packageJsonPath = path.resolve('package.json');

if (!fs.existsSync(changelogPath)) {
  console.log('[Release Notes] No CHANGELOG.md found. Using default release notes.');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = pkg.version;
const content = fs.readFileSync(changelogPath, 'utf8');

const regex = new RegExp(`##\\s*\\[?${currentVersion.replace(/\./g, '\\.')}\\]?[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
const match = content.match(regex);

if (match) {
  const notes = match[0].trim();
  console.log(notes);
  fs.writeFileSync('RELEASE_NOTES.tmp.md', notes, 'utf8');
} else {
  console.log(`[Release Notes] Release notes for ${currentVersion} not found in CHANGELOG.md.`);
}

