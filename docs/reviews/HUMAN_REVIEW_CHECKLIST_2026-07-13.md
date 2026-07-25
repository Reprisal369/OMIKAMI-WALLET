# OMIKAMI WALLET — Human-review checklist (updated 2026-07-25)

Scope: read-only phases 1 + 2 + the read-only TRANSFER PREVIEW (transaction simulation, signing hard-off). Answers the question: is the project safe to keep building read-only features?

## 2026-07-25 delta — read-only transfer preview

- New pure validator `packages/security/src/send-preview.ts` (`buildSendPreview`, `parseAmountInput`); `signingAvailable` is a literal `false`, no wagmi write path. 20 new unit tests (security 57 / total unit 74).
- New `SendPreviewPanel` — SHIELD checks for burn/zero address, token-contract recipient, self-send, address-poisoning lookalike, over-balance, unverified token. Deliberately has NO send/sign/submit button.
- Read-only invariant kept; e2e test 15 updated (3 text inputs, 0 credential/tx buttons) + new tests 19/20.
- Audit: fresh dev-only advisory (brace-expansion via eslint→minimatch, not shipped) patched by pnpm override `brace-expansion>=5.0.8`; `pnpm audit` → 0.
- E2E browser run deferred to the owner (Chromium download blocked in sandbox, as before); specs typecheck clean.

## Verified passing right now (sandbox, this session)

| Gate | Result |
|---|---|
| ESLint (incl. key-material/storage/HTML-injection bans) | PASS |
| TypeScript strict typecheck (all packages) | PASS |
| TypeScript typecheck of e2e specs | PASS |
| Unit tests | 54/54 PASS (chain-config 7, security 37, token-registry 10) |
| Forbidden-pattern gate (seed/key/keystore/eval/storage) | PASS (0) |
| Secret gate (keys, PEM, .env) | PASS (0) |
| Production static build | PASS |
| Bundle allowlist gate (no unknown hosts, no sourcemaps) | PASS (34 files) |
| Dependency audit (`pnpm audit`) | PASS (0 vulnerabilities, after next→16.2.11 + sharp override) |
| SBOM generation | PASS (186 components; 143 MIT) |
| Release-hash manifest | PASS (per-build integrity hash) |

## Verified on the owner's machine (real browser)

- Playwright e2e: 32/32 passed (desktop + mobile), last full run this day. Covers: connect, reject, wrong-network, balance, RPC timeout/malformed, disconnect, refresh-no-storage, layout, read-only invariant, token panel, activity + quarantine, RPC-input validation, keyboard nav.
- Manual UAT: MetaMask connect on Sepolia, live 0.05 ETH + 20 USDC (faucet) balances, USDC double-sourced (Circle docs + Etherscan), disconnect, network switch.

## Complete

- Phase 1 read-only shell; Phase 2 portfolio (ERC-20 balances, ENS, activity via eth_getLogs, unknown-token quarantine, user-configurable RPC with strict validation).
- Docs: PROJECT_PLAN, ARCHITECTURE, THREAT_MODEL (+ owner review, + C1b/C1c amendments), SECURITY, DECENTRALIZATION, MAINNET_CHECKLIST, PRIVACY, DEPENDENCY_POLICY, INCIDENT_RESPONSE, RELEASE_CHECKLIST, CONTRIBUTING, LICENSE (MIT).
- Enforcement in code: no-key-material, no-browser-storage (one reviewed exception), no-HTML-injection, no unknown outbound hosts — all as failing gates, not just prose.

## Still missing / open (honest)

1. **CI not active.** Workflow is written but the repo is not on GitHub and every action is a version tag, not a pinned commit SHA. Until activated, all gates are run manually. → Put repo on GitHub, pin actions to SHAs, enable branch protection.
2. **CSP headers not enforced.** Static export cannot emit HTTP headers; must be set at the hosting layer and verified (Gate 7). Dev mode still needs unsafe-eval.
3. **Reproducible builds not byte-identical.** Next 16 Turbopack ignores `generateBuildId`; independent rebuilds differ. Release-hash still detects tampering of a published build. Full determinism = Gate 8.
4. **External security review + smart-contract audit: not started.** These are Gates 9/10 and gate the TRANSACTION phases, not read-only.
5. **Owner e2e not re-run after today's tooling/copy changes** (no test-affecting logic changed). Optional reconfirm: `pnpm e2e`.
6. THREAT_MODEL still formally "conditionally approved" for read-only; full approval needs the implementation-verification pass this checklist begins.

## Verdict

**Safe to continue building READ-ONLY features.** Every locally-enforceable gate passes; the app holds no keys, signs nothing, stores nothing sensitive, and contacts no unexpected host. The open items (1–6) are correctly scoped to hosting/CI activation and to the later TRANSACTION phases — none blocks further read-only work.

**NOT yet cleared for transaction features** (send/approve/swap) or any mainnet deployment: those require items 1–5 plus the owner's full (not conditional) threat-model sign-off and an independent external review.
