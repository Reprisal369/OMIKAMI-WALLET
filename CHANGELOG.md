# Changelog

All notable changes to OMIKAMI WALLET are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Status: every version below is **read-only** and **testnet-only (Ethereum
> Sepolia)**. Nothing has been published or deployed. The wallet holds no keys,
> signs nothing, and takes no custody. Version tags mark stable local
> checkpoints so a future change that breaks something can be rolled back to a
> known-good state. The first PUBLIC release is gated on: GitHub CI active,
> Actions pinned to commit SHAs, CSP enforced at hosting, and an independent
> external review (see `MAINNET_CHECKLIST.md` and `docs/reviews/`).

## [Unreleased]

- Awaiting external security review. No new wallet features until then.

## [0.5.2] — 2026-07-26 — Pin RPC transports (supply-chain hardening)

Dependabot triage follow-up. No new features; still strictly read-only.

### Security
- **Explicitly pin the app's RPC transports** in `wagmi.ts` (Sepolia default →
  `11155111.rpc.thirdweb.com`, mainnet/ENS → `eth.merkle.io`) instead of relying
  on viem's built-in chain defaults. viem 2.55.10 changed the mainnet default RPC
  to `ethereum.reth.rs`; pinning keeps the app's outbound host under our control
  and aligned with the CSP `connect-src`, the bundle allowlist, and PRIVACY.md,
  so a future dependency bump can no longer silently move our egress.
- Bundle allowlist: `reth.rs` added as a **bundled-but-never-contacted** viem
  chain constant (documented), since our transport is pinned.

### Notes
- This unblocks the pending Dependabot patch update (viem 2.55.10 / wagmi 3.7.4 /
  react 19.2.8 / next 16.2.12, …): with the transport pinned and the constant
  allowlisted, the bundle gate passes and runtime egress is unchanged.

## [0.5.1] — 2026-07-26 — Internal pre-audit hardening

Hardening applied after the internal pre-audit (`docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md`).
No new features, no architectural changes; the wallet remains strictly read-only.

### Security
- **Read-only invariant is now an enforced build gate (M1).** The forbidden-pattern
  gate fails on any wallet write/sign/switch API in source
  (`useSendTransaction`, `useWriteContract`, `useSignMessage`, `writeContract`,
  `sendTransaction`, `switchChain`, …). The read-only promise is no longer only a
  convention.
- **Token-name spoofing defense (L4).** `sanitizeTokenText` now strips Unicode
  bidirectional/format and zero-width control characters (new unit test).

### Changed
- **Balance reads gated to supported chains (L1).** On an unsupported network the
  app defers to the wrong-network warning instead of attempting a read that errors.

### Docs
- Documented the RPC-URL DNS-rebinding limitation (L3), the custom-RPC/CSP UX
  trade-off (L5), and corrected a stale note about balance transports (I3).

### Verified
- lint · typecheck (all + e2e) · unit 86 · forbidden-pattern (with M1) · secrets ·
  build · bundle 37/0/0 · audit 0 — all green.

## [0.5.0] — 2026-07-25 — Read-only allowance dashboard

### Added
- **Allowance dashboard (read-only).** Discovers ERC-20 approvals from
  `Approval` event logs (via `eth_getLogs`, never a contract call) and shows,
  per active allowance: token name, symbol, spender (with copy + explorer),
  current allowance, an unlimited-allowance warning, a risk badge, and the
  verification source. Live allowance values are read **only** for reviewed
  registry tokens; unknown token contracts are quarantined and never called
  (THREAT_MODEL D3).
- Pure, unit-tested logic in `@omikami/security`: `summarizeApprovals`,
  `classifyAllowanceRisk`, `isUnlimitedAllowance` (11 tests).
- e2e test 21: dashboard is read-only, empty state on clean history, no
  approve/revoke/sign controls.

### Security
- No approve, revoke, permit, sign, send, swap, bridge, staking, or deployment
  path exists. Display only.

