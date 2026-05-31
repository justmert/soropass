/**
 * Make typedoc's generated markdown safe for VitePress's Vue compiler.
 *
 * VitePress runs every `.md` through the Vue template compiler. TSDoc comment
 * prose often contains generics / shapes like `Map<K, V>` or `BytesN<64>` that
 * markdown-it passes through as raw inline HTML; Vue then parses `<K, V>` as a
 * malformed tag and the build fails. We HTML-escape raw `<` in non-code regions
 * (outside fenced blocks and inline-code spans), which renders identically but
 * is no longer treated as a tag.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const apiDir = join(process.cwd(), 'site', 'api');

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (path.endsWith('.md')) files.push(path);
  }
  return files;
}

function sanitize(markdown: string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Escape raw `<` only outside inline-code spans (odd segments sit between backticks).
      const segments = line.split('`');
      for (let i = 0; i < segments.length; i += 2) {
        segments[i] = (segments[i] ?? '').replace(/</g, '&lt;');
      }
      return segments.join('`');
    })
    .join('\n');
}

let changed = 0;
for (const file of walk(apiDir)) {
  const before = readFileSync(file, 'utf8');
  const after = sanitize(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}
console.log(`sanitize-api: VitePress-safe markdown in ${String(changed)} file(s)`);
