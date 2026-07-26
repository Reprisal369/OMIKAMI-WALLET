# OMIKAMI WALLET — PROJECT_STATE.md

Last updated: 2026-07-26 (session 9: LIVE on Cloudflare Pages + read-only verified live; favicon)

## Session 9 — FIRST LIVE DEPLOYMENT (2026-07-26)

Roadmap step 5 (GitHub CI + branch protection) and step 6 (hosting + CSP) are DONE and owner-verified.

GitHub (owner did the clicks, guided): repo live at github.com/Reprisal369/OMIKAMI-WALLET (public, MIT), tag v0.5.0 pushed, CI green on push (verify/e2e/sbom-and-hash/osv-scan/secret-scan), branch protection ruleset `protect-main` ACTIVE (require PR w/ 0 approvals, require those 5 status checks + up-to-date, block force pushes, restrict deletions). Dependency graph + Dependabot alerts enabled (fixed the dependency-review check). Owner completed their first full PR (chore: stop tracking test-results/, added to .gitignore) end-to-end.

Cloudflare Pages (owner did the clicks, guided): live at **https://omikami-wallet.pages.dev**, Git-connected auto-build from `main`. Build config: command `pnpm install --frozen-lockfile && pnpm --filter @omikami/web build && pnpm csp`, output `apps/web/out`, `NODE_VERSION=22`, root `/`. Cloudflare applies the generated `_headers` (CSP etc.) automatically.

READ-ONLY VERIFIED ON THE LIVE BUILD (2026-07-26):
- Source: only read hooks (useAccount/useBalance/useReadContract(s)/usePublicClient/useBlockNumber/useEnsName/useConnect/useDisconnect); NO useSendTransaction/useWriteContract/useSignMessage/useSwitchChain or `.sendTransaction/.writeContract/.signMessage` anywhere. `transactionsEnabled` false everywhere (unit-tested). forbidden-gate 0, secret-gate 0.
- Bundle honesty note: the built JS contains viem library strings `eth_sendRawTransaction`, `wallet_switchEthereumChain`, `wallet_addEthereumChain` — these are library internals with NO reachable path in our app; reachability is what's controlled (runtime invariant + e2e test 15), not string absence.
- Header nav "Send/Receive/Swap" etc. are disabled `<span aria-disabled>` labels ("Available in a later phase"), not links/buttons — inert.
- Live browser verification (owner, MetaMask): connect on Sepolia → checksummed address, 0.05 SepoliaETH, USDC 20 (verified), activity empty state, SHIELD all-OK. Console: only wallet-extension noise + a favicon 404 (now fixed) — NO CSP violations. Network: only same-origin + `11155111.rpc.thirdweb.com` (+ `eth.merkle.io` for ENS) — no unexpected hosts. Response headers confirmed live: full `Content-Security-Policy` (with script hashes), `Referrer-Policy: no-referrer`, and the rest from `_headers`. Wrong-network test: switched MetaMask to mainnet (chain 1) → orange wrong-network warning + SHIELD Network=Warning, balance read fails gracefully (no fake data), NO auto-switch. All correct.

This session's code change: added `apps/web/src/app/icon.svg` (gold ring on charcoal) → Next emits `<link rel="icon" type="image/svg+xml">`; fixes the `/favicon.ico` 404. Shipped via PR (branch protection now requires PRs).

Roadmap now: 1–4 ✅ · 5 GitHub CI+protection ✅ · 6 hosting+CSP ✅ (live, verified) · 7 👉 external audit (EXTERNAL_AUDIT_PREP.md ready) · 8 transactions (gated behind 7 + full threat-model sign-off). Still strictly read-only, testnet-only; the pages.dev URL is a preview, not an announced public launch.

## Session 8 — PRODUCTION-READINESS PREP (2026-07-25)

## Session 8 — PRODUCTION-READINESS PREP (2026-07-25)

Owner's steer: stop adding read-only screens; make the dev workflow production-ready. Also start keeping a changelog + version numbers. No new wallet features this session. All in-my-power items done; the owner-side items (create GitHub repo, choose host) are prepared.

**Versioning + changelog.** Added `CHANGELOG.md` (Keep a Changelog + SemVer). Product version set to **v0.5.0** in root `package.json` and `apps/web/package.json` (internal packages stay at their own versions). History: 0.1.0 shell · 0.2.0 portfolio · 0.3.0 activity+quarantine · 0.3.1 security/build foundation · 0.4.0 transfer preview · 0.5.0 allowance dashboard (current). NOTE: I recorded transfer preview as its own release (0.4.0), so allowance is 0.5.0 — differs from the owner's illustrative mapping (which put allowance at 0.4.0) but matches what was actually built.

