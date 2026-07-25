# OMIKAMI WALLET — RELEASE_CHECKLIST.md

Date: 2026-07-13 · Every release, no exceptions. Two people sign off; neither may be the sole author of the changes.

## Before tagging

- [ ] `pnpm verify` green from a clean checkout with `--frozen-lockfile` (lint, typecheck, tests, forbidden-pattern gate, secret gate, build, bundle gate, audit).
- [ ] Diff review completed against the previous tag; every dependency change traced to a DEPENDENCY_POLICY record.
- [ ] PROJECT_STATE.md updated (status, known issues, external-request inventory unchanged or PRIVACY.md updated in the same release).
- [ ] No placeholder values, no disabled security checks without a written, linked justification.

## Build integrity

- [ ] SBOM generated (`pnpm sbom` → sbom.json) and reviewed; no unexpected new licenses. Current build-time-only non-permissive licenses (documented, not shipped to users): sharp native lib LGPL-3.0, lightningcss MPL-2.0, caniuse-lite CC-BY-4.0.
- [ ] Security headers generated from the export (`pnpm csp` → apps/web/out/_headers); CSP inline-script hashes match this exact build. See SECURITY_HEADERS.md.
- [ ] Release manifest generated (`pnpm build`, then `pnpm csp`, then `OMIKAMI_BUILD_ID=<git-sha> pnpm release:hash` → release-manifest.json); manifest SHA-256 recorded.
- [ ] Deployed-bundle hash compared against the published manifest (detects a tampered deployment — the primary threat).
- [ ] KNOWN LIMITATION (Gate 8, pre-mainnet): Next 16 Turbopack export does not honor `generateBuildId`, so two independent rebuilds are NOT yet byte-identical. Resolve before mainnet (e.g. non-Turbopack export build, or post-process to strip the random build-id dir) so third parties can reproduce the exact bytes. Until then, publish the manifest from the official CI build and treat CI as the single source of truth.
- [ ] Release manifest (version, git tag, manifest hash, toolchain versions, IPFS CID when applicable) signed and published with the release.
- [ ] Signed git tag by a maintainer key.

## After publishing

- [ ] Deployed content hash compared against the manifest (automatic check where hosting allows; manual otherwise).
- [ ] Security headers verified on the live deployment (CSP, frame-ancestors, X-Frame-Options) on normal routes AND error pages.
- [ ] Rollback path confirmed working before announcing.
- [ ] Announcement only through pre-registered official channels; never through ads.

## Sign-off

Release ______ · Verifier 1 ______ (date) · Verifier 2 ______ (date)
