# OMIKAMI WALLET — Internal pre-audit findings (v0.5.0)

Self-assessment performed before commissioning the external review, reviewing the
high-risk files as an external application-security auditor would. Read-only,
Sepolia-only build. Audited commit baseline: `760c88f8…` (product code unchanged
since; this document adds no product code).

**Headline:** no Critical or High findings. The read-only guarantee holds — there
is no reachable path to sign, send, or move funds. Findings are one Medium
(defense-in-depth gap) and several Low/Informational items that would make the
external audit cleaner. **None of them block the external audit.**

## Remediation status (applied in v0.5.1)

The recommended hardening was implemented on top of the 0.5.0 audit candidate.
No new features or architectural changes; the wallet remains strictly read-only.

| Item | Status | What changed |
|---|---|---|
| **M1** | ✅ Fixed | `scripts/check-forbidden-terms.mjs` now fails the build on any wallet write/sign/switch API (`useSendTransaction`, `useWriteContract`, `useSignMessage`, `writeContract`, `sendTransaction`, `switchChain`, …). Verified the gate catches a probe. |
| **L1** | ✅ Fixed | `ConnectPanel` `useBalance` gated by `isSupportedChain(account.chainId)` — no balance read / no error on unsupported networks. |
| **L4** | ✅ Fixed | `sanitizeTokenText` now strips Unicode bidi/format & zero-width controls (U+200B–200F, 202A–202E, 2066–2069, FEFF); new unit test added. |
| **L3** | ✅ Doc | DNS-rebinding limitation documented in `rpc.ts` (CSP is the runtime control). |
| **L5** | ✅ Doc | Custom-RPC/CSP UX footgun noted in `SECURITY_HEADERS.md`. |
| **I3** | ✅ Doc | Stale "no transport" note in `PROJECT_STATE.md` corrected. |
| **L2** | ↔ Accepted | ENS-on-mainnet is a deliberate, documented design choice; not changed pre-audit. |
| **I2** | ↔ Deferred | Address book is a new feature; not added pre-audit. |

Post-remediation verification (clean build): lint · typecheck (all + e2e) · unit
**86** · forbidden-pattern (M1 active) · secrets · build · csp · bundle 37/0/0 ·
audit 0 — all green. Reviewers should review at tag **`v0.5.1`**.

Severity key — Risk / Impact / Location / Fix / Blocks external audit?

---

## Critical

None.

## High

None.

## Medium

### M1 — No automated gate enforces the read-only invariant against wallet *write* hooks
- **Risk:** The project's central guarantee (read-only) is enforced today by
  (a) the absence of write code, (b) e2e test 15 (no send/sign buttons), and
  (c) the `transactionsEnabled` gate. But **no gate fails the build** if a future
  contributor adds `useSendTransaction` / `useWriteContract` / `useSignMessage` /
  `useSignTypedData` / `useSwitchChain` or the corresponding viem actions.
- **Impact:** A future PR could silently introduce a signing/write path; CI would
  stay green (the e2e button-name check only catches rendered buttons, not
  programmatic calls). This is a defense-in-depth gap around the one guarantee the
  whole product rests on.
- **Location:** `scripts/check-forbidden-terms.mjs` (RULES list) and the ESLint
  flat config — neither lists wallet-write APIs. Confirmed no such usage exists in
  `apps/web/src` / `packages/*/src` today.
- **Fix:** Add a forbidden-pattern rule (and/or ESLint `no-restricted-syntax` /
  `no-restricted-imports`) banning `useSendTransaction|useWriteContract|
  useContractWrite|useSignMessage|useSignTypedData|useSwitchChain|writeContract|
  sendTransaction|signMessage|signTypedData|switchChain|prepareTransactionRequest`
  in source. This turns the read-only invariant into a failing gate, not just a
  convention. (Hardening, not a feature.)
- **Blocks external audit?** No — but fixing it before the audit strengthens the
  central claim and is low-effort.

## Low

### L1 — Balance / ENS reads are not gated to the supported chain
- **Risk:** In `ConnectPanel`, `useBalance` is enabled whenever an address exists,
  regardless of chain; `useEnsName` is pinned to mainnet and enabled the same way.
  On an unsupported network (e.g. mainnet) the app still attempts a native-balance
  read, which then surfaces a "Could not read the balance… Retry" error next to
  the wrong-network warning.
- **Impact:** (1) A confusing error state on a network the UI otherwise calls
  "unsupported"; (2) a marginal extra egress of the user's address to the mainnet
  RPC (already sent for ENS — see L2). Fails safe (no fabricated data), but the
  UX/logic is inconsistent with the "Sepolia-only" framing.
- **Location:** `apps/web/src/components/ConnectPanel.tsx` L63–66 (`useBalance`)
  and L69–72 (`useEnsName`, `chainId: 1`).
- **Fix:** Gate the balance query with `enabled: Boolean(account.address) &&
  isSupportedChain(account.chainId)` so unsupported chains defer cleanly to the
  wrong-network state; optionally treat ENS the same (see L2).
- **Blocks external audit?** No.

### L2 — ENS resolution always queries a mainnet third-party RPC, even on testnet
- **Risk:** `useEnsName({ chainId: 1 })` sends the connected address to
  `eth.merkle.io` (mainnet default RPC) on every connect, including when the user
  is only using Sepolia.
- **Impact:** A privacy leak of the user's address to a third-party mainnet RPC
  for a testnet-only session. It is disclosed in `PRIVACY.md` §2, so this is a
  documented trade-off rather than a hidden leak — but a privacy-focused wallet
  could do better.
- **Location:** `apps/web/src/components/ConnectPanel.tsx` L69–72; egress host in
  `PRIVACY.md` §2 and the audit package §5.
