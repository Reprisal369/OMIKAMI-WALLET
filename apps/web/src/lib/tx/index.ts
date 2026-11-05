/**
 * OMIKAMI WALLET — Phase 2 write-surface boundary (DESIGN SCAFFOLDING ONLY).
 *
 * See docs/design/PHASE_2_TRANSACTIONS.md (§4.7, §5, §9, §10).
 *
 * This directory is the ONLY place in the codebase where wallet write/sign
 * APIs may ever live. That boundary is enforced by
 * `scripts/check-forbidden-terms.mjs`, which exempts the read-only "M1" rule
 * here — and nowhere else. Every other rule (key material, browser storage,
 * dynamic code execution, …) still applies in this module too.
 *
 * It currently holds NO write code and nothing is wired into the app:
 * transactions remain disabled (`transactionsEnabled` is false for every chain)
 * and activation is gated on the Phase 2 preconditions in the design doc §2.
 *
 * The transaction vocabulary lives in `@omikami/types` so that the pure
 * construction/decoding logic (`@omikami/security` `tx-build`) and this
 * write-surface module share ONE definition (design §4.7). Re-exported here for
 * convenience; importing a type cannot sign, send, or move anything.
 */
export type { TxRequest, TxState, TxErrorKind } from '@omikami/types';
