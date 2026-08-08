# OMIKAMI WALLET — External audit package (v0.5.4)

**Cover document for an independent security review.** Self-contained: a reviewer
can start from this page alone. Deeper evidence lives in the linked documents; the
v0.5.0 evidence package remains valid as the baseline (architecture, threat-model
mapping, egress, headers, CI) and is referenced where relevant.

| | |
|---|---|
| **Product** | OMIKAMI WALLET — non-custodial, open-source Ethereum wallet & DeFi dashboard |
| **Phase** | **Read-only**. No transactions, approvals, swaps, bridges, staking, message signing, or mainnet. |
| **Release under review** | `v0.5.5` (tag `v0.5.5`) |
| **Audited product-code commit** | `213cc04ebf1247a9fd861b4210c253c2317c658b` (tag `v0.5.5`) |
| **Network** | Ethereum **Sepolia** (testnet) only |
| **Repository** | https://github.com/Reprisal369/OMIKAMI-WALLET (public, MIT) |
| **Live preview** | https://omikami-wallet.pages.dev (read-only, Sepolia) |
| **License** | MIT (`LICENSE`) |
| **Prepared** | 2026-08-08 |

> The audited product code is the tree at tag `v0.5.5` (`213cc04`). This package
> and the other review docs may sit on a later documentation-only commit; they
> change no product behaviour relative to that commit.

---

## 1. Exact audited commit & how to reproduce

```bash
git clone https://github.com/Reprisal369/OMIKAMI-WALLET.git
cd OMIKAMI-WALLET
git checkout v0.5.5            # commit 213cc04
corepack enable
pnpm install --frozen-lockfile
pnpm verify                    # lint · typecheck · typecheck:e2e · unit · forbidden · secrets · build · bundle · audit
pnpm e2e                       # Playwright (run: pnpm exec playwright install chromium first)
pnpm sbom                      # generates the CycloneDX SBOM
```

Requirements: Node ≥ 22, pnpm 10.34.5 (pinned via `packageManager`).

---

## 2. Project summary

OMIKAMI WALLET is a small, fully-typed pnpm monorepo that renders a read-only
Ethereum dashboard. It connects an injected browser wallet (EIP-1193 / EIP-6963)
and displays, all read-only:

- checksummed, poisoning-aware address display and ENS name;
- native + verified ERC-20 balances (Sepolia), with a user-configurable RPC endpoint;
- recent ERC-20 activity via `eth_getLogs`, with unknown-token **quarantine**;
- an **allowance dashboard** (spender, current allowance, unlimited-allowance
  warning, risk badge, verification source);
- a transfer **preview** with OMIKAMI SHIELD heuristic checks — **signing is
  disabled build-wide**, so there is deliberately no send/sign/submit control;
- an OMIKAMI SHIELD security-status panel.

It never asks for a seed phrase or private key, never signs, and never takes
custody. There are **no first-party smart contracts** in this phase — the review
is a **web/dApp client-security** review, not a smart-contract audit.

---

## 3. Architecture overview

A pnpm workspace monorepo; the app is a **Next.js static export** (`output:
'export'`, Turbopack) hosted on Cloudflare Pages. Security-critical logic is a set
of **pure, unit-tested functions** in `packages/`, kept out of the React layer.

| Package | Responsibility |
|---|---|
| `packages/types` | Shared TypeScript types (e.g. `SecurityCheckStatus`). |
| `packages/chain-config` | Supported chains, `transactionsEnabled` gate, explorer URLs. |
| `packages/security` | Pure validators: address/EIP-55, RPC-URL validation, send-preview (SHIELD), allowance & activity summarisers. |
| `packages/token-registry` | Reviewed token list + `sanitizeTokenText` (strips Unicode bidi/zero-width). |
| `packages/ui` | Presentational components (Panel, StatusBadge, buttons). |
| `apps/web` | Next.js app; wagmi/viem wiring; the read-only panels. |

**Runtime network egress (the only hosts the app contacts):**

- `https://11155111.rpc.thirdweb.com` — Sepolia RPC (blocks, balances, logs, allowances).
- `https://eth.merkle.io` — Ethereum mainnet RPC, used **only** for ENS name resolution.

Transports are **explicitly pinned** in `apps/web/src/lib/wagmi.ts` so a viem
default change cannot silently move egress; `connect-src` in the CSP and the
build-time bundle allowlist enforce the same two hosts. A user may configure their
own Sepolia RPC (validated https-only, no internal hosts).

---

## 4. Security guarantees (and how they are enforced)

**The read-only invariant:** no reachable code path can sign or broadcast a
transaction. Enforced by four independent mechanisms:

1. **Config gate** — `transactionsEnabled` is `false` for every chain
   (`packages/chain-config`), unit-tested; `signingAvailable` is hard-wired
   `false` in the send-preview model.
2. **Forbidden-pattern build gate (M1)** — `scripts/check-forbidden-terms.mjs`
   fails the build if any wallet write/sign/switch API appears in source
   (`useSendTransaction`, `useWriteContract`, `writeContract`, `sendTransaction`,
   `signMessage`, `signTypedData`, `switchChain`, `prepareTransactionRequest`, …).