### Verified
- Local gates green: lint, typecheck (all + e2e), unit 85/85, forbidden-pattern,
  secrets, build, bundle (34 files / 0 unknown hosts), audit 0. Playwright 38/38
  (desktop + mobile).

## [0.4.0] — 2026-07-25 — Read-only transfer preview

### Added
- **Transfer preview (read-only).** Simulates a hypothetical transfer and runs
  OMIKAMI SHIELD checks before anything could ever be signed: invalid/non-EIP-55
  address, zero-address burn, sending to a token's own contract, self-send,
  address-poisoning lookalike, over-balance, too many decimals, unverified
  token. `signingAvailable` is a literal `false`; no submit/send/sign control
  exists.
- Pure, unit-tested logic: `buildSendPreview`, `parseAmountInput` (integer-only
  amount parsing, no floating point) — 20 tests.
- e2e tests 19–20.

### Fixed
- Dependency audit: patched a dev-only advisory (brace-expansion via
  eslint→minimatch, not shipped) with a pnpm override.

## [0.3.1] — 2026-07-13 — Security & build foundation (tooling)

### Added
- Verification gates as code: forbidden-pattern gate (key material, browser
  storage, HTML injection, credential inputs, keystore, eval), secret gate,
  bundle-allowlist gate; hardened ESLint bans; root `pnpm verify`.
- Reproducible-build manifest (`release-hash`) and SBOM generation.
- CI workflow definition (prepared, not yet active; actions must be pinned to
  commit SHAs before first run).
- Documents: DEPENDENCY_POLICY, PRIVACY, INCIDENT_RESPONSE, RELEASE_CHECKLIST,
  CONTRIBUTING, LICENSE (MIT).

### Known limitations
- Next 16 Turbopack export is not yet byte-reproducible (Gate 8, pre-mainnet).
- CSP must be enforced at the hosting layer (Gate 7).

## [0.3.0] — 2026-07-13 — Activity feed + quarantine

### Added
- Read-only recent ERC-20 activity from `eth_getLogs` (no indexer), with
  direction, amount, counterparty, block, and explorer links.
- Unknown-token **quarantine**: unsolicited/unknown token contracts are listed
  by address and never called by the app.
- User-configurable Sepolia RPC endpoint with strict validation (https-only;
  rejects credentials, localhost, private/loopback/link-local/CGNAT ranges,
  IPv6 literals, bare dotless hosts) — the app's only opt-in browser storage.

## [0.2.0] — 2026-07-13 — Portfolio

### Added
- Read-only ERC-20 balances for a reviewed token registry (Sepolia USDC,
  double-sourced: Circle docs + Etherscan). Token identity is always
  chainId + EIP-55 address; names/symbols are untrusted display strings,
  sanitized before rendering.

## [0.1.0] — 2026-07-13 — Read-only shell

### Added
- Injected-wallet connect/disconnect (EIP-1193 / EIP-6963), checksummed address
  display with poisoning-aware emphasis, native balance, network + wrong-network
  warning (no auto-switching), RPC status probe, and the OMIKAMI SHIELD status
  panel.
- Non-custodial by construction: no seed phrase, private key, or keystore import
  exists anywhere; `transactionsEnabled` is false everywhere (enforced by test).
- Playwright e2e harness with a mocked EIP-1193 provider and intercepted RPC.

[Unreleased]: https://example.com/omikami-wallet/compare/v0.5.0...HEAD
[0.5.0]: https://example.com/omikami-wallet/releases/v0.5.0
[0.4.0]: https://example.com/omikami-wallet/releases/v0.4.0
[0.3.1]: https://example.com/omikami-wallet/releases/v0.3.1
[0.3.0]: https://example.com/omikami-wallet/releases/v0.3.0
[0.2.0]: https://example.com/omikami-wallet/releases/v0.2.0
[0.1.0]: https://example.com/omikami-wallet/releases/v0.1.0
