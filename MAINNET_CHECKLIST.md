# OMIKAMI WALLET — MAINNET_CHECKLIST.md

Status: DRAFT — awaiting human review
Date: 2026-07-13

Rule: Ethereum mainnet transaction features stay behind a hard disabled flag in chain-config until every gate below is checked off by a named human reviewer with a date. No gate may be marked complete while any of its items is unfinished. AI-generated code is treated as unaudited until Gate 9/10 review covers it.

## Gate 1 — Architecture and threat model reviewed
- [ ] PROJECT_PLAN.md, ARCHITECTURE.md, THREAT_MODEL.md reviewed by a human owner.
- [ ] Open questions and accepted risks recorded with rationale.
- Reviewer: ______  Date: ______

## Gate 2 — Testnet prototype without custody or key handling
- [ ] Full user flows work on Sepolia via connected wallets only.
- [ ] Code search confirms zero seed-phrase/private-key inputs or handling.
- [ ] INCIDENT_RESPONSE.md authored.
- Reviewer: ______  Date: ______

## Gate 3 — Contract addresses independently verified
- [ ] Every production address in the registry verified against at least two independent trusted sources (official docs, verified explorer source, official deployment announcement).
- [ ] Checksums validated in CI. No placeholder addresses anywhere in executable config.
- [ ] Verification evidence (links, hashes, reviewer) recorded per address.
- Reviewer: ______  Date: ______

## Gate 4 — Dependency audit
- [ ] Full dependency tree reviewed per DEPENDENCY_POLICY.md (need, access, alternative, version, licence, maintenance).
- [ ] `pnpm audit` clean or exceptions documented and accepted.
- [ ] Lockfile pinned; install scripts reviewed.
- Reviewer: ______  Date: ______

## Gate 5 — Static analysis
- [ ] ESLint (security rules) clean.
- [ ] TypeScript strict, no suppressions in security paths (any `@ts-expect-error`/`eslint-disable` in security code justified in writing).
- [ ] Bundle scan: no secrets, no unexpected outbound endpoints.
- [ ] (If any contract exists) Slither clean or triaged.
- Reviewer: ______  Date: ______

## Gate 6 — Test suites pass
- [ ] Unit: address validation, amount parsing, chain validation, allowance math, slippage math, decimals, tx summaries.
- [ ] Integration: mocked RPC (failures, timeouts, malformed and conflicting responses).
- [ ] Fork tests where appropriate.
- [ ] E2E on testnet: happy paths + rejected signature, wrong chain, expired quote, RPC failure, malformed token, malicious metadata, large numbers/rounding, mobile viewport, keyboard navigation.
- [ ] No real mainnet funds used in automated tests.
- Reviewer: ______  Date: ______

## Gate 7 — CSP and frontend security review
- [ ] CSP verified in deployed responses (no unsafe-inline scripts, no eval, frame-ancestors none).
- [ ] XSS review of all chain-derived rendering paths.
- [ ] Clickjacking, error-message hygiene, and storage audit (nothing sensitive persisted without opt-in) complete.
- Reviewer: ______  Date: ______

## Gate 8 — Reproducible build
- [ ] Documented deterministic build; independent rebuild matches byte-for-byte or with documented, justified exceptions.
- [ ] Release hash + (if applicable) IPFS CID publication process tested.
- Reviewer: ______  Date: ______

## Gate 9 — External security review
- [ ] Independent (non-author, external to the project) security review of the frontend and architecture completed; findings fixed or accepted in writing.
- Reviewer: ______  Date: ______

## Gate 10 — Smart contract audits
- [ ] Independent audit for every custom contract (phase one: none exist; this gate blocks any future contract).
- [ ] Findings resolved; report published.
- Reviewer: ______  Date: ______

## Gate 11 — Disclosure and bounty
- [ ] Security contact + PGP published; safe-harbor policy live.
- [ ] Bug-bounty scope and rewards defined and announced.
- Reviewer: ______  Date: ______

## Gate 12 — Capped mainnet beta
- [ ] Mainnet enabled for a small, documented beta cohort with prominent risk warnings and (where feasible) UI-level value caps.
- [ ] Beta period completed with zero unresolved critical/high findings.
- [ ] Post-beta review recorded; only then general availability.
- Reviewer: ______  Date: ______