- **Fix:** Consider making ENS resolution opt-in, or routing it through the same
  user-controlled RPC trust model, or disabling it by default with a clear toggle.
  At minimum keep `PRIVACY.md` prominent about it (currently correct).
- **Blocks external audit?** No.

### L3 — `validateRpcUrl` blocks literal private IPs but not hostnames that resolve to them
- **Risk:** `isInternalHost` rejects literal `localhost`/private/loopback/
  link-local/CGNAT IPs and IPv6 literals, but a public DNS name that resolves to a
  private address (DNS-rebinding) passes validation.
- **Impact:** Client-side only (the user's own browser fetching the user's own
  configured endpoint), so this is SSRF-lite, not server-side SSRF. On the
  deployed site the strict CSP `connect-src` (only the two default hosts) blocks
  any custom endpoint outright, neutralising this in production. It matters mainly
  for self-hosted/dev builds without that CSP.
- **Location:** `packages/security/src/rpc.ts` `isInternalHost` / `validateRpcUrl`.
- **Fix:** Document the DNS-rebinding limitation next to the function and in
  `SECURITY_HEADERS.md` (note that CSP is the real runtime control). Full
  mitigation isn't possible from a browser without resolving DNS.
- **Blocks external audit?** No.

### L4 — `sanitizeTokenText` does not strip Unicode bidi / format control characters
- **Risk:** The sanitizer removes control chars (<0x20, 0x7F) and `<`/`>`, but not
  bidirectional overrides (U+202A–U+202E, U+2066–U+2069) or zero-width characters,
  which can visually spoof an untrusted token name/symbol (e.g. reversed text).
- **Impact:** Visual spoofing of token names in the balances/activity panels.
  Mitigated because token identity is always the contract address and the UI
  explicitly warns "never trust a name or symbol." Rendered as plain text, so no
  script/HTML execution.
- **Location:** `packages/token-registry/src/index.ts` `sanitizeTokenText`.
- **Fix:** Also strip the bidi/format ranges above (and optionally zero-width
  U+200B–U+200D, U+FEFF). Add a unit test with an RTL-override sample.
- **Blocks external audit?** No.

### L5 — Custom-RPC feature is silently blocked by the production CSP
- **Risk:** Settings offers a custom Sepolia RPC, but the deployed strict CSP
  `connect-src` allows only the two default hosts, so a custom endpoint fails to
  connect on the live site (documented trade-off in `SECURITY_HEADERS.md`).
- **Impact:** A user who sets a custom endpoint on the live deployment sees fetch
  failures with no obvious cause, which could pressure someone into weakening the
  CSP. Feature/policy mismatch rather than a vulnerability.
- **Location:** `apps/web/src/components/SettingsPanel.tsx` + `scripts/generate-csp.mjs`
  (`connect-src`).
- **Fix:** On the strict-CSP deployment, either hide/disable the field or add an
  in-UI note that custom endpoints require a self-hosted build; or generate the
  CSP with the user's chosen host when one is configured (with a clear warning).
- **Blocks external audit?** No.

## Informational

- **I1 — Bundle allowlist is suffix/substring-based.** `scripts/check-bundle.mjs`
  matches host suffixes, so a subdomain of an allowlisted apex (e.g. any
  `*.github.com`, `*.example.com`) passes the gate. The real runtime control is
  the CSP `connect-src`; the bundle gate is a heuristic tripwire. Consider exact
  host matching where feasible.
- **I2 — Poisoning detection uses a small known-set.** `isLookalikeAddress` in the
  send-preview compares the recipient only against the user's own address + the
  registry contract addresses. A user address book would materially strengthen it
  (already on the roadmap).
- **I3 — Stale note.** `PROJECT_STATE.md` known-issue #4 ("balance reads fail by
  design — no transport — on an unsupported chain") is outdated: a mainnet
  transport IS configured now (`wagmi.ts`), which is why the mainnet read is
  attempted (see L1). Reconcile the note.
- **I4 — IPv6 public literals over-blocked.** `validateRpcUrl` rejects all
  bracketed IPv6 hosts, including public ones. Fails closed (safe), but worth a
  comment so it isn't mistaken for a bug.

## Positive security findings

- **Hard read-only gate.** `transactionsEnabled` is false on every chain,
  unit-tested, and escalates the SHIELD panel to a warning if ever true.
- **No write path.** Only read hooks are used; `connectors: [injected()]`,
  `storage: null`, `reconnectOnMount={false}`.
- **Single, self-validating storage module.** `rpc-storage.ts` is the only file
  touching `localStorage`, re-validates on read, and stores only a public URL.
- **Untrusted data discipline.** Token identity is always chainId + EIP-55
  address; names/symbols are sanitized plain text; unknown token contracts are
  quarantined and never called (THREAT_MODEL D3).
- **Strong client hardening.** Hash-based CSP with `default-src 'none'` and no
  `unsafe-inline` for scripts; full security-header set; SHA-pinned CI actions;
  branch protection with required checks; no analytics; sanitized error messages.
- **Pure, tested security core.** The security logic is side-effect-free and
  unit-tested (85 tests), keeping the attack surface small and reviewable.

## Recommended actions before the external audit

Optional but cheap, and all *hardening only* (no product features):

1. **M1** — add the read-only enforcement gate (highest value).
2. **L1** — gate balance reads to supported chains.
3. **L4** — strip bidi controls in `sanitizeTokenText` (+ a test).
4. **L3 / L5 / I3** — documentation touch-ups.

L2 and I2 are design decisions to discuss, not quick fixes. None of the above is a
blocker; the external review can proceed on the current build.
