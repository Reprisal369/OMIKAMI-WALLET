import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { readCustomRpcUrl } from './rpc-storage';

/**
 * Wallet connection configuration — phase one.
 *
 * - EIP-1193 injected wallets ONLY (MetaMask, Rabby, Coinbase Wallet
 *   extension, and compatible). WalletConnect is intentionally absent; the
 *   `connectors` array below is the single extension point where its
 *   connector will be added later (with a user-supplied public project ID).
 * - `storage: null`: nothing about the connection persists after the tab
 *   closes. Local persistence is a future explicit opt-in (PRIVACY posture).
 * - Transports use viem's built-in default RPC endpoints for each chain —
 *   no RPC URL is invented in this repository. Mainnet transport exists only
 *   so the app can read chain metadata if the user's wallet is on mainnet;
 *   app features are Sepolia-only in phase one (see @omikami/chain-config).
 * - There is NO wallet-client write usage anywhere in this app: no send,
 *   no approvals, no swaps, no message signing.
 */
/**
 * Builds the wagmi config. If the user has stored a VALIDATED custom Sepolia
 * RPC endpoint (Settings), it is used for the Sepolia transport; otherwise
 * viem's built-in default. Mainnet always uses the default (ENS only).
 * Rebuilt on demand so a Settings change takes effect after a reload.
 */
/**
 * Explicitly PINNED default RPC endpoints (internal pre-audit follow-up /
 * supply-chain hardening). We do NOT rely on viem's built-in chain defaults for
 * our transports: viem periodically changes them (e.g. viem 2.55.10 switched the
 * mainnet default from eth.merkle.io to ethereum.reth.rs), which would silently
 * move our outbound host and break the CSP `connect-src` allowlist. Pinning here
 * keeps the app's egress hosts under our control, matching PRIVACY.md, the bundle
 * allowlist, and the CSP. A user-supplied custom Sepolia endpoint still overrides
 * the Sepolia default.
 */
const SEPOLIA_DEFAULT_RPC = 'https://11155111.rpc.thirdweb.com';
const MAINNET_RPC = 'https://eth.merkle.io'; // ENS name resolution only

export function buildWagmiConfig() {
  const custom = readCustomRpcUrl();
  return createConfig({
    chains: [sepolia, mainnet],
    connectors: [injected()],
    storage: null,
    transports: {
      [sepolia.id]: http(custom ?? SEPOLIA_DEFAULT_RPC),
      [mainnet.id]: http(MAINNET_RPC),
    },
  });
}

export const wagmiConfig = buildWagmiConfig();
