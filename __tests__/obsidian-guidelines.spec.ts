// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Static policy checks aligned with Obsidian plugin guidelines.
import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import fs from 'node:fs';
import path from 'node:path';

function read(file: string) {
  return fs.readFileSync(file, 'utf8');
}

// Globs to scan only Notion importer runtime code (exclude unrelated legacy modules)
const RUNTIME_GLOBS = [
  'src/network/notionClient.ts',
  'src/formats/notion-*.ts',
  'src/ui/notion-*.ts',
];

// Helper: collect files
function collectRuntimeFiles(): string[] {
  const files = fg.sync(RUNTIME_GLOBS, { dot: false });
  return files.map((f) => path.resolve(process.cwd(), f));
}

describe('Obsidian Plugin Policy (static)', () => {
  const files = collectRuntimeFiles();

  it('does not use window.app (avoid global app)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = read(f);
      if (/\bwindow\s*\.\s*app\b/.test(text)) offenders.push(f);
    }
    expect(offenders, `window.app used in: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('does not log to console (avoid noisy logs)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = read(f);
      // allow console.error in exceptional paths only if necessary; for now, block all console.* in runtime
      if (/\bconsole\s*\./.test(text)) offenders.push(f);
    }
    expect(offenders, `console.* used in: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('does not use innerHTML/outerHTML/insertAdjacentHTML (XSS risk)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = read(f);
      if (/(innerHTML|outerHTML|insertAdjacentHTML)\s*=|\.(innerHTML|outerHTML|insertAdjacentHTML)\b/.test(text)) offenders.push(f);
    }
    expect(offenders, `dangerous HTML APIs used in: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('does not import Node/Electron APIs in runtime code (mobile safe)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = read(f);
      // Disallow common Node core modules in src runtime
      if (/from\s+['"]node:/.test(text)) offenders.push(f);
      if (/from\s+['"]fs['"]|require\(['"]fs['"]\)/.test(text)) offenders.push(f);
      if (/from\s+['"]child_process['"]|require\(['"]child_process['"]\)/.test(text)) offenders.push(f);
      if (/from\s+['"]electron['"]|require\(['"]electron['"]\)/.test(text)) offenders.push(f);
    }
    expect(offenders, `Node/Electron imports in: ${offenders.join(', ')}`).toHaveLength(0);
  });
});
