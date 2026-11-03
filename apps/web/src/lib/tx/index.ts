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
 * The exports below are PURE TYPES — the shared vocabulary that later stages
 * build on. Importing a type from here cannot sign, send, or move anything.
 */

/**
 * The single, immutable transaction intent (design §4.7). It is built once and
 * used as the sole input to BOTH the human-readable preview and the eventual
 * wallet request, so that "what the user sees" and "what the wallet signs" can
 * never diverge (threat P3). It is never mutated after it is built; an "edit"
 * means constructing a new object and previewing again from scratch.
 */
export interface TxRequest {
  readonly to: `0x${string}`;
  readonly value: bigint;
  readonly data: `0x${string}`;
  readonly chainId: number;
}

/**
 * Explicit transaction lifecycle (design §9). Every failure transition is
 * safe — a block or a loud warning, never a silent proceed. `awaiting-signature`
 * is the only state that will ever touch a wallet write API, and only from
 * within this module.
 */
export type TxState =
  | 'idle'
  | 'building'
  | 'previewing'
  | 'simulating'
  | 'awaiting-signature'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'replaced'
  | 'dropped';

/**
 * Safe, non-leaking failure categories (design §10). Raw provider payloads are
 * never surfaced; each kind maps to a fixed, user-facing message at the UI
 * layer, mirroring the read-only `classifyConnectError` hygiene.
 */
export type TxErrorKind =
  | 'user-rejected'
  | 'insufficient-funds'
  | 'gas-estimation-failed'
  | 'wrong-network'
  | 'nonce-replacement'
  | 'decode-failed'
  | 'broadcast-failed'
  | 'unknown';
