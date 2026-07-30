#!/usr/bin/env node
/**
 * OMIKAMI WALLET — production bundle gate (THREAT_MODEL F5, Gate 5).
 * Runs AFTER `pnpm build` against apps/web/out.
 * Fails when: (1) a real hostname appears in the bundle that is not on the
 * reviewed allowlist below, or (2) sourcemaps are present in the export.
 * The allowlist mirrors the external-request inventory in PROJECT_STATE.md;
 * additions require a documented review, never a silent edit.
 */
import { readFileSync, readdirSync, statSync, } from 'node:fs';
import { join } from 'node:path';

const OUT = 'apps/web/out';
// Reviewed origins: library-embedded docs/spec URLs + viem default chain
// endpoints + explorer hosts. See PROJECT_STATE.md "External requests".
const ALLOWED_SUFFIXES = [
  'w3.org', 'json-schema.org', 'nextjs.org', 'react.dev', 'reactjs.org',
  'github.com', 'mozilla.org', 'viem.sh', 'wagmi.sh', 'oxlib.sh',
  'abitype.dev', 'soliditylang.org', 'tanstack.com',
  'etherscan.io', 'sourcify.dev', 'merkle.io', 'rpc.thirdweb.com',
  // viem ENS-avatar gateway constants (bundled with ENS name resolution).
  // This app renders NO avatars and makes NO runtime requests to these hosts;
  // reviewed + documented 2026-07-13 (PROJECT_STATE session 4).
  'ipfs.io', 'arweave.net',
  // viem's mainnet chain-definition default RPC constant. viem 2.55.10 changed
  // this to ethereum.reth.rs; it is bundled as a string but NEVER contacted,
  // because `apps/web/src/lib/wagmi.ts` PINS our mainnet transport to
  // eth.merkle.io. Reviewed 2026-07-26 (Dependabot triage, internal pre-audit).
  'reth.rs',
  // RFC 2606 reserved example domains — used only as input placeholder text,
  // never a real endpoint. Reviewed 2026-07-13 (PROJECT_STATE session 4).
  'example.com', 'example.org',
];

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
}
try { walk(OUT); } catch {
  console.error(`bundle gate: ${OUT} not found — run pnpm build first`);
  process.exit(1);
}

const maps = files.filter((f) => f.endsWith('.map'));
const offenders = new Map();
for (const f of files.filter((x) => x.endsWith('.js') || x.endsWith('.html') || x.endsWith('.txt'))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    const host = m[1].toLowerCase();
    if (!host.includes('.')) continue; // minifier artifacts like https://a
    const ok = ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
    if (!ok) offenders.set(host, f);
  }
}

let failed = false;
if (maps.length > 0) {
  failed = true;
  console.error(`BUNDLE GATE: sourcemaps present in production export (${maps.length}):\n` + maps.join('\n'));
}
if (offenders.size > 0) {
  failed = true;
  console.error('BUNDLE GATE: non-allowlisted hostnames in bundle:');
  for (const [host, file] of offenders) console.error(`  ${host}  (${file})`);
}
if (failed) process.exit(1);
console.log(`bundle gate: OK (${files.length} files, 0 unknown hosts, 0 sourcemaps)`);