**CI SHA-pinning + activation.** Rewrote `.github/workflows/ci.yml`: every action pinned to a FULL COMMIT SHA (resolved authoritatively via `git ls-remote` on 2026-07-25), each with a version comment. Pins: checkout v6.1.0 `d23441a…`, setup-node v6.5.0 `2499707…`, upload-artifact v5.0.0 `330a01c…`, dependency-review v4.9.0 `2031cfc…`, osv-scanner-action v2.3.8 `9a49870…` (subpath `osv-scanner-action` confirmed to exist), gitleaks v2.3.9 `ff98106…`. Added least-privilege `permissions`, `concurrency` cancel-in-progress, and a real **e2e job** (installs Chromium, runs all 38 Playwright tests, uploads report). YAML validated; 14 pinned `uses`, all 40-hex + version comment.

**CSP / security headers (Gate 7 tooling).** The static export ships 12 inline hydration scripts, so `script-src 'self'` alone would break it. Added `scripts/generate-csp.mjs` (`pnpm csp`): hashes every inline `<script>` (SHA-256) and writes `apps/web/out/_headers` (Cloudflare/Netlify format) with a strict CSP (`default-src 'none'`, hash-based `script-src`, `connect-src` limited to the two real RPC hosts — Sepolia `11155111.rpc.thirdweb.com` + mainnet-default `eth.merkle.io`, verified from viem chain defs) plus X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy/COOP/CORP/COEP/HSTS. CI `sbom-and-hash` job now runs `pnpm csp` after build so hashes match the shipped bytes. Docs: `SECURITY_HEADERS.md` (per-host variants + the custom-RPC↔strict-CSP trade-off), templates `deploy/netlify.toml` + `deploy/vercel.json`. `RELEASE_CHECKLIST.md` updated (Gate 7 step).

**External-audit prep.** `docs/reviews/EXTERNAL_AUDIT_PREP.md`: scope, in/out-of-scope, file-by-file review map, build/test/repro commands, known limitations, suggested reviewer deliverable.

**GitHub activation guide.** `GITHUB_SETUP.md`: git init/commit/tag v0.5.0, create+push repo, branch protection with required checks (verify/e2e/sbom-and-hash/osv-scan/secret-scan), Dependabot, fork-PR secret isolation, how to bump a pinned action safely.

ALL LOCAL GATES GREEN (2026-07-25): lint ✅ · typecheck all ✅ · unit 85/85 ✅ · forbidden ✅ · secrets ✅ · build ✅ · bundle 35 files/0 unknown hosts ✅ · audit 0 ✅ · e2e 38/38 (owner, this day). App code UNCHANGED this session — only versioning, CI, CSP tooling, and docs.

OWNER-SIDE NEXT (roadmap steps 5–7): create the GitHub repo + push (GITHUB_SETUP.md), watch CI go green, enable branch protection; pick a host and apply the generated `_headers`; commission the external review (EXTERNAL_AUDIT_PREP.md). Transactions remain gated behind all of the above.

## Session 7 — READ-ONLY ALLOWANCE DASHBOARD (2026-07-25)

## Session 7 — READ-ONLY ALLOWANCE DASHBOARD (2026-07-25)

Owner's chosen next step (before transactions, before CI/hosting): a read-only allowance overview. Full value to users, zero signing risk, and the foundation for later revoke. Roadmap now: ✅ shell · ✅ portfolio · ✅ Playwright · ✅ transfer preview · **✅ allowance dashboard** · 👉 GitHub CI · 👉 hosting+CSP · 👉 external audit · 👉 THEN transactions.

New pure module `packages/security/src/allowance.ts` (exported via index; 11 new unit tests → security 68 / total unit 85):
- `isUnlimitedAllowance(value)` / `UNLIMITED_THRESHOLD = 2^255` — flags MAX_UINT256 and half-max as effectively unlimited; large-but-finite (e.g. 2^96-1 Permit2-style) is NOT unlimited.
- `classifyAllowanceRisk({value, tokenVerified})` → `{status,label,unlimited}`: 0 → ok "No active allowance"; unlimited → blocked "Unlimited"; finite+unverified → warning; finite+verified → info "Limited". Never says "safe".
- `summarizeApprovals(approvals, user, registryAddresses)` — filters owner==user, dedupes (token,spender) keeping latest block, partitions registry tokens (→ pairs) vs unknown tokens (→ quarantined, address-only), sorts newest-first. Pure.

New component `apps/web/src/components/AllowanceDashboardPanel.tsx` (mounted after ActivityPanel):
- Discovers approvals from `Approval` event LOGS via eth_getLogs (owner=user, ~10,000-block lookback, 800 chunks, sequential + fault-tolerant) — NOT a contract call.
- Reads the LIVE `allowance(owner,spender)` ONLY for reviewed-registry tokens, via `client.multicall` (allowFailure). Unknown token contracts are QUARANTINED and never called (THREAT_MODEL D3 upheld).
- Per active allowance shows: token name, symbol, spender (emphasized + copy + explorer), current allowance (or "Unlimited (max)"), a red unlimited-allowance warning, a risk badge (StatusBadge + label), and the verification source (registry `evidence`). Quarantine block lists unknown token+spender by address with explorer links and a warning. States: not-connected / wrong-network / loading / error+retry / empty. No approve/revoke/permit/sign/send control anywhere — display only.

