// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

// Single docs site (Astro Starlight): adopter front door (quickstart / integration
// / API) + the living compatibility matrix (S09) + CI architecture (S10).
export default defineConfig({
  srcDir: './site',
  outDir: './site/dist',
  // No image optimization needed for the docs; avoids requiring sharp's native build.
  image: { service: passthroughImageService() },
  integrations: [
    // Render ```mermaid fences (client-side, follows the Starlight light/dark theme).
    mermaid({ autoTheme: true }),
    starlight({
      title: 'Stellar Passkey',
      description:
        'Passkey sign-in for Stellar smart accounts — a minimal ES256-only SDK, a stellar-wallets-kit module, and a living WebAuthn compatibility matrix.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Creit-Tech/Stellar-Wallets-Kit',
        },
      ],
      plugins: [
        // Generated API reference (typedoc → markdown) over the core public subpaths.
        starlightTypeDoc({
          entryPoints: [
            '../../packages/core/src/types.ts',
            '../../packages/core/src/create.ts',
            '../../packages/core/src/connect.ts',
            '../../packages/core/src/sign.ts',
            '../../packages/core/src/recover.ts',
            '../../packages/core/src/adapters/index.ts',
            '../../packages/core/src/testing/index.ts',
          ],
          tsconfig: '../../packages/core/tsconfig.json',
          output: 'api',
          sidebar: { label: 'API reference', collapsed: true },
          typeDoc: {
            skipErrorChecking: true,
            excludeInternal: true,
            entryFileName: 'index',
            readme: 'none',
          },
        }),
      ],
      sidebar: [
        {
          label: 'Guide',
          items: [
            { label: 'Quickstart', slug: 'quickstart' },
            { label: 'Integration (wallet teams)', slug: 'integration' },
            { label: 'Security & recovery', slug: 'security' },
          ],
        },
        {
          label: 'Reference',
          items: [
            typeDocSidebarGroup,
            { label: 'Compatibility matrix', slug: 'matrix' },
            { label: 'CI architecture', slug: 'architecture' },
            { label: 'Contributing cells', slug: 'contributing' },
          ],
        },
      ],
    }),
  ],
});
