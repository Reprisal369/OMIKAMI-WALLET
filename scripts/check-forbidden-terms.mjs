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
  //
  // This BROAD rule is NEVER exempted — not even under the tx/ write-surface.
  // Hooks (useSendTransaction/…), writeContract, message/typed-data signing and
  // chain switching are not needed by the current write surface, so they stay
  // forbidden everywhere. (Widen deliberately, with review, when approve/permit
  // actually require writeContract/signTypedData.)
  [/\b(useSendTransaction|useWriteContract|useContractWrite|useSignMessage|useSignTypedData|useSwitchChain|writeContract|signMessage|signTypedData|switchChain|prepareTransactionRequest)\b/, 'wallet write/sign/switch API forbidden — read-only invariant (M1)'],
  // The ONE write primitive the tx/ write-surface is allowed to use today, and
  // only there. Narrowed from the full set above so the exception is as small as
  // the current code requires: exactly `sendTransaction`, exactly under tx/.
  [/\bsendTransaction\b/, 'sendTransaction forbidden outside the tx/ write-surface (M1-send)'],
];

// The ONE reviewed exception permitted to use browser storage (THREAT_MODEL C1c).
const STORAGE_EXCEPTION = 'apps/web/src/lib/rpc-storage.ts';

// Phase 2 write-surface boundary (PHASE_2_TRANSACTIONS.md §5): the single
// reviewed directory where the tx write primitive may live. ONLY the narrowed
// `sendTransaction` rule (M1-send) is exempted here, and nowhere else; the broad
// M1 write/sign/switch rule and every other rule (key material, storage, raw
// HTML, eval, …) still apply in this module too. Narrowest exception the current
// code requires — transactions remain disabled and the module is unreachable.
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
        // Exempt ONLY the single sendTransaction primitive, and ONLY under tx/.
        // The broad M1 write/sign/switch rule above is never exempted.
        if (isWriteSurface && msg.includes('(M1-send)')) continue;
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
