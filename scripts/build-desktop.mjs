#!/usr/bin/env node
// Assemble desktop/dist for the Tauri app from the score page and the
// generated browser detector. Run by `tauri dev` / `tauri build`.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './codex-bundle.mjs';

const dist = join(ROOT, 'desktop/dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'extension'), { recursive: true });
mkdirSync(join(dist, 'assets'), { recursive: true });
const page = readFileSync(join(ROOT, 'check.html'), 'utf8');
if (!page.includes('</body>')) throw new Error('check.html has no </body>');
writeFileSync(join(dist, 'index.html'), page.replace('</body>', '<script src="desktop.js"></script>\n</body>'));
cpSync(join(ROOT, 'desktop/desktop.js'), join(dist, 'desktop.js'));
cpSync(join(ROOT, 'extension/detector.js'), join(dist, 'extension/detector.js'));
for (const file of ['logo.svg', 'icon-180.png']) cpSync(join(ROOT, 'assets', file), join(dist, 'assets', file));
console.log('built desktop/dist');
