# OMIKAMI WALLET — CONTRIBUTING.md

Date: 2026-07-13

## Setup

Node ≥ 22 and pnpm 10 (`corepack enable`). Then:

```bash
pnpm install
pnpm --filter @omikami/web dev   # http://localhost:3000
pnpm verify                      # full gate suite — must be green before any PR
```

## Non-negotiable rules for every change

1. **No key material, ever.** No seed phrase, private key, keystore, JSON wallet, or recovery-phrase import — no input for them, no API that handles them (`viem/accounts` is lint-banned). The wallet connects via EIP-1193 only.
2. **Read-only until gates pass.** No send, approve, permit, message signing, swap, bridge, staking, or deployment code lands while `transactionsEnabled` is false; flipping that flag requires the MAINNET_CHECKLIST process, never a code-only change.
3. **New inputs require review.** Any new `<textarea>`, password/file input, QR scanner, file upload, route, or modal fails the forbidden-pattern gate by design; adding one requires a threat-model amendment in the same PR.
4. **No browser storage** (localStorage/sessionStorage/IndexedDB) without an approved threat-model amendment; persistence is opt-in by design.
5. **No new outbound endpoints** without updating PRIVACY.md and the bundle-gate allowlist in the same PR — the build fails otherwise.
6. **Dependencies** follow DEPENDENCY_POLICY.md (six-point record in the PR).
7. **Honesty over green.** Never weaken a test or gate to make it pass; document what is unfinished in PROJECT_STATE.md instead.

## PR checklist

- [ ] `pnpm verify` green locally
- [ ] PROJECT_STATE.md updated if status, risks, or external requests changed
- [ ] Security-relevant change? → THREAT_MODEL.md amended in this PR
- [ ] Screenshots for UI changes (desktop + mobile width)

## Licence

MIT (owner decision, 2026-07-13 — resolves PROJECT_PLAN assumption A3). All contributions are accepted under the MIT licence in the repository root. The copyright line currently reads "OMIKAMI WALLET contributors"; the owner may substitute a legal name before first publication.
