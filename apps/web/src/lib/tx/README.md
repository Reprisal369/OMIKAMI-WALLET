# `tx/` — the Phase 2 write-surface boundary

This directory is the **single, reviewed location** where wallet write/sign
APIs may ever live (see `docs/design/PHASE_2_TRANSACTIONS.md` §5).

## The rule

- Wallet write/sign/switch APIs (`useSendTransaction`, `writeContract`,
  `signTypedData`, `switchChain`, …) are forbidden **everywhere** in the
  codebase by `scripts/check-forbidden-terms.mjs` (the "M1" read-only gate).
- That one rule is **exempted only under this directory**, and nowhere else.
  Every other forbidden-pattern rule (key material, browser storage, raw HTML,
  dynamic code execution) still applies here too.
- The point is to keep the eventual write surface **tiny, centralized, and
  auditable**, and to keep a failing build gate against write code leaking into
  the UI or the read-only packages.

## Current state: nothing is enabled

- This module contains **pure types only** (`index.ts`): `TxRequest`,
  `TxState`, `TxErrorKind`. No write code exists.
- `transactionsEnabled` is **false** for every chain. Importing a type from here
  cannot sign, send, or move anything.
- Enabling transactions on **testnet** requires design §2 preconditions 1–3 and
  5. **Mainnet** additionally requires the external security review, a contract
  audit where applicable, and the `MAINNET_CHECKLIST.md` gates.

Until then, OMIKAMI WALLET holds no keys, signs nothing, and remains read-only.