3. **No transaction UI** — the transfer panel has no send/sign/submit control;
   an e2e test asserts no such control and exactly three non-credential inputs.
4. **Defence in depth** — strict CSP (`default-src 'none'`, hash-based
   `script-src`, `connect-src` limited to the two hosts), pinned transports, and
   a bundle allowlist that fails on any unknown egress host or sourcemap.

Additional properties: untrusted on-chain strings are sanitised before render
(bidi/zero-width stripped); unknown token contracts are **never called**
(quarantined); addresses are EIP-55 checksummed with address-poisoning heuristics;
no analytics, no third-party trackers, no browser storage of wallet sessions
(verified by e2e).

---

## 5. Scope

**In scope (summary — full text in `SECURITY_AUDIT_SCOPE.md`):** the read-only
invariant; input handling (recipient address, amount, RPC-URL validation);
rendering of untrusted on-chain data; RPC/data integrity and egress; supply chain
and build integrity; CSP and security headers; the pure security functions in
`packages/security` and `packages/token-registry`.

**Out of scope (this phase):** anything transactional (there is none); first-party
smart contracts (none exist); mainnet behaviour; the security of third-party
wallets, RPC operators, or the user's device.

---

## 6. Threat model (summary)

Full model in `THREAT_MODEL.md`, organised A–G with per-item mitigations and a
review gate:

- **A. Key material** — the app never handles seeds/keys; signing disabled.
- **B. Supply chain & build** — pinned deps + lockfile, pinned CI action SHAs,
  forbidden-pattern/secret/bundle gates, SBOM + OSV scan.
- **C. RPC & data integrity** — pinned egress, https-only custom RPC validation,
  no fabricated data on RPC error/timeout.
- **D. Address & token attacks** — EIP-55 checksums, poisoning heuristics,
  unknown-token quarantine, text sanitisation.
- **E. Transaction & approval attacks** — none reachable (read-only); allowance
  dashboard is display-only.
- **F. Application & web attacks** — strict CSP/headers (A+ on securityheaders.com),
  no dangerous sinks, no browser storage of sessions.
- **G. Contract-level threats** — N/A this phase (no first-party contracts);
  gated for a future transaction phase behind its own model + a separate
  smart-contract audit.

---

## 7. Test evidence (verified for v0.5.5 / `213cc04`)

Reproduced from a clean build of the audited commit:

| Gate | Result |
|---|---|
| Unit tests | **94 passed** (7 files) — token-registry 13, chain-config 7, security 74 (send-preview, allowance, rpc, activity, index) |
| End-to-end (Playwright) | **38 tests** (read-only shell, invariant, panels, RPC error states) |
| `pnpm audit` | **0 vulnerabilities** |
| Lint / typecheck / typecheck:e2e | clean |
| Forbidden-pattern gate | clean |
| Secret-scan gate | clean |
| Bundle allowlist | **36 files, 0 unknown hosts, 0 sourcemaps** |
| CSP generation | 12 inline-script hashes; strict policy emitted to `_headers` |
| CI on `213cc04` | **10/10 checks passed** (verify, e2e, SBOM+hash, OSV scan, secret scan, CodeQL, …) |

**Independent free-tools security review (completed):**
- GitHub **CodeQL**: **0 open alerts** — one High (ReDoS in the amount parser)
  fixed in v0.5.3 with a regression test; one build-script finding dismissed with
  written rationale.
- **securityheaders.com**: **A+** on the live deployment.
- Secret scanning + Dependabot active.

---

## 8. Where to start (highest-risk files)

1. `apps/web/src/lib/wagmi.ts` — chain/transport wiring and pinned egress.
2. `packages/chain-config/src/index.ts` — `transactionsEnabled`, supported chains.
3. `packages/security/src/rpc.ts` — custom RPC-URL validation.
4. `packages/security/src/send-preview.ts` — amount/recipient parsing, SHIELD checks.
5. `packages/token-registry/src/index.ts` — `sanitizeTokenText`, registry gating.
6. `scripts/generate-csp.mjs` and `scripts/check-bundle.mjs` — header/egress enforcement.

Core question: **does the read-only invariant truly hold** — is there any
reachable path that could sign or move funds? Then: input handling, untrusted
on-chain data rendering, supply chain, CSP/headers.

---

## 9. Review instructions & requested deliverable

Run the reproduction in §1. No credentials, secrets, or test accounts are needed
— the reviewer uses their own injected wallet on Sepolia; the app never receives
keys. A manual Sepolia test procedure and per-file risk notes are in
`docs/reviews/AUDIT_PACKAGE_v0.5.0.md` (§10–11, §13), still valid as baseline.

**Requested deliverable:**
- Findings by severity (critical / high / medium / low / info), each with
  file + line references and reproduction steps.
- An explicit statement on whether the **read-only invariant** holds.
- A go / no-go recommendation for beginning the transaction phase.

