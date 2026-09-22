# OMIKAMI WALLET — Phase 2 design & threat model: transactions

Status: **DESIGN ONLY.** This document specifies the future write/transaction
phase. **No code in this document is implemented, and nothing here relaxes the
current read-only build.** It exists so the external reviewer can assess the
*plan*, and so implementation later starts from an agreed, security-first design.

Phase 1 (read-only) is frozen; the current audit candidate is `v0.5.7`. Phase 2
does not begin until the preconditions in §2 are met.

---

## 1. Scope & staging

Phase 2 introduces the ability to *initiate* actions that the user's own wallet
then signs. It is delivered in **small, independently-gated stages**, testnet
first, mainnet last:

| Stage | Feature | Risk | Notes |
|---|---|---|---|
| 2.1 | Native + ERC-20 **send** (Sepolia) | Medium | Reuses the existing read-only send-*preview* logic; adds sign+broadcast. |
| 2.2 | ERC-20 **approve** (exact amount) + **revoke** (set to 0) | High | Revoke builds directly on the existing allowance dashboard. |
| 2.3 | **Permit / Permit2** (signature approvals) | High | Off-chain signatures that authorize spending — phishing-sensitive. |
| 2.4 | **Swaps** via a single audited aggregator | High | Slippage, MEV, router approvals. |
| 2.5 | **Mainnet** enablement | Critical | Only after MAINNET_CHECKLIST.md gates pass. |
| Later | **Bridges**, staking | Critical | Highest blast radius; deferred, separate review each. |

The wallet remains **non-custodial** throughout: it never holds keys, never
auto-signs, and every signature happens inside the user's own wallet.

## 2. Preconditions to lift read-only (hard gates)

`transactionsEnabled` must NOT flip for any chain until ALL of these hold:

1. External security review of the **read-only** build (v0.5.x) completed and its
   findings resolved.
2. This Phase 2 design reviewed and signed off (ideally by the same external
   reviewer).
3. A Phase-2-specific threat model (see §6) accepted.
4. The relevant `MAINNET_CHECKLIST.md` gates green for the target network
   (mainnet stays gated even after testnet transactions ship).
5. The read-only enforcement gate (M1) converted to a **scoped allowlist** (§5),
   not simply removed.

Testnet transaction stages (2.1–2.4 on Sepolia) require 1–3 and 5. Mainnet (2.5)
additionally requires 4.

## 3. Guiding principles

- **Review before sign, always.** Every transaction shows a human-readable,
  decoded preview (recipient, asset, amount, spender, calldata summary) BEFORE
  the wallet is asked to sign. No blind signing paths.
- **Least privilege by default.** Approvals default to the **exact amount**
  needed; "unlimited" is never the default and always carries a prominent
  warning.
- **No automation the user didn't ask for.** No auto-approve, no auto-switch
  network, no batched surprises. One intent → one clearly described action.
- **Simulate, then trust the wallet.** Show a best-effort simulation of balance
  changes, but the user's wallet is the final authority; if simulation and wallet
  disagree, tell the user to trust the wallet and reject.
- **Fail safe.** Any uncertainty (unknown contract, failed simulation, wrong
  network, decode failure) blocks or downgrades to a loud warning — never a quiet
  proceed.

## 4. Per-feature design

### 4.1 Native / ERC-20 send (Stage 2.1)
- Reuse `buildSendPreview` (already shipped, read-only) for validation: EIP-55
  recipient, zero-address burn, token-contract recipient, self-send, over-balance,
  decimals, poisoning lookalike.
- Add: **simulation** (§4.6) → **sign** (wallet `eth_sendTransaction`) →
  **broadcast** → **track** (pending/confirmed/failed) with an explorer link.
- Gas: show the wallet-estimated fee; never hide it. Never auto-bump gas.

### 4.2 Approve (exact) + Revoke (Stage 2.2)
- **Approve:** default `amount = exact need`. Show spender (with verification
  source if known), token, amount, and an **unlimited-allowance warning** if the
  user overrides to max. Verify the spender against a reviewed registry; unknown
  spenders get a loud "unverified spender" warning.
- **Revoke:** `approve(spender, 0)`. Wire directly into the existing **allowance
  dashboard** — each active allowance gets a "Revoke" action that constructs the
  zero-approval, previews it, and hands it to the wallet. This is the single
  highest-value user-protection feature in Phase 2.

### 4.3 Permit / Permit2 (Stage 2.3)
- Signature-based approvals (EIP-2612, Permit2) authorize spending via an
  **off-chain signature** — a favourite phishing vector because there's no gas
  and users under-estimate the power granted.
- Requirements: decode and display the FULL permit (token, spender, amount,
  deadline, nonce) in human terms; hard-warn on unlimited or far-future deadline;
  never request a permit the user did not explicitly initiate; show exactly which
  spender gains power. Consider disabling this stage by default.

