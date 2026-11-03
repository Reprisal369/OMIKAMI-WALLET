#!/usr/bin/env node
/**
 * OMIKAMI WALLET — forbidden-pattern gate (THREAT_MODEL A1/A2/F2).
 * Fails the build when source code contains key-material APIs, browser
 * storage for sensitive data, raw HTML injection, credential-capable
 * inputs, keystore import surfaces, or dynamic code execution.
 * Design note: user-facing SECURITY COPY may mention "seed phrase" in
 * warnings — this gate targets code capabilities, not vocabulary.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps/web/src', 'packages'];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'out', 'dist', 'coverage']);

const RULES = [
  [/\b(privateKeyToAccount|mnemonicToAccount|hdKeyToAccount|generateMnemonic|generatePrivateKey|HDKey)\b/, 'key-material API forbidden in this codebase (THREAT_MODEL A2)'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'browser storage forbidden without explicit threat-model review (A2/privacy)'],
  [/dangerouslySetInnerHTML/, 'raw HTML injection forbidden (F2)'],
  [/<textarea/i, 'textarea input requires threat-model review before merge (A1)'],
  [/type\s*=\s*["'](password|file)["']/, 'password/file input requires threat-model review before merge (A1)'],
  [/\bkeystore\b/i, 'keystore / JSON-wallet import is impossible by design (A1)'],
  [/\beval\s*\(|new\s+Function\s*\(/, 'dynamic code execution forbidden'],
  // Read-only invariant (internal pre-audit M1): no wallet write/sign/switch
  // API may appear in source. This makes the read-only promise a failing build
  // gate, not just a convention. Adding any of these requires a threat-model
  // sign-off and lifting the read-only phase.
  [/\b(useSendTransaction|useWriteContract|useContractWrite|useSignMessage|useSignTypedData|useSwitchChain|writeContract|sendTransaction|signMessage|signTypedData|switchChain|prepareTransactionRequest)\b/, 'wallet write/sign/switch API forbidden — read-only invariant (M1)'],
];

// The ONE reviewed exception permitted to use browser storage (THREAT_MODEL C1c).
const STORAGE_EXCEPTION = 'apps/web/src/lib/rpc-storage.ts';

// Phase 2 write-surface boundary (PHASE_2_TRANSACTIONS.md §5): the single
// reviewed directory where wallet write/sign/switch APIs may ever live. The
// M1 read-only rule is exempted ONLY here and nowhere else; every other rule
// (key material, storage, raw HTML, eval, …) still applies in this module too.
// The module holds no write code yet (transactions remain disabled) — this
// keeps the eventual write surface tiny, centralized, and auditable.
const WRITE_SURFACE_PREFIX = 'apps/web/src/lib/tx/';

const violations = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (EXT.has(name.slice(name.lastIndexOf('.')))) {
      const text = readFileSync(p, 'utf8');
      const lines = text.split('\n');
      const norm = p.replace(/\\/g, '/');
      const isStorageException = norm.endsWith(STORAGE_EXCEPTION);
      const isWriteSurface = norm.includes(WRITE_SURFACE_PREFIX);
      for (const [re, msg] of RULES) {
        if (isStorageException && msg.includes('browser storage')) continue;
        if (isWriteSurface && msg.includes('read-only invariant (M1)')) continue;
        lines.forEach((line, i) => {
          if (re.test(line)) violations.push(`${p}:${i + 1} — ${msg}\n    ${line.trim().slice(0, 120)}`);
        });
      }
    }
  }
}
for (const root of ROOTS) walk(root);

if (violations.length > 0) {
  console.error(`FORBIDDEN-PATTERN GATE FAILED (${violations.length}):\n` + violations.join('\n'));
  process.exit(1);
}
console.log('forbidden-pattern gate: OK (0 violations)');
