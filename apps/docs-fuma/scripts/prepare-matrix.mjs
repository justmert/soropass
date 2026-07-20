// Exports the committed compatibility-matrix snapshots into this app's public/
// so the <CompatibilityMatrix /> component can fetch /matrix/*.json at runtime
// (freshness, support grid, diff, CI grid) instead of bundling a static table.
// The matrix data/ snapshots are git-committed, so this is a copy + manifest —
// no rebuild or CI run needed at docs-build time.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
execSync('pnpm --filter @soropass/matrix docs:export', {
  stdio: 'inherit',
  env: { ...process.env, DOCS_PUBLIC_DIR: publicDir },
});
console.log('exported matrix snapshots → public/matrix');
