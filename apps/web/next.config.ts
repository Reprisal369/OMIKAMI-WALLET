import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';

/**
 * Static export: no server functions, IPFS-compatible output in `out/`.
 * NOTE (Gate 7): static export cannot emit HTTP response headers, so the
 * strict Content-Security-Policy is applied by the hosting layer at
 * deployment time and verified during the frontend security review.
 *
 * Gate 8 (reproducible builds): Next.js otherwise generates a RANDOM build ID
 * per build, which was the ONLY source of byte-level non-determinism in this
 * static export. Pinning it to the package version makes two clean builds of the
 * same commit byte-identical (verify with `pnpm build && pnpm release:hash`),
 * while still changing per release for cache-busting. Side effect: the CSP
 * inline-script hashes are now stable per version too.
 */
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  generateBuildId: () => `omikami-${version}`,
  transpilePackages: [
    '@omikami/chain-config',
    '@omikami/security',
    '@omikami/token-registry',
    '@omikami/types',
    '@omikami/ui',
  ],
};

export default nextConfig;
