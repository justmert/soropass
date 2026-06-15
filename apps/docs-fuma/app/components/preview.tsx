import { useEffect, useState } from 'react';
import { MonitorPlay } from 'lucide-react';

// Once the reference demo is deployed, set this to its embed URL, e.g.
//   const EMBED_BASE = 'https://demo.soropass.dev/embed.html';
// While it is empty, previews render a styled placeholder instead of a broken
// ("server not found") iframe.
const EMBED_BASE = '/demo/embed.html';
const DEMO_URL = 'https://demo.soropass.dev';

export function Preview({
  screen = 'create',
  height = 520,
}: {
  screen?: string;
  height?: number;
}) {
  const [h, setH] = useState(height);

  useEffect(() => {
    if (!EMBED_BASE) return;
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; height?: number } | null;
      if (d && d.type === 'pk-height' && typeof d.height === 'number') {
        setH(Math.max(320, Math.round(d.height)));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!EMBED_BASE) {
    return (
      <div className="my-5 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-fd-card/60 px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
          <MonitorPlay className="h-5 w-5" />
        </span>
        <p className="font-medium">
          Interactive <span className="text-fd-primary">{screen}</span> preview
        </p>
        <p className="max-w-sm text-sm text-fd-muted-foreground">
          The real component runs in mock mode on the demo.{' '}
          <a
            className="font-medium text-fd-primary underline-offset-2 hover:underline"
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open the demo →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border bg-fd-card">
      <iframe
        src={`${EMBED_BASE}?screen=${encodeURIComponent(screen)}`}
        title={`SoroPass ${screen} preview`}
        loading="lazy"
        style={{ width: '100%', height: h, border: 0, display: 'block' }}
      />
    </div>
  );
}
