/**
 * OMIKAMI SHIELD — pure transaction lifecycle state machine (Phase 2, design §9).
 *
 * Pure and side-effect free: these transitions decide the SAFE next state; they
 * never sign, broadcast, poll, or touch a wallet. The side effects (requesting
 * a signature, broadcasting, polling the receipt) happen outside, at the
 * write-surface boundary (`apps/web/src/lib/tx/`), and their results are fed
 * back in as the arguments below.
 *
 *   idle → building/previewing → awaiting-signature → pending
 *        → confirmed | failed | replaced | dropped
 *
 * Two safety rules are structural here:
 *   1. Every FAILURE transition lands on `failed` (or a terminal receipt state)
 *      with a safe error kind — never a silent proceed.
 *   2. Every transition only fires from its expected source state; called from
 *      any other state it is a NO-OP that returns the flow unchanged, so a
 *      mis-ordered call can never skip a guard (e.g. jump straight to
 *      `pending`). Advancing is always explicit.
 *
 * Transactions remain disabled in this build; nothing here is wired into the UI.
 */
import type { TxErrorKind, TxRequest, TxState } from '@omikami/types';
import type { BuildSendParams, DecodedSend } from './tx-build';
import { buildVerifiedSend, checkTransactionNetwork, classifyTxError } from './tx-flow';

export interface TxFlow {
  readonly status: TxState;
  /** The immutable request, once built. */
  readonly request?: TxRequest;
  /** The decoded preview the request produces (P3, design §4.7). */
  readonly shown?: DecodedSend;
  /** Present only in the `failed` state. */
  readonly error?: TxErrorKind;
  /** The broadcast transaction hash, once the wallet returns one. */
  readonly hash?: `0x${string}`;
}

export const initialTxFlow: TxFlow = { status: 'idle' };

/** Return to a clean `idle` — e.g. after a terminal state or an explicit cancel. */
export function resetTxFlow(): TxFlow {
  return initialTxFlow;
}

/**
 * Build the request and its verified preview. From `idle` or a terminal state.
 * Invalid input does not throw out of the machine — it lands on `failed` with
 * `decode-failed`, so the caller always has a safe state to render.
 */
export function buildTxFlow(params: BuildSendParams): TxFlow {
  try {
    const { request, shown } = buildVerifiedSend(params);
    return { status: 'previewing', request, shown };
  } catch {
    return { status: 'failed', error: 'decode-failed' };
  }
}

/**
 * `previewing` → `awaiting-signature`, but ONLY when the wallet is on the exact
 * chain the request targets (wrong-network gate, threat P5). A different or
 * unknown chain lands on `failed` with `wrong-network`; the app never switches
 * the network itself. Entering `awaiting-signature` is the signal the boundary
 * layer may now ask the wallet to sign.
 */
export function requestSignature(flow: TxFlow, walletChainId: number | undefined): TxFlow {
  if (flow.status !== 'previewing' || !flow.request) return flow;
  const net = checkTransactionNetwork(flow.request.chainId, walletChainId);
  if (!net.ok) return { ...flow, status: 'failed', error: 'wrong-network' };
  return { ...flow, status: 'awaiting-signature' };
}

/** `awaiting-signature` → `pending` once the wallet returns a broadcast hash. */
export function onSigned(flow: TxFlow, hash: `0x${string}`): TxFlow {
  if (flow.status !== 'awaiting-signature') return flow;
  return { ...flow, status: 'pending', hash };
}

/**
 * `awaiting-signature` or `pending` → `failed`, mapping the raw provider error
 * to a safe, non-leaking kind ({@link classifyTxError}). From any other state
 * it is a no-op.
 */
export function onTxError(flow: TxFlow, error: unknown): TxFlow {
  if (flow.status !== 'awaiting-signature' && flow.status !== 'pending') return flow;
  return { ...flow, status: 'failed', error: classifyTxError(error) };
}

/** `pending` → a terminal receipt state read from the wallet/RPC. */
export function onReceipt(
  flow: TxFlow,
  outcome: 'confirmed' | 'failed' | 'replaced' | 'dropped',
): TxFlow {
  if (flow.status !== 'pending') return flow;
  return { ...flow, status: outcome };
}

/** The terminal states a flow can end in. */
export function isTerminalTxFlow(flow: TxFlow): boolean {
  return (
    flow.status === 'confirmed' ||
    flow.status === 'failed' ||
    flow.status === 'replaced' ||
    flow.status === 'dropped'
  );
}
