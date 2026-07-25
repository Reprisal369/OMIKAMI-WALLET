#!/usr/bin/env node
/**
 * OMIKAMI WALLET — Software Bill of Materials (DEPENDENCY_POLICY / RELEASE).
 * Produces sbom.json: every installed dependency with version + license,
 * grouped by license, from pnpm's own resolution. Dependency-free beyond
 * invoking the already-present pnpm. Run after `pnpm install`.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let raw;
try {
  raw = execSync('corepack pnpm@10 licenses list --json', {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
  });
} catch (e) {
  console.error('generate-sbom: could not read pnpm license data:', e.message);
  process.exit(1);
}

const byLicense = JSON.parse(raw);
const components = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const p of pkgs) {
    const versions = Array.isArray(p.versions) ? p.versions : p.version ? [p.version] : [];
    components.push({ name: p.name, versions, license });
  }
}
components.sort((a, b) => a.name.localeCompare(b.name));

const licenseCounts = Object.fromEntries(
  Object.entries(byLicense)
    .map(([lic, pkgs]) => [lic, pkgs.length])
    .sort((a, b) => b[1] - a[1]),
);

const sbom = {
  bomFormat: 'omikami-sbom-lite',
  generated: new Date().toISOString().slice(0, 10),
  componentCount: components.length,
  licenses: licenseCounts,
  components,
};
writeFileSync('sbom.json', JSON.stringify(sbom, null, 2) + '\n');
console.log(`generate-sbom: ${components.length} components across ${Object.keys(licenseCounts).length} licenses`);
console.log('generate-sbom: license spread:', JSON.stringify(licenseCounts));
console.log('generate-sbom: wrote sbom.json');
