import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';
import { readdir } from 'node:fs/promises';
import { createGetUrl, getSlugs } from 'fumadocs-core/source';
import { getPageImagePath } from './app/lib/og';

const getUrl = createGetUrl('/docs');

export default {
  ssr: true,
  presets: [vercelPreset()],
  future: {
    v8_middleware: true,
  },
  async prerender({ getStaticPaths }) {
    const paths: string[] = [];
    const excluded: string[] = ['/api/search'];

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path);
    }

    // readdir(recursive) works on Node 20; fs/promises `glob` needs Node 22.
    const entries = await readdir('content/docs', { recursive: true });
    for (const entry of entries) {
      if (!entry.endsWith('.mdx')) continue;
      const slugs = getSlugs(entry.split('\\').join('/'));

      paths.push(getUrl(slugs));
      paths.push(getPageImagePath(slugs));
    }

    return paths;
  },
} satisfies Config;