Responsible-disclosure contact: see `SECURITY.md`.

---

## 10. Package completeness checklist

**Present and consistent (v0.5.5):**

- [x] Cover package — this document (`AUDIT_PACKAGE_v0.5.4.md`)
- [x] Scope & exclusions — `SECURITY_AUDIT_SCOPE.md` (→ v0.5.5 / `213cc04`)
- [x] Reviewer handoff + outreach — `docs/reviews/REVIEWER_HANDOFF.md` (→ v0.5.5)
- [x] Baseline evidence package — `docs/reviews/AUDIT_PACKAGE_v0.5.0.md` (repro §10–11, risk files §13)
- [x] Reviewer onboarding — `docs/reviews/EXTERNAL_AUDIT_PREP.md`
- [x] Threat model — `THREAT_MODEL.md` (A–G)
- [x] Architecture — `ARCHITECTURE.md`
- [x] Security policy / disclosure — `SECURITY.md`
- [x] Security headers — `SECURITY_HEADERS.md`
- [x] Privacy — `PRIVACY.md`
- [x] Dependency policy — `DEPENDENCY_POLICY.md`
- [x] Incident response — `INCIDENT_RESPONSE.md`
- [x] Release checklist — `RELEASE_CHECKLIST.md`
- [x] Decentralization notes — `DECENTRALIZATION.md`
- [x] Mainnet checklist (future) — `MAINNET_CHECKLIST.md`
- [x] Accessibility review — `docs/reviews/ACCESSIBILITY_REVIEW.md`
- [x] Internal pre-audit report — `docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md`
- [x] Changelog — `CHANGELOG.md` (through 0.5.4)
- [x] License — `LICENSE` (MIT)
- [x] CI workflows with pinned action SHAs; branch protection on `main`
- [x] Test evidence current (unit **94**, e2e **38**) — §7

**Optional artifacts to add before sending (nice-to-have, not blockers):**

- [ ] **Committed SBOM snapshot** — `pnpm sbom` generates it and CI produces it
      (SBOM+hash check); a committed `sbom.json` at the tag is convenient for a
      reviewer who doesn't build locally.
- [ ] **Release-hash file** — `pnpm release:hash` output committed alongside the
      SBOM for offline integrity checking.
- [ ] Optional one-line pointer from `REVIEWER_HANDOFF.md` / `EXTERNAL_AUDIT_PREP.md`
      to this v0.5.4 cover page (they currently reference the v0.5.0 evidence
      package, which remains valid).
- [ ] `PROJECT_STATE.md` note for the v0.5.4 session (a11y pass + release).

---

## 11. Ready-to-send outreach

**Email / long form:**

> **Subject:** Security review request — OMIKAMI WALLET (read-only, testnet)
>
> Hi [name],
>
> I'm looking for an independent security review of a small, open-source project
> before it grows further. OMIKAMI WALLET is a **non-custodial, read-only**
> Ethereum wallet & DeFi dashboard, currently on the Sepolia **testnet**. It
> reads balances, tokens, activity, and allowances and shows a transfer
> *preview* — it holds no keys, signs nothing, and has no transaction, approval,
> swap, bridge, staking, or mainnet functionality yet. That comes only after this
> review. There are no first-party smart contracts, so this is a web/dApp
> **client-security** review, not a contract audit.
>
> The codebase is a small, fully-typed pnpm monorepo; the security-critical logic
> is a set of pure, unit-tested functions, and every check runs in CI. I've
> prepared a complete audit package so you can start immediately.
>
> - Repo: https://github.com/Reprisal369/OMIKAMI-WALLET
> - Release / tag to review: `v0.5.5` (commit `213cc04`)
> - Live preview: https://omikami-wallet.pages.dev
> - Start here: `docs/reviews/AUDIT_PACKAGE_v0.5.4.md` (scope, threat model,
>   test evidence, and reproduction, all in one page)
>
> The core question I'd like answered: **does the read-only invariant truly
> hold** — is there any reachable path that could sign or move funds? Beyond
> that, anything on input handling (address poisoning, RPC-URL validation),
> untrusted on-chain data rendering, supply chain, and the CSP/headers is very
> welcome.
>
> Could you share your availability, approach, and a rough quote? Happy to hop on
> a call.
>
> Thanks,
> Reprisal

**Short form (DM / forum post):**

> Open-source, **read-only** Ethereum dashboard on Sepolia testnet — no keys, no
> signing, no contracts yet. Looking for an independent **client-security** review
> before adding transactions. Small typed pnpm monorepo, pure unit-tested security
> logic, full CI, A+ headers, CodeQL clean. Full package + reproduction:
> `docs/reviews/AUDIT_PACKAGE_v0.5.4.md`. Repo:
> https://github.com/Reprisal369/OMIKAMI-WALLET (tag `v0.5.5`). Would you be open
> to a short review? — Reprisal

---

*Prepared for external review. No product code was changed to assemble this
package; it documents the tree at tag `v0.5.5` (`213cc04`).*
