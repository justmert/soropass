/* Compatibility — the living matrix explorer.
   This page renders the REAL exported snapshots from apps/matrix (MDN BCD ingest +
   virtual-authenticator CI), fetched from /matrix/*.json — NOT hand-written data.
   Every cell carries its real source + tier + last-verified date; unknowns render
   "?" honestly. View the raw JSON link to verify nothing here is invented. */
import { useState, useEffect } from 'react';
import { DocsPage, Callout, PageNav, I } from '../shell.jsx';

const TOC = [
  ['fresh', 'Freshness', 0],
  ['provenance', 'Provenance', 0],
  ['legend', 'How to read a cell', 0],
  ['grid', 'Support grid', 0],
  ['ci', 'CI grid', 0],
];

// Display order + short labels for the 8 real platforms in the snapshot.
const PLATFORM_ORDER = [
  ['Chrome', 'desktop', 'Chrome'],
  ['Chrome', 'Android', 'Chrome Android'],
  ['Edge', 'Windows', 'Edge'],
  ['Safari', 'macOS', 'Safari macOS'],
  ['Safari', 'iOS', 'Safari iOS'],
  ['Firefox', 'desktop', 'Firefox'],
  ['Firefox', 'Android', 'Firefox Android'],
  ['Samsung Internet', 'Android', 'Samsung'],
];
const KEY_FEATURES = new Set(['es256_alg', 'hybrid_transport']);

const STATUS_GLYPH = {
  supported: ['✓', 'var(--pk-color-success)', 'supported'],
  partial: ['◐', 'var(--pk-color-info)', 'partial'],
  unsupported: ['✕', 'var(--pk-color-error)', 'unsupported'],
  unknown: ['?', 'var(--pk-color-text-faint)', 'unknown'],
};
// Map the real snapshot sources onto the three source-badge styles.
const SRC_CLASS = {
  ci: 'dx-src-probed',
  live: 'dx-src-probed',
  BCD: 'dx-src-bcd',
  curated: 'dx-src-curated',
  'passkeys.dev': 'dx-src-curated',
  caniuse: 'dx-src-curated',
};
const SRC_LABEL = { ci: 'ci', BCD: 'bcd' };

