/**
 * OMIKAMI WALLET — the single wallet-write entry point (Phase 2, GATED OFF).
 *
 * This is the ONLY file in the codebase permitted to call a wallet write API.
 * `scripts/check-forbidden-terms.mjs` exempts the read-only "M1" rule under
 * `apps/web/src/lib/tx/` and nowhere else, so a `sendTransaction` call anywhere
 * outside this directory still fails the build.
 *
 * It is wired to HARD-REFUSE unless transactions are explicitly enabled for the
 * target chain — and they are not: `transactionsEnabled` is false everywhere in
 * this build, so `assertTransactionsEnabled` throws before the wallet is ever
 * touched and the line below is unreachable. The point is to give the eventual
 * send flow a single, reviewed, auditable choke point rather than scattering
 * write calls across the UI. Nothing here is wired into a component yet.
 */
import { assertTransactionsEnabled } from '@omikami/security';
import type { TxRequest } from '@omikami/types';

/**
 * The minimal wallet capability a send needs, injected by the caller (a viem
 * WalletClient or wagmi action). Kept to exactly one method so the write surface
 * is a single call.
 */
export interface WalletSend {
  sendTransaction(args: {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
    chainId: number;
  }): Promise<`0x${string}`>;
}

export interface GatedSendParams {
  wallet: WalletSend;
  /** The exact, immutable request to hand over — built and verified elsewhere. */
  request: TxRequest;
  /** Master switch from chain-config. False everywhere in this build. */
  transactionsEnabled: boolean;
}

/**
 * Hands the EXACT request to the wallet to sign and broadcast — but only when
 * transactions are enabled. With the gate off (always, in this build) it throws
 * (`TransactionsDisabledError`) before contacting the wallet, so no signature is
 * ever requested. Returns the broadcast transaction hash when, and only when,
 * transactions are enabled.
 */
export async function sendGatedTransaction(params: GatedSendParams): Promise<`0x${string}`> {
  // Master gate first — unreachable wallet path below until this is lifted.
  assertTransactionsEnabled(params.transactionsEnabled);

  const { to, value, data, chainId } = params.request;
  return params.wallet.sendTransaction({ to, value, data, chainId });
}
