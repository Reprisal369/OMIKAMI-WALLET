/**
 * OMIKAMI SHIELD — pure transaction-flow building blocks (Phase 2).
 *
 * Pure and side-effect free: no wallet APIs, no signing, no broadcasting. These
 * are the fail-safe helpers a later, feature-flagged send flow will compose —
 * the safe error taxonomy (design §10), the wrong-network gate (threat P5), and
 * a build step that produces a request together with the verified preview it
 * decodes to (design §4.7). The actual broadcast is injected at the app
 * boundary (`apps/web/src/lib/tx/`) later; nothing here can move funds.
 *
 * Transactions remain disabled in this build.
 */
import type { TxErrorKind, TxRequest } from '@omikami/types';
import {
  assertShownEqualsSigned,
  buildSendTx,
  decodeSendTx,
  type BuildSendParams,
  type DecodedSend,
} from './tx-build';

interface ProviderErrorLike {
  code?: number;
  name?: string;
  message?: string;
}

function asProviderError(e: unknown): ProviderErrorLike {
  if (typeof e === 'object' && e !== null) return e as ProviderErrorLike;
  return {};
}

/**
 * Classifies a transaction failure into a safe category WITHOUT exposing the
 * raw provider payload (mirrors `classifyConnectError`). The caller turns the
 * category into a fixed message via {@link txErrorMessage}; raw error text is
 * never shown to the user.
 */
export function classifyTxError(e: unknown): TxErrorKind {
  const err = asProviderError(e);
  const message = (err.message ?? '').toLowerCase();
  const name = (err.name ?? '').toLowerCase();

  // EIP-1193: 4001 = user rejected the request in their wallet.
  if (err.code === 4001 || name.includes('userrejected') || message.includes('rejected')) {
    return 'user-rejected';
  }
  if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
    return 'insufficient-funds';
  }
  if (
    message.includes('gas required exceeds') ||
    message.includes('cannot estimate gas') ||
    message.includes('execution reverted') ||
    name.includes('estimategas')
  ) {
    return 'gas-estimation-failed';
  }
  if (
    message.includes('wrong network') ||
    message.includes('chain mismatch') ||
    message.includes('chain id') ||
    name.includes('chainmismatch')
  ) {
    return 'wrong-network';
  }
  if (
    message.includes('nonce too low') ||
    message.includes('already known') ||
    message.includes('replacement transaction underpriced')
  ) {
    return 'nonce-replacement';
  }
  if (message.includes('could not decode') || message.includes('decode') || name.includes('decode')) {
    return 'decode-failed';
  }
  if (
    message.includes('failed to send') ||
    message.includes('broadcast') ||
    message.includes('transaction underpriced') ||
    name.includes('transactionrejected')
  ) {
    return 'broadcast-failed';
  }
  return 'unknown';
}

/** Fixed, non-leaking user-facing message for a transaction failure (design §10). */
export function txErrorMessage(kind: TxErrorKind): string {
  switch (kind) {
    case 'user-rejected':
      return 'You rejected it in your wallet. Nothing was signed or sent.';
    case 'insufficient-funds':
      return 'Not enough funds to cover the amount plus the network fee.';
    case 'gas-estimation-failed':
      return 'This transaction would fail on-chain, so it was not sent. Check the recipient and contract.';
    case 'wrong-network':
      return 'Your wallet is on the wrong network. Switch it yourself — this app never switches networks for you.';
    case 'nonce-replacement':
      return 'This looks like a duplicate or replacement. Check your wallet’s activity before retrying.';
    case 'decode-failed':
      return 'This transaction could not be read safely, so it was blocked. Nothing was signed.';
    case 'broadcast-failed':
      return 'The network did not accept the transaction. Nothing was charged. Try again.';
    case 'unknown':
      return 'The transaction failed. No funds move from a failed transaction. Try again, or check your wallet.';
  }
}

export interface NetworkCheck {
  ok: boolean;
  /** Present only when the check fails. */
  kind?: 'wrong-network';
}

/**
 * Wrong-network gate (threat P5, design §9). A transaction may only proceed when
 * the wallet is already on the exact chain the request targets. A different
 * chain — or a wallet whose chain is unknown — blocks (fail safe). This app
 * never switches networks for the user, so this only ever reports; it never
 * acts.
 */
export function checkTransactionNetwork(
  intendedChainId: number,
  walletChainId: number | undefined,
): NetworkCheck {
  if (walletChainId !== undefined && walletChainId === intendedChainId) {
    return { ok: true };
  }
  return { ok: false, kind: 'wrong-network' };
}

export interface VerifiedSend {
  /** The immutable request a wallet would later be handed. */
  request: TxRequest;
  /** The decoded preview — produced from the request's own bytes (P3). */
  shown: DecodedSend;
}

/**
 * Builds the send request AND the preview it decodes to, asserting they match
 * (design §4.7). By construction they cannot diverge; the assertion is a
 * fail-safe tripwire. Invalid input throws (`TxDecodeError`) rather than
 * returning an untrustworthy request.
 */
export function buildVerifiedSend(params: BuildSendParams): VerifiedSend {
  const request = buildSendTx(params);
  const shown = decodeSendTx(request);
  assertShownEqualsSigned(request, shown);
  return { request, shown };
}
