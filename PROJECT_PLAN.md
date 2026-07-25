# OMIKAMI WALLET — PROJECT_PLAN.md

Status: DRAFT — awaiting human review (Gate 1 not passed)
Date: 2026-07-13
Scope: Phase-one planning. No code deployed. No contracts written. No mainnet activity.

---

## 1. Mission

A non-custodial, open-source Ethereum wallet dashboard. OMIKAMI WALLET never holds keys, never signs on behalf of users, and never takes custody. All signing happens inside the user's own connected wallet (browser extension, WalletConnect wallet, or hardware wallet via compatible software).

## 2. Security model (non-negotiable, restated)

- No seed phrases or private keys: never requested, displayed, transmitted, logged, or stored.
- No server-side signing. No custody at any step.
- No analytics in the secure prototype. No tracking scripts. No fingerprinting.
- Exact ERC-20 approvals by default; unlimited approvals only behind an explicit advanced warning.
- Every transaction shown in a human-readable preview before the wallet confirmation.
- No invented contract addresses, ABIs, chain IDs, or RPC URLs. Unverifiable values are marked: "I do not know. This requires verification from the official source."
- AI-generated code is treated as unaudited code until independently reviewed.

## 3. Phase separation

### Phase 1 (this plan) — read-only shell on Sepolia
1. Planning documents (this set) — requires human review before coding.
2. Read-only shell: wallet connect/disconnect, active chain display, connected address (checksummed), ENS display (mainnet resolution, read-only), native balance, security status panel.
3. No sending, no approvals, no swaps, no contract deployment.

### Phase 2 — read-only portfolio
- ERC-20 balance reads for a reviewed Sepolia token list, verified/unverified token status, spam-token quarantine section, explorer links, copy-address control.
- Transaction history via adapter interface (direct RPC log scanning first; optional indexer adapter later).

### Phase 3 — send flow (testnet only)
- Full send flow per specification, including all listed warnings, gas reservation on max, and wallet-side confirmation.

### Phase 4 — allowance manager (testnet only)
- Allowance dashboard, revoke, reduce. Exact-approval policy enforced.

### Phase 5 — swap quotes, then swap execution (testnet only)
- Read-only quote flow first. Execution only against a reviewed, allowlisted contract registry. Simulation before submission where supported.

### Phase 6 — OMIKAMI SHIELD hardening
- Simulation, approval-risk detection, address-poisoning and similar-address warnings, typed-data summaries, blind-signing warnings, chain-mismatch protection. Verdict labels limited to: Verified / Known / Unknown / Suspicious / Blocked by local policy.

### Phase 7 — mainnet gates
- All 12 gates in MAINNET_CHECKLIST.md, including external review and capped beta.

### Later roadmap (not phase one)
- Base, Arbitrum, Optimism, Polygon activation (each only after independent verification of chain config, tokens, explorers, RPCs, contracts).
- Safe Smart Account integration (separate design document; no custom Modules/Guards without the full audit pipeline).
- Optional signed authentication (SIWE-style with nonce, domain binding, chain binding, expiry, replay protection).
- Optional price feeds and indexers behind adapters, with privacy documentation.

## 4. Proposed repository structure

Single pnpm workspace monorepo:

```
omikami-wallet/
├── apps/
│   └── web/                    # Next.js app (static-export compatible)
│       ├── src/app/            # Routes: portfolio, send, receive, swap,
│       │                       #   activity, allowances, security, settings
│       ├── src/components/
│       └── src/lib/
├── packages/
│   ├── chain-config/           # Explicit chain registry: chain IDs, RPC lists,
│   │                           #   explorers. Zod-validated. No secrets.
│   ├── security/               # OMIKAMI SHIELD: address checks, approval risk,
│   │                           #   slippage checks, tx summaries. Pure functions.
│   ├── token-registry/         # Reviewed token lists keyed by chainId+address.
│   ├── ui/                     # Presentational components (dark/gold theme).
│   └── types/                  # Shared strict TypeScript types.
├── docs/                       # ADRs, PRIVACY.md details, SAFE_DESIGN.md (later),
│                               #   release documentation
├── tests/                      # e2e (Playwright), integration fixtures
├── scripts/                    # build verification, release hash generation
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
├── THREAT_MODEL.md
├── PRIVACY.md
├── DECENTRALIZATION.md
├── INCIDENT_RESPONSE.md
├── DEPENDENCY_POLICY.md
├── RELEASE_CHECKLIST.md
├── MAINNET_CHECKLIST.md
├── LICENSE                     # Proposed: MIT or GPL-3.0 — HUMAN DECISION REQUIRED
└── .env.example                # Non-secret config only (e.g. WalletConnect
                                #   project ID, which is public by design)
```

No `contracts/` package in phase one: phase one deploys and requires zero custom smart contracts. Foundry/Slither/OpenZeppelin enter the repo only if/when a custom contract is approved.

## 5. Dependency proposal (runtime)

Versions below are the latest stable published to the npm registry, checked 2026-07-13 with `npm view`. Compatibility between these majors (Next 16 / React 19 / TypeScript 7 / wagmi 3) must be confirmed during scaffold by typecheck and tests before pinning — flagged as Assumption A1.

