import { useEffect, useState } from 'react';
import {
  CircleHelp,
  Clock,
  Cpu,
  Database,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

/**
 * Renders the compatibility matrix from the exported pipeline JSON at RUNTIME
 * (fetched from /matrix/*.json, produced by `@soropass/matrix docs:export`) —
 * not a build-time bundle. Freshness, provenance, per-cell status/source/tier,
 * the verifying engine version, and the diff between the two latest snapshots
 * all come straight from the data, so nothing on the page can drift from it.
 *
 * The route is SSR'd/prerendered, so fetching happens in useEffect (browser
 * only) with a skeleton for the server pass — never fetch during render.
 */

// ── lightweight local types (mirror @soropass/matrix, no zod at runtime) ──────
type Status = 'supported' | 'unsupported' | 'partial' | 'unknown';
type Tier = 'tier-1-automated' | 'tier-2-manual';

interface MergedCell {
  feature: string;
  featureLabel: string;
  browser: string;
  os: string;
  status: Status;
  source: string;
  tier: Tier;
  lastVerified: string;
  since?: string | null;
  sourceUrl?: string;
  notes?: string;
  verifiedOn?: { browser: string; version: string };
}
interface MatrixSnapshot {
  builtAt: string;
  inputs: { bcd: string | null; ci: string | null };
  provenance?: { bcdVersion?: string; engines?: { browser: string; version: string }[] };
  features: { id: string; label: string }[];
  cells: MergedCell[];
}
interface MatrixLatest {
  builtAt: string;
  cellCount: number;
  inputs: { bcd: string | null; ci: string | null };
}
interface MatrixDiff {
  from: string;
  to: string;
  changed: { cell: string; before: string; after: string }[];
  added: { cell: string; now: string }[];
  removed: { cell: string; was: string }[];
  reverified?: { cell: string; fromVersion: string; toVersion: string }[];
}
interface CiGridResult {
  browser: string;
  browserVersion: string;
  runnerOs: string;
  transport: string;
  residentKey: boolean;
  userVerification: boolean;
  created: boolean;
  asserted: boolean;
  verified: boolean;
  alg: number | null;
  error?: string;
}
interface CiSnapshot {
  pulledAt: string;
  runnerOs: string;
  browsers: { name: string; version: string; available: boolean }[];
  gridResults: CiGridResult[];
  limitations: string[];
}
interface VerificationRun {
  ranAt: string;
  runnerOs: string;
  bcdVersion: string;
  engines: { browser: string; version: string }[];
  canonicalVerified: boolean;
  changed: boolean;
}
interface VerificationLog {
  runs: VerificationRun[];
}
interface Manifest {
  latest: {
    matrix: string | null;
    diff: string | null;
    ci: string | null;
    bcd: string | null;
    verificationLog?: string | null;
  };
}
interface Loaded {
  matrix: MatrixSnapshot;
  latest: MatrixLatest | null;
  diff: MatrixDiff | null;
  ci: CiSnapshot | null;
  log: VerificationLog | null;
}
interface DeviceCaps {
  isUvpaa: boolean | null;
  conditionalGet: boolean | null;
  clientCapabilities: Record<string, boolean> | null;
}

const BASE = '/matrix';

// The eight tracked platforms, in the documented column order.
const PLATFORMS: { label: string; browser: string; os: string }[] = [
  { label: 'Chrome', browser: 'Chrome', os: 'desktop' },
  { label: 'Chrome Android', browser: 'Chrome', os: 'Android' },
  { label: 'Edge', browser: 'Edge', os: 'Windows' },
  { label: 'Safari macOS', browser: 'Safari', os: 'macOS' },
  { label: 'Safari iOS', browser: 'Safari', os: 'iOS' },
  { label: 'Firefox', browser: 'Firefox', os: 'desktop' },
  { label: 'Firefox Android', browser: 'Firefox', os: 'Android' },
  { label: 'Samsung', browser: 'Samsung Internet', os: 'Android' },
];

const HIGHLIGHT = new Set(['es256_alg', 'hybrid_transport']);

const STATUS: Record<Status, { glyph: string; cls: string; label: string }> = {
  supported: { glyph: '✓', cls: 'text-emerald-600 dark:text-emerald-400', label: 'supported' },
  partial: { glyph: '◐', cls: 'text-amber-600 dark:text-amber-400', label: 'partial' },
  unsupported: { glyph: '✕', cls: 'text-rose-600 dark:text-rose-400', label: 'unsupported' },
  unknown: { glyph: '?', cls: 'text-fd-muted-foreground', label: 'unknown' },
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function relAge(iso: string): string {
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (Number.isNaN(days)) return iso;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} mo ago` : `${Math.floor(months / 12)} yr ago`;
}

const prettyId = (id: string): string => id.replace(/\|/g, ' · ');

export function CompatibilityMatrix() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<MergedCell | null>(null);
  const [caps, setCaps] = useState<DeviceCaps | null>(null);

  // Live feature-detection on the VISITOR's own browser (never during SSR).
  useEffect(() => {
    let alive = true;
    (async () => {
      const Pkc = (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential as
        | {
            isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
            isConditionalMediationAvailable?: () => Promise<boolean>;
            getClientCapabilities?: () => Promise<Record<string, boolean>>;
          }
        | undefined;
      if (!Pkc) {
        if (alive) setCaps({ isUvpaa: null, conditionalGet: null, clientCapabilities: null });
        return;
      }
      const safe = async (p?: () => Promise<boolean>): Promise<boolean | null> => {
        if (!p) return null;
        try {
          return await p();
        } catch {
          return null;
        }
      };
      const clientCapabilities = Pkc.getClientCapabilities
        ? await Pkc.getClientCapabilities().catch(() => null)
        : null;
      const detected: DeviceCaps = {
        isUvpaa: await safe(Pkc.isUserVerifyingPlatformAuthenticatorAvailable?.bind(Pkc)),
        conditionalGet: await safe(Pkc.isConditionalMediationAvailable?.bind(Pkc)),
        clientCapabilities,
      };
      if (alive) setCaps(detected);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const manifest = await getJson<Manifest>(`${BASE}/index.json`);
      if (!manifest?.latest.matrix) {
        if (alive) setError(true);
        return;
      }
      const [matrix, latest, diff, ci, log] = await Promise.all([
        getJson<MatrixSnapshot>(`${BASE}/${manifest.latest.matrix}`),
        getJson<MatrixLatest>(`${BASE}/matrix-latest.json`),
        manifest.latest.diff ? getJson<MatrixDiff>(`${BASE}/${manifest.latest.diff}`) : null,
        manifest.latest.ci ? getJson<CiSnapshot>(`${BASE}/${manifest.latest.ci}`) : null,
        manifest.latest.verificationLog
          ? getJson<VerificationLog>(`${BASE}/${manifest.latest.verificationLog}`)
          : null,
      ]);
      if (!alive) return;
      if (!matrix) {
        setError(true);
        return;
      }
      setData({ matrix, latest, diff, ci, log });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="my-5 rounded-xl border border-dashed bg-fd-card/60 px-5 py-8 text-center text-sm text-fd-muted-foreground">
        No exported matrix snapshot found at <code>/matrix/</code>. Run{' '}
        <code>pnpm --filter @soropass/matrix docs:export</code> into the docs <code>public/</code>{' '}
        and rebuild.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="my-5 animate-pulse rounded-xl border bg-fd-card">
        <div className="h-10 border-b bg-fd-muted/40" />
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-fd-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  const { matrix, latest, diff, ci, log } = data;
  const cellFor = (feature: string, browser: string, os: string): MergedCell | undefined =>
    matrix.cells.find((c) => c.feature === feature && c.browser === browser && c.os === os);

  const sourceCounts = matrix.cells.reduce<Record<string, number>>((acc, c) => {
    acc[c.source] = (acc[c.source] ?? 0) + 1;
    return acc;
  }, {});
  const lastRun = log?.runs.at(-1);
  const bcdVersion = matrix.provenance?.bcdVersion ?? lastRun?.bcdVersion;
  const engines = matrix.provenance?.engines ?? lastRun?.engines ?? [];

  return (
    <div className="my-5 space-y-4">
      {/* Freshness */}
      <div className="rounded-xl border bg-fd-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-fd-muted/40 px-4 py-3 text-sm">
          <Stat icon={<Clock className="h-4 w-4" />} label="Built">
            {matrix.builtAt}{' '}
            <span className="text-fd-muted-foreground">({relAge(matrix.builtAt)})</span>
          </Stat>
          {bcdVersion ? (
            <Stat icon={<Database className="h-4 w-4" />} label="BCD">
              {bcdVersion}
            </Stat>
          ) : null}
          {lastRun ? (
            <Stat icon={<RefreshCw className="h-4 w-4" />} label="Re-verified">
              {lastRun.ranAt} <span className="text-fd-muted-foreground">({lastRun.runnerOs})</span>
            </Stat>
          ) : null}
          <Stat icon={<Cpu className="h-4 w-4" />} label="Cells">
            {latest?.cellCount ?? matrix.cells.length}
          </Stat>
          {lastRun ? (
            <span
              className={
                'ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ' +
                (lastRun.canonicalVerified
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-fd-muted text-fd-muted-foreground')
              }
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {lastRun.canonicalVerified ? 'canonical verified' : 'canonical not run'}
            </span>
          ) : null}
        </div>
        {engines.length > 0 ? (
          <div className="px-4 py-2 text-xs text-fd-muted-foreground">
            Machine-verified on{' '}
            {engines.map((e, i) => (
              <span key={`${e.browser}-${i}`}>
                {i > 0 ? ', ' : ''}
                <span className="font-medium text-fd-foreground">
                  {e.browser} {e.version}
                </span>
              </span>
            ))}
            . Source mix:{' '}
            {Object.entries(sourceCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([src, n], i) => (
                <span key={src}>
                  {i > 0 ? ' · ' : ''}
                  <SourceBadge source={src} /> {n}
                </span>
              ))}
          </div>
        ) : null}
      </div>

      {/* Your device — live feature-detection on the visitor's own browser */}
      <YourDevice caps={caps} />

      {/* Support grid */}
      <div className="overflow-x-auto rounded-xl border bg-fd-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-fd-muted/40">
              <th className="sticky left-0 z-10 bg-fd-muted/40 px-3 py-2 text-left font-medium">
                Feature
              </th>
              {PLATFORMS.map((p) => (
                <th key={p.label} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.features.map((f) => (
              <tr
                key={f.id}
                className={
                  'border-t ' + (HIGHLIGHT.has(f.id) ? 'bg-fd-primary/5' : 'hover:bg-fd-muted/20')
                }
              >
                <th className="sticky left-0 z-10 bg-fd-card px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  {HIGHLIGHT.has(f.id) ? <span className="text-fd-primary">★ </span> : null}
                  {f.label}
                </th>
                {PLATFORMS.map((p) => {
                  const c = cellFor(f.id, p.browser, p.os);
                  const st = c ? STATUS[c.status] : STATUS.unknown;
                  return (
                    <td key={p.label} className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        title={c ? `${st.label} · ${c.source}` : 'no data'}
                        onClick={() => c && setSelected(c)}
                        className="inline-flex flex-col items-center gap-0.5 rounded px-1 py-0.5 hover:bg-fd-accent"
                      >
                        <span className={`text-base leading-none ${st.cls}`}>{st.glyph}</span>
                        {c ? <SourceBadge source={c.source} tiny /> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell detail */}
      {selected ? (
        <div className="rounded-xl border bg-fd-card p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">
              {selected.featureLabel} · {selected.browser}/{selected.os}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-fd-muted-foreground hover:text-fd-foreground"
            >
              close ✕
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-fd-muted-foreground">
            <Detail k="Status">
              <span className={STATUS[selected.status].cls}>{STATUS[selected.status].label}</span>
            </Detail>
            <Detail k="Source">
              <SourceBadge source={selected.source} />
            </Detail>
            <Detail k="Tier">
              {selected.tier === 'tier-1-automated' ? 'T1 · automated' : 'T2 · manual'}
            </Detail>
            {selected.verifiedOn ? (
              <Detail k="Verified on">
                {selected.verifiedOn.browser} {selected.verifiedOn.version}
              </Detail>
            ) : null}
            {selected.since ? <Detail k="Since">{selected.since}</Detail> : null}
            <Detail k="Last verified">{selected.lastVerified}</Detail>
            {selected.notes ? <Detail k="Notes">{selected.notes}</Detail> : null}
            {selected.sourceUrl ? (
              <Detail k="Reference">
                <a
                  className="text-fd-primary underline-offset-2 hover:underline"
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.sourceUrl.replace(/^https?:\/\//, '').slice(0, 48)}
                </a>
              </Detail>
            ) : null}
          </dl>
        </div>
      ) : (
        <p className="px-1 text-xs text-fd-muted-foreground">
          <CircleHelp className="mr-1 inline h-3.5 w-3.5" />
          Click any cell for its source, tier, verifying engine, and last-verified date.
        </p>
      )}

      {/* Diff */}
      {diff ? <DiffPanel diff={diff} /> : null}

      {/* CI grid */}
      {ci ? <CiGrid ci={ci} /> : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-fd-muted-foreground">{icon}</span>
      <span className="text-fd-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </span>
  );
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-medium text-fd-foreground">{k}</dt>
      <dd>{children}</dd>
    </>
  );
}

function CapRow({ label, v }: { label: string; v: boolean | null }) {
  const cls =
    v === true
      ? 'text-emerald-600 dark:text-emerald-400'
      : v === false
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-fd-muted-foreground';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cls}>{v === true ? '✓' : v === false ? '✕' : '?'}</span>
      <span>{label}</span>
    </span>
  );
}

function YourDevice({ caps }: { caps: DeviceCaps | null }) {
  const CLIENT_CAP_KEYS = [
    'relatedOrigins',
    'hybridTransport',
    'passkeyPlatformAuthenticator',
    'userVerifyingPlatformAuthenticator',
    'conditionalGet',
  ];
  const noApi =
    caps !== null &&
    caps.isUvpaa === null &&
    caps.conditionalGet === null &&
    caps.clientCapabilities === null;
  return (
    <div className="rounded-xl border bg-fd-card p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">
        <MonitorSmartphone className="h-4 w-4 text-fd-primary" /> On your device
        <span className="font-normal text-fd-muted-foreground">
          — detected live in this browser, not from the dataset
        </span>
      </div>
      {caps === null ? (
        <p className="text-fd-muted-foreground">Detecting…</p>
      ) : noApi ? (
        <p className="text-fd-muted-foreground">
          This browser does not expose the WebAuthn capability APIs.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-fd-muted-foreground">
          <CapRow label="Platform authenticator (isUVPAA)" v={caps.isUvpaa} />
          <CapRow label="Conditional UI (autofill)" v={caps.conditionalGet} />
          {caps.clientCapabilities
            ? Object.entries(caps.clientCapabilities)
                .filter(([k]) => CLIENT_CAP_KEYS.includes(k))
                .map(([k, v]) => <CapRow key={k} label={k} v={v} />)
            : null}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source, tiny = false }: { source: string; tiny?: boolean }) {
  const map: Record<string, string> = {
    ci: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    BCD: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    curated: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    'passkeys.dev': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    caniuse: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    manual: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  };
  const cls = map[source] ?? 'bg-fd-muted text-fd-muted-foreground';
  return (
    <span
      className={
        'inline-block rounded font-medium ' +
        (tiny ? 'px-1 text-[9px] leading-tight ' : 'px-1.5 py-0.5 text-[11px] ') +
        cls
      }
    >
      {source.toLowerCase()}
    </span>
  );
}

function DiffPanel({ diff }: { diff: MatrixDiff }) {
  const reverified = diff.reverified ?? [];
  const total = diff.changed.length + diff.added.length + diff.removed.length;
  return (
    <div className="rounded-xl border bg-fd-card p-4 text-sm">
      <div className="mb-2 font-medium">
        Change since previous snapshot{' '}
        <span className="font-normal text-fd-muted-foreground">
          ({diff.from} → {diff.to})
        </span>
      </div>
      {total === 0 && reverified.length === 0 ? (
        <p className="text-fd-muted-foreground">
          No cell changed status, source, or tier. The matrix is current.
        </p>
      ) : (
        <ul className="space-y-1 text-fd-muted-foreground">
          {diff.changed.map((c) => (
            <li key={c.cell}>
              <span className="text-amber-600 dark:text-amber-400">changed</span> {prettyId(c.cell)}
              : <code>{c.before}</code> → <code>{c.after}</code>
            </li>
          ))}
          {diff.added.map((c) => (
            <li key={c.cell}>
              <span className="text-emerald-600 dark:text-emerald-400">added</span>{' '}
              {prettyId(c.cell)}
            </li>
          ))}
          {diff.removed.map((c) => (
            <li key={c.cell}>
              <span className="text-rose-600 dark:text-rose-400">removed</span> {prettyId(c.cell)}
            </li>
          ))}
          {reverified.map((c) => (
            <li key={c.cell}>
              <span className="text-blue-600 dark:text-blue-400">re-verified</span>{' '}
              {prettyId(c.cell)}: {c.fromVersion} → {c.toVersion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CiGrid({ ci }: { ci: CiSnapshot }) {
  const yn = (b: boolean): string => (b ? '✓' : '·');
  return (
    <div className="overflow-x-auto rounded-xl border bg-fd-card">
      <div className="border-b bg-fd-muted/40 px-4 py-2 text-sm font-medium">
        CI grid — combinatorial proof{' '}
        <span className="font-normal text-fd-muted-foreground">
          ({ci.runnerOs}, {ci.pulledAt})
        </span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-fd-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Browser</th>
            <th className="px-2 py-2 text-left font-medium">transport · rk · uv</th>
            <th className="px-2 py-2 text-center font-medium">created</th>
            <th className="px-2 py-2 text-center font-medium">asserted</th>
            <th className="px-2 py-2 text-center font-medium">verified</th>
            <th className="px-2 py-2 text-center font-medium">alg</th>
          </tr>
        </thead>
        <tbody>
          {ci.gridResults.map((g, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-1.5 whitespace-nowrap">
                {g.browser}{' '}
                <span className="text-xs text-fd-muted-foreground">{g.browserVersion}</span>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {g.transport} · {g.residentKey ? 'rk' : 'no-rk'} ·{' '}
                {g.userVerification ? 'uv' : 'no-uv'}
              </td>
              <td className="px-2 py-1.5 text-center">{yn(g.created)}</td>
              <td className="px-2 py-1.5 text-center">{yn(g.asserted)}</td>
              <td
                className={
                  'px-2 py-1.5 text-center ' +
                  (g.verified
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-fd-muted-foreground')
                }
              >
                {yn(g.verified)}
              </td>
              <td className="px-2 py-1.5 text-center">{g.alg ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
