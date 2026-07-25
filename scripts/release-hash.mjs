#!/usr/bin/env node
/**
 * OMIKAMI WALLET — reproducible-build hash (RELEASE_CHECKLIST support).
 * Computes a deterministic SHA-256 over every file in the static export
 * (apps/web/out), sorted by path, plus a single combined manifest hash.
 * Two independent builds of the same commit must produce the same manifest
 * hash; divergence is a release blocker. Dependency-free (node:crypto).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const OUT = 'apps/web/out';

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
}
try {
  walk(OUT);
} catch {
  console.error(`release-hash: ${OUT} not found — run "pnpm build" first`);
  process.exit(1);
}

files.sort();
const entries = files.map((f) => {
  const hash = createHash('sha256').update(readFileSync(f)).digest('hex');
  return { path: relative(OUT, f).replace(/\\/g, '/'), sha256: hash };
});

const combined = createHash('sha256');
for (const e of entries) combined.update(`${e.sha256}  ${e.path}\n`);
const manifestHash = combined.digest('hex');

const manifest = {
  tool: 'omikami-release-hash',
  generatedFrom: OUT,
  fileCount: entries.length,
  manifestSha256: manifestHash,
  files: entries,
};
writeFileSync('release-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

console.log(`release-hash: ${entries.length} files`);
console.log(`release-hash: manifest SHA-256 = ${manifestHash}`);
console.log('release-hash: wrote release-manifest.json');
