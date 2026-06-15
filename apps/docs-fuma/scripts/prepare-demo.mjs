// Builds the reference demo with a `/demo/` base and vendors it into this app's
// public/ folder, so the docs serve the live mock-mode previews same-origin at
// /demo/ — no separate deployment or domain needed.
import { execSync } from 'node:child_process';
import { rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const demoDir = fileURLToPath(new URL('../../demo', import.meta.url));
const dest = fileURLToPath(new URL('../public/demo', import.meta.url));

execSync('pnpm exec vite build --base=/demo/', { cwd: demoDir, stdio: 'inherit' });
rmSync(dest, { recursive: true, force: true });
cpSync(join(demoDir, 'dist'), dest, { recursive: true });
console.log('vendored demo → public/demo');
