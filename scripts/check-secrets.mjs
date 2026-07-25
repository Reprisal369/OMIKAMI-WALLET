#!/usr/bin/env node
/**
 * OMIKAMI WALLET — basic secret gate (THREAT_MODEL A2/F5).
 * Best-effort local scan; CI additionally runs a dedicated secret scanner.
 * Fails on: 32-byte hex values (potential private keys), PEM private keys,
 * common cloud/API key shapes, and non-example .env files in the tree.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', 'out', 'dist', 'coverage', '.git']);
const SKIP_FILES = new Set(['pnpm-lock.yaml']);
const RULES = [
  [/\b0x[0-9a-fA-F]{64}\b/, 'possible 32-byte key (0x + 64 hex)'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bsk-[A-Za-z0-9]{24,}\b/, 'secret API key shape'],
];

const violations = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (SKIP_FILES.has(name)) continue;
    if (/^\.env(?!\.example$)/.test(name)) {
      violations.push(`${p} — non-example .env file present in the tree`);
      continue;
    }
    if (st.size > 2_000_000) continue;
    let text;
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const [re, msg] of RULES) {
      lines.forEach((line, i) => {
        if (re.test(line)) violations.push(`${p}:${i + 1} — ${msg}`);
      });
    }
  }
}
walk('.');

if (violations.length > 0) {
  console.error(`SECRET GATE FAILED (${violations.length}):\n` + violations.join('\n'));
  process.exit(1);
}
console.log('secret gate: OK (0 findings)');
