# OMIKAMI WALLET — ARCHITECTURE.md

Status: DRAFT — awaiting human review
Date: 2026-07-13

---

## 1. High-level shape

A client-only decentralized application. No proprietary backend, no user database, no server-side signing, no custody. The frontend is a statically exportable Next.js app; every sensitive operation happens either in the user's wallet or as a read against a public RPC endpoint.

```
┌──────────────────────────── Browser ────────────────────────────┐
│  apps/web (Next.js, static export)                              │
│  ├─ UI (packages/ui) — previews, warnings, navigation           │
│  ├─ OMIKAMI SHIELD (packages/security) — pure analysis functions│
│  ├─ chain-config — explicit, Zod-validated chain registry       │
│  ├─ token-registry — reviewed lists, chainId+address identity   │
│  └─ wagmi + viem                                                │
│       ├─ Public client (READ ONLY) ──► RPC endpoints (multiple, │
│       │                                user-configurable,       │
│       │                                timeout + fallback)      │
│       └─ Wallet client (SIGN REQUESTS ONLY) ──► user's wallet   │
│                                (injected / WalletConnect /      │
│                                 hardware via wallet software)   │
└──────────────────────────────────────────────────────────────────┘
```

Keys never enter this diagram. The wallet client only *requests* actions; the user's wallet displays, signs, or rejects.

## 2. Module boundaries

### apps/web
- Route-level composition only. Routes: Portfolio, Send, Receive, Swap, Activity, Allowances, Security, Settings.
- Owns the wagmi config (connectors, transports) and the CSP configuration.
- No business logic in components: components call package functions and render their results.

### packages/types
- Strict shared types: `TokenId = { chainId, address (checksummed) }`, `TxPreview`, `RiskVerdict = 'verified' | 'known' | 'unknown' | 'suspicious' | 'blocked'`, branded types for checksummed addresses and wei amounts (bigint only — never floating point for value math).

### packages/chain-config
- Explicit per-chain records: chain ID, name, native currency, RPC URL list (ordered), block explorer base URL, testnet flag, enabled flag.
- Zod schema validates the registry at build time and at runtime load.
- Phase one enables only Sepolia (and mainnet read-only for ENS resolution). Mainnet transaction features are disabled by a hard flag until MAINNET_CHECKLIST gates pass.
- User-added custom RPCs are stored locally (only with explicit opt-in persistence), validated as https URLs, and clearly labelled as user-supplied.

### packages/token-registry
- Token identity is always chainId + checksummed contract address; symbol/name are display-only and untrusted.
- Each entry carries a status: `verified` (human-reviewed source) or `unverified`. Unknown tokens discovered on-chain are `unknown`; heuristically suspicious ones are `suspicious` and rendered in a quarantined section, never auto-hidden if they hold value.

### packages/security (OMIKAMI SHIELD)
- Pure, unit-testable functions with no I/O where possible:
  - address validation + checksum verification,
  - similar-address / poisoning detection (first/last character emphasis, lookalike comparison against user's history),
  - approval risk analysis (spender allowlist check, amount vs. balance, unlimited-approval detection),
  - slippage and price-impact classification,
  - transaction summary generation (decoded calldata → human sentences),
  - typed-data (EIP-712) summary generation and blind-signing detection,
  - chain-mismatch checks.
- Simulation adapter interface (RPC `eth_call`/`eth_estimateGas` based first; optional external simulators later behind the same interface).
- Output is always a `RiskVerdict` + human-readable reasons. Heuristics are never presented as confirmed scam verdicts.

### packages/ui
- Presentational only. Dark charcoal/gold theme, high contrast, accessible (keyboard navigation, focus states, ARIA), responsive.
- Security-critical buttons use the mandated wording (Review transaction / Confirm in wallet / Reject / Revoke approval / Switch network / Disconnect wallet). No "Continue" on authorization-creating actions.

## 3. Read/write separation

- **Public client (viem)**: all balance, allowance, ENS, gas, simulation reads. Configured with multiple transports, per-request timeout, and ranked fallback. Never holds signing capability.
- **Wallet client (wagmi)**: created only from the user's connected wallet. Used exclusively for user-initiated, previewed actions. Every write path funnels through one `TxPreview → user review → wallet confirmation` pipeline; there is no code path that submits a transaction without rendering the preview component first (enforced by making the submit function private to the preview flow).

## 4. Data flow for a future write action (send/approve/swap)

1. User input → Zod validation (address checksum, amount parsing with token decimals, chain check).
2. Build unsigned transaction with viem (typed).
3. OMIKAMI SHIELD analysis: simulation, risk verdicts, warnings.
4. Render `TxPreview`: sender, recipient, asset + contract address, amount, network, estimated gas, total wallet impact, explorer link, all warnings.
5. "Confirm in wallet" → wagmi wallet client request → user's wallet signs or rejects.
6. Track states: pending / confirmed / failed / rejected / timeout. No optimistic balance updates.

Phase one implements steps 0 (connection) and read-only display only.

## 5. State and persistence

- In-memory by default (React state + TanStack Query cache).
- Nothing about the wallet persists past the browser session unless the user explicitly enables local persistence in Settings (then: connected-address convenience data and custom RPC list in `localStorage`, documented in PRIVACY.md).
- Never stored anywhere: seed phrases, private keys, signatures, session tokens with signing power.
- wagmi's default connection persistence is reviewed at scaffold time and disabled or gated behind the explicit opt-in.

## 6. Frontend security

- Strict TypeScript (`strict: true`, no `any` in security paths).
- CSP: `default-src 'self'`; `connect-src` limited to configured RPC/WalletConnect endpoints; no `unsafe-inline` scripts, no `unsafe-eval`, `frame-ancestors 'none'` (clickjacking), `object-src 'none'`. Exact header set finalized at scaffold and tested (static hosting requires meta/header support from the host — documented per deployment target).
- No eval, no dynamic remote code, no remote fonts/scripts in the secure prototype.
- No secrets in the bundle. `.env.example` contains only public identifiers.
- Error messages are user-safe; raw RPC errors logged only to the local console in dev builds, never transmitted.

## 7. Decentralization posture (summary — see DECENTRALIZATION.md)

- Static export → deployable to IPFS or any static host.
- Direct RPC reads; optional indexers strictly behind adapter interfaces with a degraded-but-functional fallback.
- User-configurable RPC endpoints; no mandatory proprietary auth; no central database.
- Reproducible builds + published release hashes (scripts/ + RELEASE_CHECKLIST.md).

## 8. Architecture decision records

`docs/adr/` starts with:
- ADR-001: Wallet-connected dApp, not key-generating wallet (custody risk elimination).
- ADR-002: wagmi + viem over ethers/custom (audited connector logic, typed encoding, smaller surface).
- ADR-003: Static export + client-only architecture (decentralization, no server secrets).
- ADR-004: Exact approvals by default (allowance risk reduction).
- ADR-005: Pure-function security layer (testability of every SHIELD heuristic).
