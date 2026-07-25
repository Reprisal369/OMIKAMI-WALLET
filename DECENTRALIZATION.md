# OMIKAMI WALLET — DECENTRALIZATION.md

Status: DRAFT — awaiting human review
Date: 2026-07-13

## Goal

The core wallet dashboard must keep functioning without any proprietary backend. This document states what is decentralized, what is not, and where residual centralization honestly remains.

## Design commitments

- Static frontend export (Next.js `output: 'export'`), deployable to IPFS or any static host.
- Direct blockchain reads via RPC wherever reasonable; no mandatory indexer.
- Optional services (indexers, price feeds, simulators) live behind adapter interfaces with a degraded-but-functional fallback when absent.
- Multiple default RPC endpoints with timeout and fallback; user-configurable RPC endpoints in Settings.
- No mandatory proprietary authentication. No central user database. No custody.
- Open-source repository, reproducible builds, published release hashes and IPFS CIDs.
- Contract addresses verified against multiple independent trusted sources before entering the registry.

## Honest dependency inventory

| Dependency | Role | Failure mode | Mitigation | Residual centralization |
|---|---|---|---|---|
| Domain registrar / DNS | Primary web access | Hijack or seizure serves hostile or no content | DNSSEC where available, registrar 2FA, published IPFS CID as alternative access, monitoring | Real. DNS is centralized; IPFS CID is the escape hatch, but most users arrive via DNS. |
| Hosting provider | Serves the primary deployment | Outage, tampering, account compromise | Static export portable to any host; reproducible-build hash comparison; IPFS mirror | Real but replaceable in hours. |
| RPC providers | All chain reads; tx broadcast | Outage, censorship, false data, privacy (they see IP + queried addresses) | Multiple defaults, fallback ranking, user-supplied endpoints, cross-check option for security-critical reads | Real. Fully self-sovereign only if the user runs their own node (supported via custom RPC). |
| WalletConnect relay | Mobile/remote wallet transport | Outage breaks WalletConnect sessions (injected wallets unaffected); relay sees encrypted session metadata | Injected-wallet path has no relay dependency; documented in PRIVACY.md | Real for WalletConnect users; protocol relies on Reown-operated infrastructure. |
| DEX contracts/APIs | Swap quotes and execution (phase 5) | Interface deprecation; API outage | Quotes from on-chain calls where possible; contracts are on-chain and permissionless; only the convenience APIs are centralized | Low for execution (on-chain), real for routing convenience. |
| Token price providers | Fiat estimates (later, optional) | Outage or bad data | Behind adapter; app fully functional without prices; never used for swap safety math | Optional feature only. |
| Blockchain indexers | Fast history/portfolio (later, optional) | Outage; false history | Direct RPC log scanning fallback (slower but functional); adapter interface | Optional feature only. |
| npm registry + GitHub | Build-time supply chain | Package compromise | Pinned lockfile, audits, reproducible builds | Build-time only; does not affect deployed users directly. |

## What "non-custodial" means here — and what it does not

- OMIKAMI WALLET cannot move funds, cannot freeze funds, cannot recover funds. Keys stay in the user's wallet.
- Non-custodial does not mean unstoppable: DNS, hosting, and RPC layers can degrade access. The IPFS deployment plus user-configurable RPC endpoints are the documented path to keep operating when they do.

## Reproducibility

- `scripts/` will contain a documented, deterministic build procedure (pinned toolchain, frozen lockfile) and a hash-comparison script.
- Every release publishes: git tag, build hash, IPFS CID (once IPFS deployment is set up), and the toolchain versions used.
- Anyone must be able to rebuild and byte-compare. Divergence is treated as a security incident.

## IPFS deployment notes

- Static export contains no server functions, so IPFS hosting is technically feasible; confirmed at scaffold (Assumption A9 in PROJECT_PLAN.md).
- Known IPFS constraints to document at implementation: gateway header stripping affects CSP/frame-ancestors delivery (compensated by meta CSP where possible and by wallet-side confirmation being the final authority), relative-path routing requirements, and gateway trust (users should prefer local IPFS nodes or reputable gateways).
