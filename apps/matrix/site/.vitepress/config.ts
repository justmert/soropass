import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Stellar Passkey Compatibility Matrix',
  description:
    'A living, sourced WebAuthn / passkey compatibility matrix for Stellar smart accounts.',
  // matrix-table.md is a generated partial included into index.md, not its own page.
  srcExclude: ['matrix-table.md'],
  themeConfig: {
    nav: [
      { text: 'Matrix', link: '/' },
      { text: 'Contributing', link: '/CONTRIBUTING' },
    ],
    sidebar: [
      { text: 'Compatibility matrix', link: '/' },
      { text: 'Contributing cells', link: '/CONTRIBUTING' },
    ],
  },
});