function useMatrixData() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const idx = await (await fetch('/matrix/index.json')).json();
        const [matrix, ci, bcd] = await Promise.all([
          fetch('/matrix/' + idx.latest.matrix).then((r) => r.json()),
          idx.latest.ci ? fetch('/matrix/' + idx.latest.ci).then((r) => r.json()) : Promise.resolve(null),
          idx.latest.bcd ? fetch('/matrix/' + idx.latest.bcd).then((r) => r.json()) : Promise.resolve(null),
        ]);
        if (alive) setState({ loading: false, idx, matrix, ci, bcd });
      } catch (e) {
        if (alive) setState({ loading: false, error: String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

function relAge(dateStr) {
  try {
    const then = new Date(dateStr + 'T00:00:00Z').getTime();
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 31) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } catch {
    return '';
  }
}

function Cell({ cell, onClick }) {
  if (!cell) return <span className="dx-cell" style={{ opacity: 0.35 }}>—</span>;
  const [g, color] = STATUS_GLYPH[cell.status] || STATUS_GLYPH.unknown;
  const srcClass = SRC_CLASS[cell.source] || 'dx-src-curated';
  const srcLabel = SRC_LABEL[cell.source] || cell.source;
  return (
    <button className="dx-cell" onClick={onClick} title={`${cell.source} · ${cell.status}${cell.since ? ' · since ' + cell.since : ''}`}>
      <span className="dx-cell__glyph" style={{ color }}>
        {g}
      </span>
      <span className={`dx-cell__src ${srcClass}`}>{srcLabel}</span>
    </button>
  );
}

export default function Compatibility() {
  const data = useMatrixData();
  const [sel, setSel] = useState(null);

  return (
    <DocsPage active="Compatibility" toc={TOC}>
      <div className="dx-breadcrumb">
        Guides <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Compatibility</span>
      </div>
      <h1 className="dx-h1">Browser compatibility</h1>
      <p className="dx-lead">
        Sourced, machine-probed, dated, and diffable — re-verified automatically, never hand-waved. This page renders
        the <strong>real exported snapshot</strong> from the matrix pipeline; nothing on it is typed by hand.
      </p>

      {data.loading && (
        <div className="dx-skeleton" style={{ padding: 40, textAlign: 'center', color: 'var(--pk-color-text-muted)' }}>
          Loading the latest matrix snapshot…
        </div>
      )}

      {data.error && (
        <Callout kind="warn">
          Couldn't load <code>/matrix/index.json</code> ({data.error}). Run{' '}
          <code>pnpm --filter @soropass/matrix matrix:build</code> then{' '}
          <code>DOCS_PUBLIC_DIR=apps/site/public pnpm --filter @soropass/matrix docs:export</code>.
        </Callout>
      )}

      {!data.loading && !data.error && <MatrixBody data={data} sel={sel} setSel={setSel} />}

      <PageNav prev={['Examples', '/examples']} next={['How it works', '/how-it-works']} />
    </DocsPage>
  );
}

function MatrixBody({ data, sel, setSel }) {
  const { matrix, ci, bcd, idx } = data;
  const features = matrix.features;
  const cells = matrix.cells;

  // Index cells by feature|browser|os, and tally real source provenance.
  const byKey = {};
  const srcCount = {};
  for (const c of cells) {
    byKey[`${c.feature}|${c.browser}|${c.os}`] = c;
    srcCount[c.source] = (srcCount[c.source] || 0) + 1;
  }
  const rawHref = '/matrix/' + idx.latest.matrix;
  const ciBrowser = ci?.browsers?.find((b) => b.available);

  return (
    <>
      <h2 className="dx-h2" id="fresh">
        Freshness
      </h2>
      <div className="dx-freshchips">
        <span className="dx-freshchip">
          Built <b>{matrix.builtAt}</b>
        </span>
        <span className="dx-freshchip dx-freshchip--age">{relAge(matrix.builtAt)}</span>
        {bcd && (
          <span className="dx-freshchip">
            BCD <b>{bcd.bcdVersion}</b>
          </span>
        )}
        {ci && (
          <span className="dx-freshchip">
            CI run <b>{ci.pulledAt}</b>
          </span>
        )}
        <span className="dx-freshchip">
          <b>{cells.length}</b> cells
        </span>
        <span className="dx-freshchip">
          <b>{features.length}</b> features × <b>{PLATFORM_ORDER.length}</b> platforms
        </span>
      </div>

      <h2 className="dx-h2" id="provenance">
        Provenance
      </h2>
      <p className="dx-p dx-p--muted">
        Every cell is tagged with where it came from. This snapshot's {cells.length} cells break down as:
      </p>
      <div className="dx-freshchips">
        {Object.entries(srcCount)
          .sort((a, b) => b[1] - a[1])
          .map(([src, n]) => (
            <span className="dx-freshchip" key={src}>
              <span className={`dx-cell__src ${SRC_CLASS[src] || 'dx-src-curated'}`}>{SRC_LABEL[src] || src}</span>{' '}
              <b>{n}</b>
            </span>
          ))}
      </div>
      <Callout kind="tip">
        This is the actual file{' '}
        <a href={rawHref} target="_blank" rel="noreferrer">
          <code>{idx.latest.matrix}</code>
        </a>{' '}
        produced by <code>apps/matrix</code> from MDN BCD ({bcd ? bcd.bcdVersion : '—'}) merged with the
        virtual-authenticator CI run ({matrix.inputs?.ci || idx.latest.ci}). Open it — every glyph below comes from{' '}
        <code>cells[]</code>, and unknowns render <strong>?</strong> instead of a fake green.
      </Callout>

      <h2 className="dx-h2" id="legend">
        How to read a cell
      </h2>
      <div className="dx-legend">
        <span>
          <b style={{ color: 'var(--pk-color-success)' }}>✓</b> supported
        </span>
        <span>
          <b style={{ color: 'var(--pk-color-info)' }}>◐</b> partial
        </span>
        <span>
          <b style={{ color: 'var(--pk-color-error)' }}>✕</b> unsupported
        </span>
        <span>
          <b style={{ color: 'var(--pk-color-text-faint)' }}>?</b> unknown
        </span>
        <span>
          <span className="dx-cell__src dx-src-probed">ci</span> virtual-authenticator CI
        </span>
        <span>
          <span className="dx-cell__src dx-src-bcd">bcd</span> MDN BCD
        </span>
        <span>
          <span className="dx-cell__src dx-src-curated">curated</span> cross-referenced
        </span>
      </div>

      <h2 className="dx-h2" id="grid">
        Support grid
      </h2>
      {sel && (
        <Callout kind="note">
          <strong>
            {sel.featureLabel} on {sel.browser} {sel.os}
          </strong>{' '}
          — status <strong>{sel.status}</strong>, source <strong>{sel.source}</strong>
          {sel.since ? `, since ${sel.browser} ${sel.since}` : ''}
          {sel.tier ? ` · ${sel.tier}` : ''}
          {sel.lastVerified ? ` · last verified ${sel.lastVerified}` : ''}.
          {sel.notes ? ` ${sel.notes}.` : ''}
          {sel.sourceUrl ? (
            <>
              {' '}
              <a href={sel.sourceUrl} target="_blank" rel="noreferrer">
                source ↗
              </a>
            </>
          ) : null}
        </Callout>
      )}
      <div className="dx-matrixwrap">
        <table className="dx-matrix">
          <thead>
            <tr>
              <th>Feature</th>
              {PLATFORM_ORDER.map(([, , label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.id} className={KEY_FEATURES.has(f.id) ? 'is-key' : ''}>
                <th title={f.label}>{f.label}</th>
                {PLATFORM_ORDER.map(([browser, os, label]) => {
                  const cell = byKey[`${f.id}|${browser}|${os}`];
                  return (
                    <td key={label}>
                      <Cell cell={cell} onClick={() => cell && setSel(cell)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="dx-h2" id="ci">
        CI grid — combinatorial proof
      </h2>
      {ci ? (
        <>
          <p className="dx-p dx-p--muted">
            runnerOs {ci.runnerOs}
            {ciBrowser ? ` · ${ciBrowser.name} ${ciBrowser.version}` : ''} · {ci.gridResults.length} combinations ·{' '}
            {ci.gridResults.filter((g) => g.verified).length}/{ci.gridResults.length} verified. Each row is a real
            create→get round-trip checked with <code>p256.verify</code>.
          </p>
          <div className="dx-matrixwrap">
            <table className="dx-matrix">
              <thead>
                <tr>
                  <th>transport × residentKey × UV</th>
                  <th>created</th>
                  <th>asserted</th>
                  <th>verified</th>
                  <th>alg</th>
                </tr>
              </thead>
              <tbody>
                {ci.gridResults.map((g, i) => {
                  const mark = (ok) => (
                    <span style={{ color: ok ? 'var(--pk-color-success)' : 'var(--pk-color-error)' }}>
                      {ok ? '✓' : '✕'}
                    </span>
                  );
                  return (
                    <tr key={i}>
                      <th style={{ fontFamily: 'var(--pk-font-mono)', fontWeight: 500 }}>
                        {g.transport} · RK{g.residentKey ? '✓' : '✗'} · UV{g.userVerification ? '✓' : '✗'}
                      </th>
                      <td>{mark(g.created)}</td>
                      <td>{mark(g.asserted)}</td>
                      <td>{mark(g.verified)}</td>
                      <td>
                        <span className="dx-cell__src dx-src-probed">{g.alg ?? '—'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ci.browsers?.some((b) => !b.available) && (
            <Callout kind="warn">
              <strong>Limitations (a trust signal, not a footnote):</strong>{' '}
              {ci.browsers
                .filter((b) => !b.available)
                .map((b) => `${b.name} was not available on this runner`)
                .join('; ')}
              . Those platforms are cross-referenced from BCD, not machine-verified this run. Firefox / WebKit virtual
              authenticators remain out of scope; the CI sweep covers <code>internal</code> + <code>usb</code> transports
              with a deterministic low-S signer (so it does not reproduce Apple's ~50% high-S distribution).
            </Callout>
          )}
        </>
      ) : (
        <Callout kind="note">No CI snapshot in this export yet — run <code>pnpm matrix:ci</code>.</Callout>
      )}
    </>
  );
}
