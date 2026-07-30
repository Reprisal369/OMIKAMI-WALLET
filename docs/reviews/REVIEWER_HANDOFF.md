# OMIKAMI WALLET — Reviewer handoff

Everything needed to hand this release to an external security reviewer. This is
the "send this" page; the depth lives in `SECURITY_AUDIT_SCOPE.md` and
`docs/reviews/AUDIT_PACKAGE_v0.5.0.md`.

## What to send the reviewer

1. Repository: `https://github.com/Reprisal369/OMIKAMI-WALLET` (public, MIT).
2. Release / tag: **`v0.5.1`** (read-only audit candidate, after internal
   pre-audit hardening).
3. Audited product-code commit: `c32d255` (tag `v0.5.1`).
4. Live preview: `https://omikami-wallet.pages.dev` (read-only, Sepolia testnet).
5. These docs: `SECURITY_AUDIT_SCOPE.md`, `docs/reviews/AUDIT_PACKAGE_v0.5.0.md`,
   `docs/reviews/EXTERNAL_AUDIT_PREP.md`, and the internal pre-audit report
   `docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md` (findings + remediation applied in
   v0.5.1).

No credentials, secrets, or test accounts are provided or needed — the reviewer
uses their own injected wallet on Sepolia (the app never receives keys).

## Ready-to-send outreach message

> **Subject:** Security review request — OMIKAMI WALLET (read-only, testnet)
>
> Hi [name],
>
> I'm looking for an independent security review of a small, open-source project
> before it grows further. OMIKAMI WALLET is a **non-custodial, read-only**
> Ethereum wallet & DeFi dashboard, currently on the Sepolia **testnet**. It
> reads balances, tokens, activity, and allowances, and shows a transfer
> *preview* — it holds no keys, signs nothing, and has no transaction, approval,
> swap, bridge, staking, or mainnet functionality yet. That comes only after this
> review.
>
> The codebase is small (a pnpm monorepo; the security-critical logic is a set of
> pure, unit-tested functions), fully typed, and every check runs in CI. I've
> prepared a complete audit package so you can start immediately.
>
> - Repo: https://github.com/Reprisal369/OMIKAMI-WALLET
> - Release/tag to review: `v0.5.1`
> - Live preview: https://omikami-wallet.pages.dev
> - Scope + evidence: `SECURITY_AUDIT_SCOPE.md` and
>   `docs/reviews/AUDIT_PACKAGE_v0.5.0.md` in the repo
>
> The core question I'd like answered: **does the read-only invariant truly
> hold** — is there any reachable path that could sign or move funds? Beyond that,
> anything on input handling (address poisoning, RPC-URL validation), untrusted
> on-chain data rendering, supply chain, and the CSP/headers is very welcome.
>
> Could you share your availability, approach, and a rough quote? Happy to hop on
> a call.
>
> Thanks,
> [your name]

## What we ask the reviewer to deliver

- Findings by severity (critical / high / medium / low / info), each with
  file + line references and reproduction steps.
- An explicit statement on whether the **read-only invariant** holds.
- A go / no-go recommendation for beginning the transaction phase.

## Engagement notes

- **Read-only, testnet-only.** Nothing the reviewer does can move real funds.
- **Reproduction** and a manual Sepolia test procedure are in
  `docs/reviews/AUDIT_PACKAGE_v0.5.0.md` (§10–11).
- **Highest-risk files** to focus on are listed there (§13) — start with
  `apps/web/src/lib/wagmi.ts`, `packages/chain-config`, `packages/security/src/rpc.ts`.
- **Point of contact / responsible disclosure:** see `SECURITY.md`.
- Suggested scope size: a focused few-day review; the code surface is small by
  design.

## How to choose a reviewer (if you don't have one yet)

Look for demonstrable experience with **web3 front-ends / dApp client security**
(not only smart-contract auditing — there are no first-party contracts here) and
general application security (CSP, supply chain, input handling). Reasonable
routes:

- Independent application-security researchers with wallet/dApp track records.
- Boutique app-sec firms that list web3 front-end work.
- A scoped engagement via a reputable bug-bounty / audit marketplace.

Ask any candidate for prior public reports, references, and whether they cover
**client-side** app security specifically. Verify independence (not a contributor
to this repo).

## After the review

1. Triage findings; fix criticals/highs via the normal PR + CI flow.
2. Re-run the full suite; cut a new tag (e.g. `v0.5.1`).
3. Only then revisit the roadmap's transaction phase — behind its own threat
   model and, if it introduces contracts, a separate smart-contract audit.
