import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// core must stay pure TS so the native wrappers (Capacitor/Tauri) can reuse it unchanged.
const FORBIDDEN = /\b(document|window|navigator|localStorage|sessionStorage)\b/;
const coreDir = import.meta.dirname;

function coreSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return coreSourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('src/core boundary', () => {
  it.each(coreSourceFiles(coreDir))('%s uses no browser globals', (file) => {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(FORBIDDEN);
  });
});
