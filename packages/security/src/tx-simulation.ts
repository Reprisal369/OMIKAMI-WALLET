/**
 * OMIKAMI SHIELD — read-only transaction SIMULATION (Phase 2).
 *
 * STATUS: REVIEW. Pure and side-effect free except through an INJECTED,
 * read-only client. It performs a best-effort pre-flight of a transaction
 * (gas estimation / `eth_call`-style execution) to detect whether it WOULD
 * revert — it never signs, never broadcasts, never mutates chain state, and
 * holds no keys. The injected client exposes a single read method
 * (`estimateGas`); there is no write/sign capability in its type.
 *
 * Honest-by-design rules (do not relax without review):
 *  - A successful pre-flight is NEVER reported as "safe". It only means the
 *    transaction would not revert under current chain state; it is advisory and
 *    the user's wallet is always the final authority.
 *  - Balance changes, token transfers and fees are NOT fabricated. This build
 *    does not compute balance deltas (that needs tracing infrastructure we
 *    deliberately do not add — see the known-limitation note in THREAT_MODEL).
 *    Simulation here answers "would it execute?" and gives an advisory gas
 *    estimate, nothing more.
 *  - Any uncertainty (wrong/unknown network, no account, timeout, malformed or
 *    unexpected response) FAILS CLOSED to `unavailable`; no RPC call is made
 *    when a precondition already fails.
 *
 * Transactions remain disabled in this build; nothing here can enable them.
 */
import type { TxRequest } from '@omikami/types';

/** SHIELD simulation verdicts. */
export type SimulationStatus = 'passed' | 'warning' | 'revert' | 'unverified' | 'unavailable';

export const SIMULATION_STATUS_LABEL: Record<SimulationStatus, string> = {
  passed: 'Simulation passed',
  warning: 'Warning',
  revert: 'Revert detected',
  unverified: 'Unverified',
  unavailable: 'Simulation unavailable',
};

export interface SimulationSummary {
  status: SimulationStatus;
  label: string;
  detail: string;
  /** True only when the pre-flight showed the transaction would revert. */
  wouldRevert: boolean;
  /** Advisory gas estimate in units, present only on a successful pre-flight. */
  gasEstimate?: bigint;
}

/** The discriminated result of an attempted read-only pre-flight. */
export type SimulationOutcome =
  | { kind: 'gas'; gas: bigint }
  | { kind: 'revert'; reason?: string }
  | { kind: 'insufficient-funds' }
  | { kind: 'timeout' }
  | { kind: 'malformed' }
  | { kind: 'unavailable' };

export interface SimulationContext {
  kind: 'native' | 'erc20';
  /** Whether an ERC-20 asset is in the reviewed registry. Ignored for native. */
  assetVerified: boolean;
}

const ADVISORY =
  'This is an advisory pre-flight, not a guarantee of the outcome, and it does not compute balance changes. Your wallet is always the final authority; nothing here is signed or sent.';

/** Pure: maps a provider/RPC error to a safe {@link SimulationOutcome}. */
export function classifyRpcError(e: unknown): SimulationOutcome {
  const err = typeof e === 'object' && e !== null ? (e as { name?: string; message?: string }) : {};
  const message = (err.message ?? '').toLowerCase();
  const name = (err.name ?? '').toLowerCase();

  if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
    return { kind: 'insufficient-funds' };
  }
  if (
    message.includes('execution reverted') ||
    message.includes('revert') ||
    message.includes('gas required exceeds') ||
    message.includes('cannot estimate gas') ||
    name.includes('estimategaserror') ||
    name.includes('contractfunctionrevert')
  ) {
    return { kind: 'revert' };
  }
  if (message.includes('timed out') || message.includes('timeout') || name.includes('timeout')) {
    return { kind: 'timeout' };
  }
  if (
    message.includes('malformed') ||
    message.includes('invalid json') ||
    message.includes('unexpected token') ||
    name.includes('syntaxerror')
  ) {
    return { kind: 'malformed' };
  }
  return { kind: 'unavailable' };
}

