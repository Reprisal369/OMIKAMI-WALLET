/**
 * OMIKAMI WALLET shared strict types.
 * Security invariant: no type in this package may ever model seed phrases,
 * private keys, or raw signing material.
 */

/** SHIELD verdict labels. A heuristic is never presented as a confirmed scam verdict. */
export type RiskVerdict = 'verified' | 'known' | 'unknown' | 'suspicious' | 'blocked';

export type SecurityCheckStatus = 'ok' | 'info' | 'warning' | 'blocked';

export interface SecurityCheck {
  id: string;
  label: string;
  status: SecurityCheckStatus;
  detail: string;
}

export interface ChainMeta {
  chainId: number;
  name: string;
  testnet: boolean;
  /** Chain is available for read operations. */
  enabled: boolean;
  /**
   * Hard gate. Stays false on every chain until the relevant
   * MAINNET_CHECKLIST.md gates pass. Phase one is read-only.
   */
  transactionsEnabled: boolean;
}

export type RpcStatus = 'checking' | 'connected' | 'error';

export type ConnectFailureKind = 'rejected' | 'timeout' | 'no-wallet' | 'unknown';

// ---------------------------------------------------------------------------
// Phase 2 transaction vocabulary (see docs/design/PHASE_2_TRANSACTIONS.md).
// Types only — these model NO signing material and expose NO wallet APIs.
// Transactions remain disabled (ChainMeta.transactionsEnabled is false); these
// exist so the preview and the eventual wallet request share one definition.
// ---------------------------------------------------------------------------

/**
 * The single, immutable transaction intent (design §4.7). It is built once and
 * used as the sole input to BOTH the human-readable preview and the eventual
 * wallet request, so that "what the user sees" and "what the wallet signs" can
 * never diverge (threat P3). It is never mutated after construction; an "edit"
 * means building a new object and previewing again from scratch.
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
 * is the only state that will ever touch a wallet write API, and only from the
 * reviewed write-surface module (`apps/web/src/lib/tx/`).
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
