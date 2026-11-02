import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// core must stay pure TS so the native wrappers (Capacitor/Tauri) can reuse it unchanged.
const FORBIDDEN_GLOBALS = /\b(document|window|navigator|localStorage|sessionStorage|HTML\w*Element)\b/;
const IMPORTS_UI = /from\s+['"][^'"]*\/ui\//;
const coreDir = import.meta.dirname;

function coreSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return coreSourceFiles(path);
    return /\.(m?ts|tsx)$/.test(entry.name) && !/\.test\.(m?ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// Strip block comments and // comments that start a line or follow whitespace (keeps 'https://...').
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1');

describe('src/core boundary', () => {
  const files = coreSourceFiles(coreDir);

  it('finds core source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s uses no browser globals or DOM types', (file) => {
    expect(stripComments(readFileSync(file, 'utf8'))).not.toMatch(FORBIDDEN_GLOBALS);
  });

  it.each(files)('%s does not import from src/ui', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(IMPORTS_UI);
  });
});