| Package | Version (registry, 2026-07-13) | Licence | Why required | Security-sensitive access | Smaller alternative? |
|---|---|---|---|---|---|
| next | 16.2.10 | MIT | App framework, static export | Serves all UI; CSP configured here | Vite+React (less structure, similar surface). Kept per brief. |
| react / react-dom | 19.2.7 | MIT | UI runtime | Renders tx previews | None reasonable |
| typescript | 7.0.2 | Apache-2.0 | Strict typing | Dev-only | None |
| wagmi | 3.7.1 | MIT | Wallet connection hooks, chain state | Talks to user wallet; requests signatures (user-approved only) | Raw viem possible but re-implements audited connector logic — higher risk |
| viem | 2.55.1 | MIT | Typed RPC client, ABI encoding, address checksum | Encodes every transaction; reads RPC | ethers.js is larger; viem preferred |
| @wagmi/connectors | 8.0.22 | MIT | Injected + WalletConnect connectors | Bridge to wallets | Part of wagmi ecosystem |
| @walletconnect/ethereum-provider | 2.23.10 | Custom licence file — HUMAN REVIEW REQUIRED before adoption | WalletConnect v2 transport | Relays session data through WalletConnect infra | Injected-only support (drops mobile wallets) |
| @tanstack/react-query | 5.101.2 | MIT | Caching/retry for RPC reads | Holds balance data in memory only | Hand-rolled fetch (worse retry/failure states); wagmi peer dep anyway |
| zod | 4.4.3 | MIT | Runtime validation of chain config, token lists, user input | Validates security-critical config | Smaller validators exist; zod required by brief |
| tailwindcss | 4.3.2 | MIT | Styling | None (build-time) | Plain CSS (slower iteration) |

Dev/test: vitest 4.1.10 (MIT), @playwright/test 1.61.1 (Apache-2.0), eslint 10.7.0 (MIT), prettier 3.9.5 (MIT). Package manager: pnpm (installed via corepack; not yet present in the sandbox).

Explicitly excluded in phase one: analytics SDKs, error-reporting SaaS, price-feed SDKs, indexer SDKs, any wallet SDK that handles key material, custom crypto.

Lockfile is committed; installs use `--frozen-lockfile` in CI; dependency updates go through DEPENDENCY_POLICY.md review.

## 6. Components touching sensitive data (full inventory)

| Component | Wallet address | Signatures | Transactions | Approvals | RPC | Pricing | External APIs |
|---|---|---|---|---|---|---|---|
| wagmi/viem connector layer | yes | requests (wallet signs) | submits after user confirm | no | yes | no | WalletConnect relay |
| chain-config package | no | no | no | no | defines endpoints | no | no |
| Portfolio (read-only) | yes (read) | no | no | reads allowances later | read-only client | later, behind adapter | explorer links only |
| Send flow (phase 3) | yes | preview → wallet | builds unsigned tx | no | read + estimate gas | no | no |
| Swap flow (phase 5) | yes | preview → wallet | builds unsigned tx | exact approvals | read + simulate | quote source (verified) | DEX contracts only |
| Allowance manager (phase 4) | yes | preview → wallet | revoke/reduce txs | yes | read + write | no | no |
| OMIKAMI SHIELD | yes (local analysis) | summarizes, never signs | simulates | risk-scores | simulation RPC | no | optional local lists only |
| ENS display | yes | no | no | no | mainnet read | no | no |
| Settings (custom RPC) | no | no | no | no | stores user RPC URLs locally | no | no |

Everything in this table runs client-side. There is no server component holding user data in phase one.

## 7. Assumptions requiring human verification

- A1: Compatibility of next 16.2.x + react 19.2.x + wagmi 3.7.x + viem 2.55.x + typescript 7.0.x. Verify at scaffold via typecheck, lint, unit tests. If incompatible, pin to the newest verified-compatible set and document in an ADR.
- A2: WalletConnect (Reown) project ID: required for WalletConnect transport, obtained by the human from the official WalletConnect/Reown cloud dashboard. It is a public identifier, not a secret, but must not be invented. Injected-wallet support works without it.
- A3: Licence choice (MIT vs GPL-3.0) — human decision.
- A4: @walletconnect/ethereum-provider ships a custom licence file — human must read it before the dependency is adopted.
- A5: Default RPC endpoints: phase one uses the public defaults shipped inside viem's chain definitions for Sepolia plus user-configurable overrides. Any additional hardcoded RPC URL must be taken from the provider's official documentation by a human. I will not invent RPC URLs.
- A6: Chain IDs used: Ethereum mainnet 1, Sepolia 11155111 (and later Base 8453, Arbitrum One 42161, OP Mainnet 10, Polygon PoS 137). These are widely documented but must be cross-checked against chainlist/official docs before entering chain-config.
- A7: All future DEX router/quoter/factory addresses: unknown at this time. "I do not know. This requires verification from the official source." None enter the registry without multi-source verification.
- A8: Token list source for Sepolia test tokens — human-reviewed before inclusion.
- A9: Next.js static export (`output: 'export'`) supports everything the shell needs (it should, since phase one has no server functions) — verify at scaffold.

## 8. Working rules per phase

Each phase: state goal → list security assumptions → list files → explain decisions → implement smallest reviewable unit → lint → typecheck → test → review diff → report unresolved risks → stop before anything irreversible. No error hiding, no disabled security checks without written justification, no placeholder addresses in executable production config, no unfinished security control marked complete.

## 9. Immediate next step (pending your approval)

Build the phase-one read-only shell on Sepolia: scaffold the pnpm workspace, wallet connection (injected + WalletConnect if project ID supplied), chain/address/balance display, disconnect, security status panel, CSP headers, lint/typecheck/unit tests. Nothing deployed.
