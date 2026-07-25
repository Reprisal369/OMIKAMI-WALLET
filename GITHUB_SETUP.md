# OMIKAMI WALLET — GitHub activation guide

How to put this repository on GitHub and turn on the CI + branch protection that
gate every future change. Do these once. Commands assume Windows PowerShell in
the repo root (`C:\Users\praet\Downloads\omikami-wallet`); `gh` steps are
optional and have a click-path equivalent.

Nothing here deploys or publishes the app — it only sets up the source
repository and its automated checks.

---

## 0. Before you start

- Install Git (`git --version` should work).
- Optional but easier: install the GitHub CLI `gh` (`winget install GitHub.cli`),
  then `gh auth login`.
- Decide public vs private. Note: `dependency-review` and free `gitleaks` behave
  best on a **public** repo; on a private repo dependency-review needs GitHub
  Advanced Security. You can start private and open it later.

## 1. First commit and version tag

The repo already has a correct `.gitignore` (node_modules, .next, out,
release-manifest.json, sbom.json, .env are excluded).

```powershell
git init
git add .
git commit -m "OMIKAMI WALLET v0.5.0 — read-only wallet (shell, portfolio, activity, transfer preview, allowance dashboard)"
git branch -M main
git tag -a v0.5.0 -m "v0.5.0 — read-only allowance dashboard"
```

Sanity-check that no secrets or build output are staged:

```powershell
git ls-files | Select-String -Pattern "node_modules|\.env$|/out/|release-manifest|sbom.json"
# (should print nothing)
```

## 2. Create the GitHub repo and push

**With gh (recommended):**

```powershell
gh repo create omikami-wallet --private --source . --remote origin --push
git push origin v0.5.0
```

**Without gh:** create an empty repo named `omikami-wallet` on github.com
(no README/license — the repo already has them), then:

```powershell
git remote add origin https://github.com/<your-user>/omikami-wallet.git
git push -u origin main
git push origin v0.5.0
```

The push triggers `.github/workflows/ci.yml` automatically. Watch it under the
repo's **Actions** tab. Expected jobs: `verify`, `e2e`, `sbom-and-hash`,
`osv-scan`, `secret-scan` (and `dependency-review` on pull requests).

## 3. Turn on branch protection for `main`

Settings → **Branches** → **Add branch ruleset** (or "Add rule") targeting
`main`, and enable:

- **Require a pull request before merging** (≥1 approval; dismiss stale
  approvals on new commits). As a solo maintainer you can still self-review, but
  keep the PR flow so the checks always run before merge.
- **Require status checks to pass before merging** → **Require branches to be up
  to date**, then add these required checks (they appear after the first CI run):
  `verify`, `e2e`, `sbom-and-hash`, `osv-scan`, `secret-scan`.
- **Require conversation resolution before merging.**
- **Do not allow bypassing the above settings** (include administrators).
- **Block force pushes** and **restrict deletions** on `main`.

## 4. Repository security settings

Settings → **Code security** (and **Actions → General**):

- Enable **Dependabot alerts** and **Dependabot security updates**.
- Actions → General → **Fork pull request workflows**: keep the default
  "Require approval for first-time contributors"; ensure **secrets are not
  exposed to fork PRs** (default). This workflow needs no custom secrets.
- Actions → General → **Workflow permissions**: set to **Read repository
  contents** (the workflow already declares least-privilege `permissions`).

## 5. Notes on individual checks

- **gitleaks**: free for personal/public repos. Only a GitHub *Organization*
  repo needs a `GITLEAKS_LICENSE` secret. If you later move this into an org,
  add that secret; otherwise ignore it.
- **osv-scan** and **verify → `pnpm audit`** overlap intentionally (defense in
  depth). If both flag the same advisory, fix it once via a `pnpm.overrides`
  entry and record it in `DEPENDENCY_POLICY.md`.
- **e2e** installs Chromium in CI and runs all 38 Playwright tests headless via
  the dev server; a failure uploads the Playwright report as an artifact.

## 6. Keeping the pinned actions current

Every action in `ci.yml` is pinned to a commit SHA with a version comment. To
bump one safely, resolve the new SHA authoritatively and replace both the hash
and the comment:

```powershell
git ls-remote --tags --refs https://github.com/actions/checkout | Select-String "v6.1"
```

Dependabot can also open version-bump PRs for actions if you add a
`.github/dependabot.yml` for the `github-actions` ecosystem (optional).

## 7. Release tagging going forward

Follow `CHANGELOG.md` (Keep a Changelog + SemVer). For each stable checkpoint:
`git tag -a vX.Y.Z -m "..."` then `git push origin vX.Y.Z`, and fill the
`RELEASE_CHECKLIST.md` before any future public release. Current version:
**v0.5.0** (read-only; not yet publicly released).