/** Pure: turns an outcome into a SHIELD summary. Never reports "safe". */
export function classifySimulationOutcome(
  outcome: SimulationOutcome,
  context: SimulationContext,
): SimulationSummary {
  switch (outcome.kind) {
    case 'gas': {
      // A clean pre-flight. For an UNVERIFIED token we cannot vouch for the
      // contract's real behaviour (fee-on-transfer, rebasing, malicious), so it
      // is UNVERIFIED, never "passed".
      if (context.kind === 'erc20' && !context.assetVerified) {
        return {
          status: 'unverified',
          label: SIMULATION_STATUS_LABEL.unverified,
          detail: `The transaction would execute, but this token is not in the reviewed registry, so its real effect cannot be verified here. ${ADVISORY}`,
          wouldRevert: false,
          gasEstimate: outcome.gas,
        };
      }
      return {
        status: 'passed',
        label: SIMULATION_STATUS_LABEL.passed,
        detail: `The transaction would execute without reverting under current chain state. This is not a safety verdict. ${ADVISORY}`,
        wouldRevert: false,
        gasEstimate: outcome.gas,
      };
    }
    case 'revert':
      return {
        status: 'revert',
        label: SIMULATION_STATUS_LABEL.revert,
        detail: `The pre-flight shows this transaction would revert on-chain, so it would fail${
          outcome.reason ? ` (${outcome.reason})` : ''
        }. It was only simulated — nothing was sent.`,
        wouldRevert: true,
      };
    case 'insufficient-funds':
      return {
        status: 'warning',
        label: SIMULATION_STATUS_LABEL.warning,
        detail: `The pre-flight suggests there is not enough balance to cover the amount plus the network fee. ${ADVISORY}`,
        wouldRevert: false,
      };
    case 'timeout':
    case 'malformed':
    case 'unavailable':
      return {
        status: 'unavailable',
        label: SIMULATION_STATUS_LABEL.unavailable,
        detail: `This transaction could not be simulated right now. No conclusion is drawn either way. ${ADVISORY}`,
        wouldRevert: false,
      };
  }
}

/**
 * The minimal, READ-ONLY client a simulation needs. It exposes exactly one
 * method — a gas estimate / execution pre-flight — and NO write or signing
 * capability by construction. Injected so tests use a mock and the real UI
 * supplies a viem public client (read transport over the approved RPC).
 */
export interface SimulationClient {
  readonly chainId: number;
  estimateGas(args: {
    account: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  }): Promise<bigint>;
}

export interface SimulateSendParams {
  request: TxRequest;
  /** Connected sender; simulation is from this address. */
  from: `0x${string}` | undefined;
  /** The wallet's current chain id. */
  walletChainId: number | undefined;
  context: SimulationContext;
  client: SimulationClient;
}

function unavailable(reasonDetail: string): SimulationSummary {
  return {
    status: 'unavailable',
    label: SIMULATION_STATUS_LABEL.unavailable,
    detail: `${reasonDetail} ${ADVISORY}`,
    wouldRevert: false,
  };
}

/**
 * Runs the read-only pre-flight. Fails closed BEFORE any RPC call when a
 * precondition is unmet (no account, wrong/unknown network, or a client reading
 * a different chain than the request targets — a conflicting source). Only then
 * does it call the injected read client, mapping any error to a safe outcome.
 */
export async function simulateSend(params: SimulateSendParams): Promise<SimulationSummary> {
  if (!params.from) {
    return unavailable('Connect a wallet to simulate from your address.');
  }
  if (params.walletChainId === undefined || params.walletChainId !== params.request.chainId) {
    // Unsupported / wrong network — never simulate against the wrong chain.
    return unavailable('Your wallet is on a different network than this transaction targets.');
  }
  if (params.client.chainId !== params.request.chainId) {
    // The read source disagrees with the target chain — treat as conflicting.
    return unavailable('The simulation data source does not match the target network.');
  }

  let outcome: SimulationOutcome;
  try {
    const gas = await params.client.estimateGas({
      account: params.from,
      to: params.request.to,
      value: params.request.value,
      data: params.request.data,
    });
    outcome = { kind: 'gas', gas };
  } catch (e) {
    outcome = classifyRpcError(e);
  }
  return classifySimulationOutcome(outcome, params.context);
}

/** A stable identity for a simulation: who, which chain, exact request bytes. */
export interface SimulationKey {
  account: string;
  chainId: number;
  to: string;
  value: bigint;
  data: string;
}

export function simulationKey(from: string, request: TxRequest): SimulationKey {
  return {
    account: from.toLowerCase(),
    chainId: request.chainId,
    to: request.to.toLowerCase(),
    value: request.value,
    data: request.data,
  };
}

/**
 * Stale / invalidated detection: a simulation computed for one account, network
 * or exact request must be discarded if any of them changed (account switch,
 * network switch, edited amount/recipient). Callers re-simulate on a mismatch
 * rather than showing an outdated verdict.
 */
export function isSimulationStale(builtFor: SimulationKey, current: SimulationKey): boolean {
  return (
    builtFor.account !== current.account ||
    builtFor.chainId !== current.chainId ||
    builtFor.to !== current.to ||
    builtFor.value !== current.value ||
    builtFor.data !== current.data
  );
}