Read-only invariant kept: no new inputs (still 3 text inputs total), no forbidden-named buttons. NEW e2e test 21 (dashboard present, empty state on clean history, zero approve/revoke/sign controls). e2e now 19 cases × 2 = 38 runs.

ALL LOCAL GATES GREEN (2026-07-25): lint ✅ · typecheck all ✅ · typecheck:e2e ✅ · unit 85/85 ✅ · forbidden ✅ · secrets ✅ · build ✅ (panel confirmed in prerendered out/index.html) · bundle 34 files/0 unknown hosts ✅ · audit 0 ✅.
E2E BROWSER RUN: pending on owner (Chromium download blocked in sandbox). OWNER ACTION: `pnpm e2e` (expect 38/38).

Open items unchanged (owner's list): activate GitHub CI; pin Actions to commit SHAs; set CSP at hosting; external security review; smart-contract audit before any transaction feature. Still strictly read-only; nothing published.

## Session 6 — READ-ONLY TRANSFER PREVIEW (2026-07-25)

## Session 6 — READ-ONLY TRANSFER PREVIEW (2026-07-25)

Owner approved building the read-only "send preview" (the transaction-simulation step from the Gate 1 hardening list). Nothing here can sign or broadcast — `signingAvailable` is a literal `false` and no wagmi write path exists.

New pure module `packages/security/src/send-preview.ts` (exported via index; 20 new unit tests → security suite 57, total unit 74):
- `parseAmountInput(input, decimals)` — integer-only decimal parser, NO floating point. Rejects empty / non-numeric / signs / exponent / thousands-separators / too-many-decimals / zero; parses exact base units (float64-unsafe values survive exactly, asserted).
- `buildSendPreview(input)` — pure. Emits SHIELD `SecurityCheck[]` plus `wouldBlock` and `signingAvailable:false`. Checks: (1) signing gate — `ok` normally, `blocked` if `transactionsEnabled` ever true; (2) recipient — empty(info)/format(blocked)/checksum(blocked, EIP-55 mismatch)/zero-address burn(blocked)/token's-own-contract(blocked)/self-send(warning)/poisoning-lookalike(warning, via `isLookalikeAddress` vs known addresses)/ok; (3) amount — format/too-many-decimals(blocked)/zero(warning)/over-balance(blocked)/ok; (4) asset — unverified ERC-20(warning)/native or verified(ok). `wouldBlock` = any blocked OR invalid recipient/amount.

New component `apps/web/src/components/SendPreviewPanel.tsx` (mounted in page.tsx after ActivityPanel):
- Asset `<select>` (native SepoliaETH + registry tokens), recipient `<input type=text>`, amount `<input type=text inputMode=decimal>`. NO submit/send/sign button of any kind — deliberately button-free so it cannot act. Read-only banner (`role=note`) states nothing can be signed/broadcast.
- Live preview recomputes on every keystroke via the pure validator; shows normalized EIP-55 recipient (first/last emphasis), each SHIELD check with StatusBadge, and a green/red summary banner. Available balance pulled read-only (useBalance for native, useReadContract balanceOf for the selected token) to power the over-balance check. `knownAddresses` = user's own address + registry contracts (poisoning heuristic only, never an allowlist).

Read-only invariant kept: `transactionsEnabled:false` passed explicitly; e2e test 15 updated (now exactly THREE text inputs — 1 url settings + 2 text preview; still zero password/file/textarea and zero send/approve/permit/sign/swap/bridge/stake/deploy/import buttons). NEW e2e tests 19 (preview present, read-only, no send/sign control) and 20 (zero-address burn flagged, clears on a valid address).

DEPENDENCY AUDIT FINDING (fixed): fresh advisory GHSA-mh99-v99m-4gvg — brace-expansion DoS (high), reached ONLY via `eslint > minimatch > brace-expansion` (dev-only, NOT shipped in the static export). Added pnpm override `brace-expansion>=5.0.8`; `pnpm install` + `pnpm audit` → 0 vulnerabilities. Overrides now: postcss>=8.5.10, sharp>=0.35.0, brace-expansion>=5.0.8. Lockfile updated + synced to repo.

ALL LOCAL GATES GREEN in sandbox (2026-07-25): lint ✅ · typecheck all packages ✅ · typecheck:e2e ✅ · unit 74/74 ✅ · forbidden-pattern ✅ · secrets ✅ · production build ✅ (Transfer-preview panel confirmed in prerendered out/index.html) · bundle 34 files / 0 unknown hosts / 0 sourcemaps ✅ · audit 0 vulns ✅.
E2E BROWSER RUN (owner, 2026-07-25): 36 runs, first pass 32 passed / 4 failed — BOTH failures were test-only bugs, ZERO app bugs, now fixed:
- Test 17 (activity empty state) searched for "no token activity found" but the copy was reworded in session 4/5 to "No token **transfers** found in the last ~10,000 blocks"; the e2e text had never been re-run against the new copy. Regex updated to `/no token transfers found/i`.
- Test 20 (`/zero address/i`) matched TWO elements (check label + detail line) → Playwright strict-mode violation. Now targets the exact label `Recipient is the zero address`.
Both fixes are test-side only; typecheck:e2e green. OWNER ACTION: re-run `pnpm e2e` (expect 36/36).

Still read-only; NOT cleared for real transactions or mainnet. The preview is a review/education surface only.

## Session 2 additions (pre-phase-2 hardening, per owner's Gate 1 review)

Implemented and verified green this session (`pnpm verify` chains all of it):

1. `scripts/check-forbidden-terms.mjs` — fails on key-material APIs (privateKeyToAccount/mnemonicToAccount/HDKey/etc.), browser storage, dangerouslySetInnerHTML, textarea/password/file inputs, keystore references, eval/new Function. Addresses review items A1/A2/F2.
2. `scripts/check-secrets.mjs` — fails on 0x+64-hex values, PEM keys, common API-key shapes, and any non-example .env in the tree. CI additionally runs gitleaks.
3. `scripts/check-bundle.mjs` — post-build gate: fails on any real hostname in the production export outside the reviewed allowlist (mirrors PRIVACY.md inventory) and on sourcemaps in the export. Addresses A2/F5 and known-issue #7.
4. ESLint hardening — no-restricted-imports (`viem/accounts` banned), no-restricted-globals/properties (localStorage/sessionStorage/indexedDB banned), no-restricted-syntax (dangerouslySetInnerHTML banned), eval family banned.
5. Root `pnpm verify` = lint + typecheck + tests + forbidden-gate + secret-gate + build + bundle-gate + audit. All green on 2026-07-13.
6. `.github/workflows/ci.yml` — PREPARED, NOT ACTIVE (repo not on GitHub yet). Hard rule in file: pin every action to a full commit SHA before first activation; SHAs deliberately not guessed.
7. New documents: DEPENDENCY_POLICY.md, PRIVACY.md, INCIDENT_RESPONSE.md, RELEASE_CHECKLIST.md, CONTRIBUTING.md.

8. LICENSE: MIT chosen by owner (2026-07-13) — assumption A3 RESOLVED. Copyright line "OMIKAMI WALLET contributors" (owner may substitute legal name pre-publication).
9. Playwright e2e suite ADDED (owner's 15-case gate): playwright.config.ts (desktop 1280×800 + iPhone 13 projects, dev-server webServer) + tests/e2e/helpers.ts (mocked EIP-1193 provider — connect/reject/chain variants, NO key material; JSON-RPC interception for ok/timeout/malformed so no live RPC is used) + tests/e2e/shell.spec.ts covering: disconnected, connect button, user rejection, successful mock connection, checksummed address, Sepolia chain-ID display, wrong-network warning, balance render, RPC timeout state, malformed-RPC state, disconnect flow, refresh-without-storage, mobile+desktop layout/overflow, keyboard navigation, and the read-only invariant (zero textarea/input/password/file elements; zero send/approve/permit/sign/swap/bridge/stake/deploy/import buttons). `pnpm verify` now includes `typecheck:e2e`. @playwright/test 1.61.1 + @types/node 26.1.1 added as root devDependencies. CI e2e job added (inactive until GitHub + SHA-pinning).
   EXECUTION STATUS: **E2E GATE PASSED — 26/26 in 20.6s on the owner's Windows machine (2026-07-13, Chromium 149 via Playwright 1.61.1, desktop 1280×800 + Pixel 7 mobile).** Three iterations were needed; all findings and fixes:
   - iPhone descriptor requires WebKit (not installed) → mobile project switched to Pixel 7 (Chromium). 13 instant failures resolved.
   - Balance test: wagmi v3 fetches native balance via the Multicall3 contract (`eth_call`, selector 0x82ad56cb), NOT `eth_getBalance` — the RPC mock now answers aggregate3 with a correctly ABI-encoded single-result tuple (encoding verified numerically). Diagnostic `expect.poll` on observed RPC methods added and kept.
   - Test-side bugs fixed: read-only-invariant text regex matched only the disconnected wording; locator.evaluate string form returned nothing (real functions now); assertions scoped to `<main>` to exclude the Next dev overlay.
   FINDING VALUE: the failures exposed zero app bugs — all three roots were in test tooling/mocks. App behavior confirmed: balance renders, read-only invariant holds (zero inputs/tx buttons in <main>), no wallet-related browser storage after refresh.

Still NOT done (honest): repo is not under git/GitHub (CI therefore prepared-only); CSP headers still hosting-dependent (Gate 7); SBOM + OSV run in CI only once activated.

## Session 5 — SECURITY FOUNDATION + LIVE FIXES (2026-07-13)

Dev bugs found by owner during use, both RESOLVED:
- React "setState during render" warning (SecurityPanel/Hydrate): root cause = wagmi `reconnectOnMount` (default true) firing a reconnect during hydration while `storage: null` means there is nothing to reconnect. Fix: `reconnectOnMount={false}` in providers.tsx (correct + aligned with the no-stored-session promise). Verified lint/typecheck/build.
- Activity feed showed empty + a stale footer said "~20,000 blocks" while code looked back 5,000. Fixed: lookback→10,000, chunk 800, sequential+fault-tolerant fetch; footer number now DERIVED from the constant (`LOOKBACK_LABEL`) so UI can never disagree with code again; empty-state copy explains older transfers are on-chain (explorer / custom endpoint).

Security foundation added:
- `scripts/release-hash.mjs` — deterministic SHA-256 over apps/web/out + combined manifest hash → release-manifest.json. Lets anyone verify a PUBLISHED build is untampered (primary threat). FINDING: Next 16 Turbopack export does NOT honor `generateBuildId` (random static dir persists) so independent rebuilds are not yet byte-identical — documented as a Gate 8 (pre-mainnet) item in RELEASE_CHECKLIST; `generateBuildId` left in place (forward-compatible, reads OMIKAMI_BUILD_ID=git-sha in CI).
- `scripts/generate-sbom.mjs` — sbom.json from pnpm license data: 186 components, 143 MIT. Non-permissive licenses are all BUILD-TIME-ONLY, not shipped to users: @img/sharp-libvips LGPL-3.0, lightningcss MPL-2.0, caniuse-lite CC-BY-4.0. Recorded in RELEASE_CHECKLIST.
- CI: new `sbom-and-hash` job (SBOM + reproducible manifest, uploaded as artifact); still inactive until GitHub + SHA-pinning.
- DEPENDENCY AUDIT FINDING (fixed): new advisories flagged next 16.2.10 (10 vulns — all server-side: middleware/Server Actions/image-opt/rewrites, NONE applicable to our static export) and sharp. Bumped next→16.2.11 and added pnpm override sharp>=0.35.0. Audit now clean (0 vulnerabilities). package.json overrides: postcss>=8.5.10, sharp>=0.35.0.
- release-manifest.json + sbom.json gitignored (generated per build).

ALL GATES GREEN in sandbox (2026-07-13): lint ✅ · typecheck ✅ · e2e-typecheck ✅ · unit 54/54 ✅ · forbidden-pattern ✅ · secrets ✅ · build ✅ · bundle ✅ · audit 0 vulns ✅. e2e browser run: owner's last run was 32/32; not re-run after these changes (no test-affecting code changed — only providers reconnect flag + activity copy + build tooling; owner can re-run `pnpm e2e` to reconfirm).

## PHASE 2b COMPLETE + E2E PASSED (2026-07-13): 32/32 in 27.9s on owner's machine (desktop + mobile), incl. test 18 (RPC input validation). Phase 2 (read-only portfolio: balances, ENS, activity, quarantine, user-configurable RPC) is DONE.

## Session 4 — PHASE 2b part 2 IMPLEMENTED (2026-07-13): activity hardening + user-configurable RPC

Activity read hardened after owner saw a live "could not read activity" error (free endpoint limits eth_getLogs): lookback reduced 20k→5k blocks, chunk 10k→800, fetch now sequential newest-first and tolerant of per-range failures (one bad chunk no longer blanks the feed); only a total failure surfaces the degraded state, whose copy now reassures that balances are unaffected and points to the explorer.

USER-CONFIGURABLE RPC (the app's FIRST input field + FIRST opt-in browser storage):
- `packages/security/src/rpc.ts` — `validateRpcUrl`: https-only; rejects credentials, localhost/.local/.localhost, private/loopback/link-local/CGNAT IPv4, IPv6 literals, bare dotless hosts. 10 unit tests (security suite now 37 across 3 files; 49→ wait: security 37 + chain-config 7 + token-registry 10 = 54 total unit tests). Implements owner C-review items directly.
- THREAT_MODEL.md: added C1b (malicious user RPC — SSRF/privacy) and C1c (opt-in storage). Both list prevent/detect/recover/residual/test.
- `apps/web/src/lib/rpc-storage.ts` — the ONE module allowed to touch localStorage (single key `omikami.rpcUrl`, re-validated on read). Scoped, documented exceptions added to eslint (per-file override) and check-forbidden-terms (single-file allowlist). No other storage permitted; gates still block it everywhere else.
- `wagmi.ts` — `buildWagmiConfig()` uses the validated custom Sepolia endpoint when present, else viem default; mainnet always default. Rebuilt at load; change applies after reload.
- `SettingsPanel` — the only input (type=url), validate-before-save, "Saved, reload" notice, "Reset to default", and a clear warning that a custom endpoint sees IP+addresses and could lie.
- e2e: test 15 invariant updated (exactly ONE input, type=url; still zero password/file/textarea and zero tx buttons); tests 16/17 adjusted; NEW test 18 (rejects http/localhost + private IP, accepts public https, reset clears). Suite now 16 cases × 2 = 32 runs. Browser run pending.
- Bundle gate CAUGHT the RFC 2606 placeholder host in the input; allowlisted example.com/example.org with justification (placeholder only, never contacted). Second real catch by the gate.
- Gates green in sandbox: lint, typecheck (all + e2e), unit 54/54, forbidden-pattern, secrets, build, bundle. Owner actions: `pnpm e2e` (expect 32 passed); try a full-history Sepolia endpoint in Settings to see the activity feed populate.

## Session 4 — PHASE 2b part 1 IMPLEMENTED + E2E PASSED (2026-07-13): activity feed + quarantine
E2E GATE: 30/30 passed in 30.2s on owner's machine (desktop + mobile), including test 17 (activity panel + empty quarantine).

1. `packages/security/src/activity.ts` — pure `summarizeTransfers`: case-insensitive direction (in/out/self), user filtering, txHash+logIndex dedupe, newest-first sort, registry membership, quarantine aggregation (count + lastBlock). 6 new unit tests (security suite now 27).
2. `chain-config`: new `explorerTxUrl` helper + test (chain-config suite now 7).
3. `ActivityPanel` (read-only): recent ERC-20 Transfer logs involving the user via `eth_getLogs` directly from the chain (no indexer) — lookback ~20,000 blocks in ≤10k chunks, from/to queried separately, decoded with viem's canonical Transfer event. States: not-connected, wrong-network, loading, error+retry, empty. Items show direction, amount (registry decimals; unknown tokens show raw units + warning badge), counterparty, block, tx explorer link. QUARANTINE section lists unknown token contracts (count + explorer) with the hard rule stated in UI and code: unknown contracts are NEVER called by the app (D3). Honest limitation in the panel: native ETH transfers emit no logs — explorer link provided for full history.
4. e2e: mock answers `eth_getLogs` with []; new test 17 (activity renders, empty state, no quarantine, still zero inputs) → suite now 15 cases × 2 viewports = 30 runs. Browser run pending on owner machine.
5. Bundle gate CAUGHT two new hostnames (`ipfs.io`, `arweave.net`) — viem ENS-avatar gateway constants bundled via ENS name resolution. Reviewed: app renders no avatars, makes no runtime requests to them; allowlisted with in-file justification. First real catch by the gate — working as designed.
6. Gates green in sandbox: lint, typecheck (all + e2e), unit 49/49 (3 suites), forbidden-pattern, secrets, build, bundle (34 files). Owner actions pending: reload app (activity panel should show the two faucet USDC receipts as "Received"), run `pnpm e2e` (expect 30 passed).
7. Still pending in 2b: user-configurable RPC endpoints (first input field — requires THREAT_MODEL amendment + gate/test updates, planned as its own careful unit).

## PHASE 2a SIGNED OFF (2026-07-13): e2e 28/28 passed in 19.7s on owner's machine (desktop + mobile), including test 16 (verified USDC panel). Combined with the live 20-USDC faucet test and the double-sourced registry entry, phase 2a is COMPLETE.

## Session 3 — PHASE 2a IMPLEMENTED (2026-07-13): token balances + ENS

1. Token registry: first entry added with recorded evidence — USDC on Ethereum Sepolia `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, 6 decimals, status `verified`. Source: Circle issuer documentation (developers.circle.com/stablecoins/usdc-contract-addresses, "Ethereum Sepolia" row, retrieved 2026-07-13), which links the same address on sepolia.etherscan.io. Schema now REQUIRES an `evidence` string on every entry; a unit test enforces Sepolia-only + evidence on all shipped entries. DOUBLE-SOURCED 2026-07-13: owner opened the Explorer link and confirmed sepolia.etherscan.io shows the contract with Token Tracker "ERC-20: USDC (USDC)" and verified source code (proxy). Sources: (1) Circle issuer docs, (2) Sepolia Etherscan, visually confirmed by owner. Additionally user-acceptance-tested live: owner requested 20 USDC from faucet.circle.com (Ethereum Sepolia) and the Token Balances panel displayed "20 USDC · Verified" from the real chain — notably BEFORE MetaMask itself showed the token (MetaMask requires manual import; our registry does not).
2. New utils in @omikami/token-registry (unit-tested, 10/10): `formatTokenAmount` (bigint-only, trailing-zero trim, explicit `≈` truncation instead of silent rounding) and `sanitizeTokenText` (strips control chars/angle brackets, caps length — THREAT_MODEL D3).
3. New `TokenBalancesPanel` (read-only): balances via wagmi `useReadContracts` + viem's canonical `erc20Abi`; Verified badge, short address + CopyButton (new in @omikami/ui), explorer link; explicit states for not-connected, wrong-network, loading, per-token read failure with retry; footer warns that token identity is the contract address, never the symbol.
4. ENS: `useEnsName` on mainnet (read-only) in ConnectPanel; row renders only when a name exists. PRIVACY.md item 2 updated accordingly.
5. e2e: RPC mock now answers Multicall3 `aggregate3` generically for N inner calls (N parsed from calldata); new test 16 (token panel shows verified USDC, still zero inputs in <main>) → suite is now 14 cases × 2 viewports = 28 runs. NOT yet executed in a browser this session — owner runs `pnpm e2e`.
6. Gates re-run green in sandbox: lint, typecheck (all + e2e), unit 42/42 total (3 suites), forbidden-pattern, secrets, build, bundle (33 files, 0 unknown hosts).
7. Deferred to next session (phase 2b): activity/history via eth_getLogs adapter, unknown-token quarantine section (requires discovery source), user-configurable RPC, LINK registry entry (Chainlink docs page fetch was truncated before the Ethereum Sepolia row — needs re-verification).

## PHASE ONE: FORMALLY APPROVED BY OWNER — 2026-07-13

Owner's final sign-off given on 2026-07-13 after: personal end-to-end acceptance testing, 26/26 e2e (owner's 15-case specification), review of the threat model (conditional 8/10 with hardening backlog), and full local gate suite (unit 32/32, lint, strict typecheck, forbidden-pattern/secret/bundle gates, audit clean, production build). Standing conditions from the owner's review remain binding: strictly read-only, Sepolia-only, no production publication before an independent code and deployment review. Phase two (read-only portfolio: ERC-20 balances, ENS, activity) is CLEARED TO START.
Rule: update this file after every completed task so future sessions can continue without context loss.

## EXACT CURRENT STATUS

Phase-one read-only shell is **implemented, passing all checks** (lint, strict typecheck, 32 unit tests, dependency audit, production static build) **and user-acceptance-tested end-to-end on the owner's Windows machine (2026-07-13)**: MetaMask connect, user rejection, wrong-network warning (mainnet), per-site network switch to Sepolia, live balance read (0.05 SepoliaETH from the Google Cloud faucet), copy address, explorer link, disconnect. Nothing is deployed. No transaction feature exists. Gate 1 (formal human review of planning docs) is still OPEN.

Local runtime on owner machine: Node 24.18.0 standalone zip at `%USERPROFILE%\Downloads\node-v24.18.0-win-x64` (added to PATH per session), pnpm via corepack, repo at `%USERPROFILE%\Downloads\omikami-wallet`.

## Completed work

1. Planning documents: PROJECT_PLAN.md, ARCHITECTURE.md, THREAT_MODEL.md, SECURITY.md, DECENTRALIZATION.md, MAINNET_CHECKLIST.md (all DRAFT, awaiting formal review).
2. pnpm workspace monorepo: apps/web + packages/{types, chain-config, security, token-registry, ui} + docs/adr.
3. Read-only shell (apps/web, Next.js 16 static export):
   - Injected-wallet connect/disconnect (EIP-1193 only: MetaMask, Rabby, Coinbase Wallet extension, compatible). No WalletConnect, no project ID.
   - States: disconnected, no-wallet-detected, connecting, user-rejected, timeout (30 s hint), connected, RPC error with retry.
   - Connected view: checksummed address with first/last emphasis + copy, network name + chain ID + testnet tag, native balance (loading/error/retry), connection source, explorer link (from viem chain data), disconnect.
   - Wrong-network warning (supported: Sepolia only); explicitly states we never auto-switch networks.
   - RPC status panel: Sepolia block-number probe, checking/connected/error, 30 s refresh, retry.
   - OMIKAMI SHIELD status panel from pure functions in packages/security.
   - Responsive dark/gold UI, keyboard-focus styles, no urgency styling.
4. Security primitives (packages/security, fully unit-tested): validateAddress (EIP-55), emphasizeAddress, isLookalikeAddress, classifyConnectError/connectFailureMessage (sanitized errors), buildSecurityStatus.
5. chain-config: Zod-validated registry; Sepolia enabled; mainnet named-but-disabled; `transactionsEnabled=false` everywhere, enforced by test.
6. token-registry: schema requiring EIP-55-equal addresses; VERIFIED_TOKENS ships empty (no invented addresses).
7. Checks run: `pnpm -r typecheck` ✅ · `pnpm exec eslint .` ✅ · `pnpm -r test` ✅ 32/32 · `pnpm audit` ✅ 0 vulnerabilities (after postcss override) · `pnpm --filter @omikami/web build` ✅ static export.
8. Next.js build telemetry disabled on the build machine (`next telemetry disable`).

## Architectural decisions

- Client-only static export (`output: 'export'`), IPFS-compatible; no server, no cookies, no user database. ADR-001..005 summarized in ARCHITECTURE.md §8.
- Workspace packages consumed as TS source via `transpilePackages`.
- Connector modularity: `apps/web/src/lib/wagmi.ts` `connectors: [injected()]` is the single extension point for WalletConnect later.
- RPC: viem built-in default endpoints only; none hardcoded here. User-configurable RPC = phase 2.
- ENS display deferred to phase 2 (removes the only mainnet read; per user's build-only list).
- ADR-006: TypeScript pinned 5.9.3 (typescript-eslint incompatible with TS 7.0.2).
- pnpm override: postcss >= 8.5.10 (fixes GHSA-qx2v-qp2m-jg93, moderate).

## Security decisions

- `storage: null` in wagmi config — zero persistence after tab close; opt-in persistence is a later feature.
- Transactions/approvals/signing: no code path exists; `transactionsEnabled` false everywhere + unit test + SHIELD panel escalates to warning if ever true.
- Errors sanitized via classifyConnectError; raw provider errors never rendered.
- pnpm 10 default: dependency postinstall scripts blocked (sharp build script intentionally NOT approved; not needed for static export).
- No analytics, no remote fonts/scripts. Build-time Next telemetry disabled.
- Empty verified-token list; no placeholder or invented addresses anywhere.

## Known issues / open risks (NOT complete)

0. RESOLVED (2026-07-13, same session): duplicate "Connect wallet" buttons + React hydration mismatch. Root cause: connector buttons rendered during prerender while EIP-6963 discovery only happens client-side. Fix in ConnectPanel.tsx: render buttons only after client detection completes, dedupe the generic `injected` fallback when discovered connectors exist, label buttons with `connector.name`. Verified: lint, typecheck, build, and manual retest (single "Connect MetaMask" button, no dev-overlay issue).
1. CSP not yet enforced: static export cannot emit HTTP headers; dev mode needs unsafe-eval. Must be applied at hosting layer + verified in Gate 7. OPEN.
2. Gate 1: THREAT_MODEL sections A/B/C/F CONDITIONALLY APPROVED by owner (2026-07-13) for strictly read-only phase one; full approval blocked on implementation verification (CI, headers, tests must exist and be inspected). Hardening backlog: docs/reviews/GATE1_THREAT_MODEL_REVIEW_2026-07-13.md. Honest status: CI pipeline, CSP headers, e2e tests, secret scanning, SBOM do NOT exist yet — all scans so far were manual, one-off. OPEN until implemented and verified.
3. wagmi `useConnect` timeout is a 30 s UI hint, not a hard abort — wallet popup may still resolve later. Acceptable for read-only phase; revisit before send flow.
4. If the connected wallet is on an unsupported chain, balance reads fail by design (no transport); UI shows the wrong-network warning. Intended.
5. Two undeletable empty `_tmp_*` files at repo root (artifacts of a failed pnpm run on the mounted filesystem; sandbox lacked delete permission). Safe to delete manually.
6. Playwright e2e, CONTRIBUTING.md, PRIVACY.md, INCIDENT_RESPONSE.md, DEPENDENCY_POLICY.md, RELEASE_CHECKLIST.md, LICENSE not yet authored (planned; see pending work).
7. viem bundles reference URLs (default RPCs, explorers, 4byte directory) — runtime requests are limited to the list in "External requests" below, but a bundle-level allowlist check should be added in CI (Gate 5 item).

## External requests made by the running app (complete inventory)

1. Sepolia RPC — viem's default public endpoint for chain 11155111: block-number probe (30 s interval) + native balance read. Sees user IP + queried address (documented limitation).
2. Mainnet RPC (viem default, chain 1) — only if the user's wallet is connected to mainnet and a balance is read.
3. User's injected wallet via EIP-1193 — local browser IPC, not a network request.
4. Block-explorer links — plain `<a>` links, only when the user clicks them.
Nothing else: no analytics, no fonts, no CDNs, no WalletConnect relay.

## Gate 1 review input (owner, 2026-07-13)

Owner reviewed the plan and raised three priorities plus one wording change (applied):

1. Hardware wallet support — Ledger and Trezor via MetaMask or WalletConnect. Status: covered by the connector architecture (hardware wallets sign through compatible wallet software; WalletConnect is the planned addition in `apps/web/src/lib/wagmi.ts`). Elevated to an explicit acceptance criterion for the WalletConnect milestone.
2. Transaction simulation before every signature — must show exactly: which contract, which token, how much, which allowance, which NFT, how much ETH leaves the wallet. Status: matches SHIELD phase 6 / send flow phase 3; the owner's itemized list is adopted as the acceptance checklist for the TxPreview component.
3. Open-source verification — reproducible builds, per-release hashes, security audit checklist, bug bounty. Status: matches Gates 8–11 and DECENTRALIZATION.md; no scope change needed.
4. THREAT_MODEL.md A1 "Prevent" wording sharpened per owner request: now explicitly excludes seed phrase, private key, keystore file, JSON wallet, and recovery-phrase import, and states credential import is impossible by design. APPLIED.

## Pending work (priority order)

1. Remaining Gate 1 sign-off: owner confirmation on licence choice (assumption A3) and formal "approved" on the six documents.
2. Author PRIVACY.md (request inventory above), DEPENDENCY_POLICY.md, CONTRIBUTING.md, INCIDENT_RESPONSE.md, RELEASE_CHECKLIST.md; choose LICENSE (assumption A3).
3. Playwright e2e for the shell states (mobile viewport, keyboard nav, wrong-chain, RPC-failure mocks).
4. CI pipeline: frozen-lockfile install, lint, typecheck, tests, audit, bundle endpoint scan, forbidden-term scan.
5. Phase 2 (after review): ERC-20 balance reads from a human-reviewed Sepolia token list, ENS display, activity via adapter interface, user-configurable RPC with custom-RPC labeling.

## How to run

```bash
pnpm install
pnpm --filter @omikami/web dev    # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm audit
```

## Environment note for future sessions

The Cowork sandbox mount cannot host pnpm's node_modules (EPERM on link/unlink). Work pattern: copy repo to `~/build/omikami-wallet` inside the sandbox, install/build/test there, then sync changed source files + pnpm-lock.yaml back to the mounted folder. Mount writes can lag a few seconds before the sandbox sees them.
