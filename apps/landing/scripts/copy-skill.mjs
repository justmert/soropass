// Copies the repo-root skill.md into public/ so soropass.dev/skill.md serves
// the current file on every build. The root file is the source of truth.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(appRoot, 'public'), { recursive: true });
copyFileSync(join(appRoot, '..', '..', 'skill.md'), join(appRoot, 'public', 'skill.md'));