### 4.4 Swaps (Stage 2.4)
- Route only through a **single, audited aggregator** with a pinned, reviewed
  integration. Show: input/output tokens, quote, **slippage** limit (user-set,
  sane default), price impact, minimum received, the router approval required,
  and MEV/′sandwich′ risk notes. No custom arbitrary-router calls.

### 4.5 Mainnet (Stage 2.5)
- Gated entirely by `MAINNET_CHECKLIST.md`. Everything that shipped on testnet is
  re-reviewed for mainnet blast radius before `transactionsEnabled` flips for
  chain 1.

### 4.6 Transaction simulation
- Best-effort pre-sign simulation via `eth_call` / provider trace, or a reviewed
  third-party simulation service (adds a new outbound host — must be added to the
  CSP `connect-src`, the bundle allowlist, and PRIVACY.md, and disclosed).
- Show projected balance/allowance changes. **Limitation to display:** simulation
  can differ from on-chain reality (state changes, reentrancy, block position);
  it is an aid, not a guarantee. On simulation failure → warn + let the wallet be
  the authority.

### 4.7 The transaction request is the single source of truth (P3 enforcement)

The strongest write-phase guarantee is that **what the user sees is exactly what
the wallet signs**. To make parameter-tampering (P3) *structurally* impossible
rather than merely tested:

- A transaction intent is built **once** into a single immutable request object
  (`to`, `value`, `data`, `chainId`, plus the decoded `functionName` + `args`
  where relevant). That one object is the sole input to BOTH (a) the
  human-readable preview and (b) the wallet request — neither is re-encoded or
  re-derived on a separate path.
- The preview is produced by **decoding the request's own `data`** (not by
  re-formatting the pre-encode inputs), so an encode-vs-display mismatch is not
  representable.
- Immediately before hand-off, a self-check **re-decodes** the outgoing request
  and asserts it equals the previewed values; any divergence is a hard block
  (fail safe). This equality is covered by unit tests (§7, P3).
- The request object is never mutated after preview. "Edit" means constructing a
  new object and previewing again from scratch — there is no in-place patch path.

## 5. Architecture & how the read-only gate evolves

- The single write extension point is `apps/web/src/lib/wagmi.ts` (`connectors`,
  and the wallet-client actions). Today only `injected()` and read paths exist.
- `transactionsEnabled` (in `@omikami/chain-config`) stays the master switch,
  per chain, defaulting false.
- **M1 gate evolution (critical):** the current forbidden-pattern gate bans all
  wallet write/sign/switch APIs. Phase 2 does NOT delete that gate — it converts
  it to a **scoped allowlist**: write APIs are permitted ONLY inside a dedicated,
  reviewed `packages/tx` (or `apps/web/src/lib/tx/`) module, and remain forbidden
  everywhere else. This keeps the write surface tiny, centralized, and auditable,
  and preserves a failing build gate against accidental write code leaking into
  the UI or read-only packages.
- New pure logic (transaction building, decoding, simulation summarizing) lives
  in pure, unit-tested modules mirroring the current `packages/security` style.

## 6. Phase 2 threat model (additions to THREAT_MODEL.md)

New attack surface introduced by initiating transactions:

| ID | Threat | Prevent / detect / recover |
|---|---|---|
| P1 | **Approval phishing / unlimited approve** | Exact-amount default; loud unlimited warning; spender verification; one-click revoke; permit deadline/amount surfaced. |
| P2 | **Blind signing** (opaque calldata) | Full human-readable decode before sign; block if decode fails; no raw-hex "just sign it" path. |
| P3 | **Parameter tampering** (UI shows X, tx signs Y) | The exact bytes shown are the exact bytes handed to the wallet; simulation cross-check; reproducible construction; unit tests asserting shown==signed. |
| P4 | **Recipient/spender poisoning** | Reuse `isLookalikeAddress` + EIP-55 emphasis; warn on lookalikes and unknown addresses. |
| P5 | **Wrong network / replay** | Explicit chainId in every tx; block if wallet chain ≠ intended; never auto-switch. |
| P6 | **Simulation spoofing / mismatch** | Simulation is advisory; wallet is authority; warn on failure or divergence. |
| P7 | **Malicious/compromised RPC returning false quotes/sims** | Trust warnings; prefer user-controlled endpoints; never move funds based solely on RPC-reported state. |
| P8 | **MEV / sandwiching (swaps)** | Slippage limits, price-impact warnings, minimum-received display. |
| P9 | **Gas griefing / stuck tx** | Show wallet-estimated fee; clear pending/failed states; no silent re-broadcast. |
| P10 | **Permit2 / signature replay** | Decode nonce + deadline; warn on long deadlines; scope to the exact spender/amount. |

## 7. Enforcement, testing & rollout

