import { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorPlay } from 'lucide-react';

// Once the reference demo is deployed, set this to its embed URL, e.g.
//   const EMBED_BASE = 'https://demo.soropass.dev/embed.html';
// While it is empty, previews render a styled placeholder instead of a broken
// ("server not found") iframe.
const EMBED_BASE = '/demo/embed.html';
const DEMO_URL = 'https://demo.soropass.dev';

// The states each screen can step through, in flow order. Screens with a single
// surface (connect) or no flow (primitives) render without a state stepper —
// only the theme toggle. Mirrors the switch in apps/demo/src/embed.ts.
const STATES: Record<string, string[]> = {
  create: ['idle', 'prompting', 'deploying', 'success', 'error'],
  sign: ['idle', 'prompting', 'submitting', 'done', 'error'],
  recover: ['idle', 'discovering', 'resolved', 'error'],
  adddevice: ['idle', 'prompting', 'binding', 'success', 'error'],
  connect: [],
  primitives: [],
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function Preview({
  screen = 'create',
  state: initialState,
  theme: initialTheme = 'light',
  height = 360,
  stepper = true,
}: {
  screen?: string;
  state?: string;
  theme?: string;
  height?: number;
  // Show the state-stepper pills. Off for "Preview & code" sections that just
  // showcase the component (states get their own section).
  stepper?: boolean;
}) {
  const states = stepper ? (STATES[screen] ?? []) : [];
  const [state, setState] = useState(initialState ?? states[0] ?? 'idle');
  const [theme, setTheme] = useState(initialTheme);
  const [h, setH] = useState(height);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The iframe src is computed ONCE so changing state/theme never reloads it —
  // updates ride the postMessage bridge instead (no flash).
  const [src] = useState(
    () =>
      `${EMBED_BASE}?screen=${encodeURIComponent(screen)}` +
      `&state=${encodeURIComponent(initialState ?? STATES[screen]?.[0] ?? 'idle')}` +
      `&theme=${encodeURIComponent(initialTheme)}`,
  );

  const send = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'pk-set', screen, state, theme }, '*');
  }, [screen, state, theme]);

  // Push the current controls whenever they change.
  useEffect(() => {
    if (EMBED_BASE) send();
  }, [send]);

  // Track the iframe's reported height, and re-send controls once it signals
  // ready (covers a lazy iframe that loads after an interaction).
  useEffect(() => {
    if (!EMBED_BASE) return;
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; height?: number } | null;
      if (!d) return;
      if (d.type === 'pk-height' && typeof d.height === 'number') {
        setH(Math.max(320, Math.round(d.height)));
      } else if (d.type === 'pk-ready') {
        send();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [send]);

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
    <div className="my-5 overflow-hidden rounded-xl border bg-fd-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-fd-muted/40 px-3 py-2">
        {states.length > 0 ? (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={`${screen} states`}>
            {states.map((s) => (
              <Pill key={s} active={s === state} onClick={() => setState(s)}>
                {cap(s)}
              </Pill>
            ))}
          </div>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex gap-1">
          {(['light', 'dark'] as const).map((t) => (
            <Pill key={t} active={t === theme} onClick={() => setTheme(t)}>
              {cap(t)}
            </Pill>
          ))}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        title={`SoroPass ${screen} preview`}
        loading="lazy"
        style={{ width: '100%', height: h, border: 0, display: 'block' }}
      />
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-fd-primary text-fd-primary-foreground'
          : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground')
      }
    >
      {children}
    </button>
  );
}
