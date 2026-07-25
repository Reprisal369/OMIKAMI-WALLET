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
