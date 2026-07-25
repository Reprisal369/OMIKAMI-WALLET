# OMIKAMI WALLET — DEPENDENCY_POLICY.md

Date: 2026-07-13 · Applies to every dependency addition, update, or removal.

## Adding or updating a dependency — required before merge

Every proposal documents, in the PR description: why it is required; what security-sensitive access it receives (network, wallet, signing path, DOM injection); whether a smaller alternative exists; the exact version; the licence; evidence of active maintenance. One reviewer must approve explicitly on these six points.

## Hard rules

- Exact versions only in package.json (no `^`/`~` for runtime dependencies). Lockfile committed; CI installs with `--frozen-lockfile`.
- Lifecycle (postinstall) scripts are disabled by default (pnpm 10 behavior). Approving a build script requires written justification in the PR (current state: none approved; `sharp` deliberately not approved).
- No git URLs, local paths, or tarball dependencies in any package.json.
- Registry: npmjs.org only. New scopes/maintainers are reviewed at addition time (typosquatting and dependency-confusion check: exact name, download history, repository link match).
- Forbidden in the frontend regardless of purpose: packages that accept or derive private keys or mnemonics; analytics/telemetry SDKs; session-replay software; remote-code loaders.
- Every frontend env value is public by definition. Provider identifiers used client-side must be domain-restricted and quota-limited at the provider, and are never treated as secrets.

## Continuous monitoring

- `pnpm audit` in the verify suite (blocks on any known vulnerability; overrides require a documented exception with expiry).
- OSV-Scanner as second scanner in CI.
- Dependency-review gate on every PR; unexpected lockfile diffs block merge.
- Quarterly: prune unused dependencies (`knip` or manual review) and re-verify the six-point record for majors.

## Incident handling

On report of a compromised dependency/version: pin to last known-good lockfile, rebuild, compare hashes, disclose per INCIDENT_RESPONSE.md.