- **Gates:** scoped M1 allowlist (§5); a new gate asserting no write API outside
  the `tx` module; forbidden "unlimited approval as default" pattern.
- **Tests:** unit tests that the constructed tx equals what the UI displayed
  (P3); e2e tests that (a) nothing signs without an explicit user action, (b) the
  unlimited-approval warning appears, (c) revoke constructs `approve(_, 0)`, (d)
  wrong-network blocks signing. Keep a read-only e2e project running against a
  build with `transactionsEnabled=false` to prove the gate still holds.
- **Rollout:** feature-flag each stage; Sepolia first; a small closed test group;
  then mainnet only behind `MAINNET_CHECKLIST.md`. Each stage cut as its own
  release with its own review.

## 8. Non-goals for the first transaction release (2.1)

No permit, no swaps, no bridges, no staking, no mainnet, no batching, no
account-abstraction/paymaster flows, no custom arbitrary-contract calls. The
first write release is deliberately just **send** (+ the read-only-derived
safety checks) so the new signing surface is as small as possible for its first
external review.

## 9. Transaction lifecycle (state machine)

Each transaction moves through explicit states; every failure transition is
**safe** (block or loud warning, never a silent proceed):

```
idle
  → building              (construct the single request object, §4.7)
  → previewing            (decode + SHIELD checks + wrong-network check)
  → simulating            (best-effort, §4.6; failure → warn, not hard-block)
  → awaiting-signature    (hand the exact request to the wallet)
  → pending               (broadcast; poll the receipt)
  → confirmed | failed | replaced | dropped
```

- **building → previewing:** if the calldata will not decode, or the wallet is on
  the wrong network, execution stops here — a signature is never even requested.
- **awaiting-signature** is the ONLY state that touches a wallet write API, and
  only from the reviewed `tx` module (§5). User rejection returns cleanly to
  `idle` with nothing signed.
- **pending → replaced/dropped** is read from the wallet/RPC and surfaced plainly;
  the app **never** silently re-broadcasts or bumps gas (P9). Nonce management is
  the wallet's job — the app does not track, choose, or reuse nonces.
- State is derived, not persisted across reloads: a refresh mid-flight returns to
  `idle` with nothing signed, mirroring the read-only "no stored session" promise.

## 10. Transaction error taxonomy (safe messages)

Mirrors the read-only error hygiene (`classifyConnectError`): raw provider
payloads are never shown; each failure maps to a fixed, non-leaking message and a
recommended action.

| Kind | Trigger (examples) | User-facing action |
|---|---|---|
| `user-rejected` | EIP-1193 `4001` | "You rejected it in your wallet. Nothing was signed or sent." |
| `insufficient-funds` | balance < value + fee | "Not enough funds to cover the amount plus the network fee." |
| `gas-estimation-failed` | estimate reverts | "This transaction would fail on-chain, so it was not sent. Check the recipient/contract." (block) |
| `wrong-network` | wallet chain ≠ intended | "Your wallet is on the wrong network. Switch it yourself — this app never switches for you." (block) |
| `nonce/replacement` | nonce too low / already known | "This looks like a duplicate or replacement. Check your wallet's activity before retrying." |
| `decode-failed` | calldata won't decode | "Could not read this transaction safely, so it was blocked." (block — no blind signing, P2) |
| `broadcast-failed` | RPC rejects the raw tx | "The network did not accept the transaction. Nothing was charged. Try again." |
| `unknown` | anything else | "The transaction failed. No funds move from a failed transaction. Try again, or check your wallet." |

## 11. Open design questions (for the reviewer)

Deliberately-unsettled decisions we want challenged before implementing — the
goal of Phase 2 sign-off is to close these *with* the reviewer, not to present
them as decided:

1. **Permit2 at all?** It is powerful and phishing-prone (§4.3). Option: ship
   send + approve/revoke only and defer Permit2 indefinitely absent a concrete
   user need.
2. **Swaps (§4.4):** integrate a single pinned, audited aggregator in-house, or
   link out to a reviewed external dApp and not add a router surface here at all?
3. **Simulation (§4.6):** local `eth_call` only (no new egress) vs a third-party
   simulation host (a new `connect-src` / bundle-allowlist / PRIVACY entry). Lean
   local-only for the first release.
4. **Fee display:** show the wallet's own estimate only, or add an independent
   EIP-1559 estimate? Prefer the wallet's, to avoid a second source of truth.
5. **Connector scope:** injected-only for 2.1, or also WalletConnect / hardware
   wallets? Injected-only keeps the first signing surface smallest.
6. **Batching / account abstraction / paymasters:** out of scope for 2.x here —
   is that the right call for the intended users?

---

*This design keeps Phase 1's promise intact: until every precondition in §2 is
met, OMIKAMI WALLET holds no keys, signs nothing, and remains read-only.*
