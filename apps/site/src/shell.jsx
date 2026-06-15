/* ============================================================================
   Soropass — DOCS SHELL (shared chrome + primitives).
   ES module: pages `import { DocsPage, Callout, ... } from '../shell'`.
   Token-driven. Internal nav uses react-router <Link>.
   ========================================================================== */
import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as PKI from './icons.jsx';

const Svg = (p) => (
  <svg
    viewBox="0 0 24 24"
    width={p.s || 18}
    height={p.s || 18}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {p.children}
  </svg>
);
export const I = {
  Sun: () => (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </Svg>
  ),
  Moon: () => (
    <Svg>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </Svg>
  ),
  Search: () => (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </Svg>
  ),
  Git: () => (
    <Svg s={16}>
      <path d="M9 19c-4 1.4-4-2.2-5.6-2.6M15 21v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C3.9 1.8 2.9 2.1 2.9 2.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 1.5 8.5c0 4.6 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2V21" />
    </Svg>
  ),
  Rocket: () => (
    <Svg s={15}>
      <path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z" />
      <path d="M9 13l-2-2c1-4 4-8 9-8 0 5-4 8-8 9z" />
      <circle cx="14" cy="8" r="1.3" />
    </Svg>
  ),
  Cube: () => (
    <Svg s={13}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </Svg>
  ),
  Layers: () => (
    <Svg s={13}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </Svg>
  ),
  Book: () => (
    <Svg s={13}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M19 17H6a2 2 0 0 0-2 2" />
    </Svg>
  ),
  Flag: () => (
    <Svg s={13}>
      <path d="M5 21V4M5 4h11l-1.5 3L16 10H5" />
    </Svg>
  ),
  Ok: (p) => (
    <Svg s={(p && p.s) || 17}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  ),
  Copy: () => (
    <Svg s={15}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </Svg>
  ),
  ChevR: () => (
    <Svg s={14}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  Prev: () => (
    <Svg s={16}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  ),
  Next: () => (
    <Svg s={16}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  Info: () => (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.1" />
    </Svg>
  ),
  Bulb: () => (
    <Svg>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.3-1 2.5H9c0-1.2-.4-1.9-1-2.5A6 6 0 0 1 12 3z" />
    </Svg>
  ),
  Warn: () => (
    <Svg>
      <path d="M12 3l9.5 16.5H2.5z" />
      <path d="M12 10v4M12 17v.1" />
    </Svg>
  ),
  Play: () => (
    <Svg>
      <path d="M7 5l11 7-11 7z" />
    </Svg>
  ),
};

export function useCopy() {
  const [c, setC] = useState(false);
  return [
    c,
    useCallback((t) => {
      try {
        navigator.clipboard?.writeText(t);
      } catch (e) {
        /* ignore */
      }
      setC(true);
      setTimeout(() => setC(false), 1400);
    }, []),
  ];
}

/* ---- theme ------------------------------------------------------------- */
export function useTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    let t = 'light';
    try {
      const s = localStorage.getItem('pk-landing-theme');
      if (s === 'dark' || s === 'light') t = s;
    } catch (e) {
      /* ignore */
    }
    setTheme(t);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pk-landing-theme', theme);
    } catch (e) {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}
export function ThemeToggle({ theme, setTheme }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="dx-themetoggle__btn dx-themetoggle__solo"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <I.Sun /> : <I.Moon />}
    </button>
  );
}

// External links.
const GITHUB_URL = 'https://github.com/justmert/soropass';
const DEMO_URL = 'https://demo.soropass.dev';

/* Official GitHub mark (filled). */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.02-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function TopBar({ theme, setTheme }) {
  return (
    <div className="dx-top">
      <div className="dx-top__inner">
      <Link className="dx-brand" to="/">
        <span className="dx-brand__glyph">
          <PKI.IconPasskey size={18} />
        </span>
        <span className="dx-brand__mono">soropass</span>
      </Link>
      <div className="dx-top__search">
        <I.Search /> Search docs… <kbd>⌘K</kbd>
      </div>
      <div className="dx-top__right">
        <Link className="dx-toplink" to="/components">
          Components
        </Link>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <a className="dx-toplink" aria-label="GitHub" href={GITHUB_URL} target="_blank" rel="noreferrer">
          <GitHubMark />
        </a>
        <Link className="dx-btn dx-btn--primary" to="/quickstart">
          <I.Rocket /> Quickstart
        </Link>
        <a className="dx-btn dx-btn--secondary" href={DEMO_URL} target="_blank" rel="noreferrer">
          <I.Play /> Launch demo
        </a>
      </div>
      </div>
    </div>
  );
}

/* ---- sidebar (active by page name) ------------------------------------ */
const NAV = [
  {
    label: 'Get started',
    icon: <I.Book />,
    items: [
      ['Overview', '/'],
      ['Quickstart', '/quickstart'],
    ],
  },
  {
    label: 'Components',
    icon: <I.Cube />,
    items: [
      ['Overview', '/components'],
      ['Create', '/components/create'],
      ['Sign', '/components/sign'],
      ['Recover', '/components/recover'],
      ['Connect & Add device', '/components/connect'],
      ['Primitives', '/components/primitives'],
      ['Theming', '/theming'],
    ],
  },
  {
    label: 'SDK',
    icon: <I.Layers />,
    items: [
      ['Overview', '/sdk'],
      ['Create', '/sdk/create'],
      ['Sign', '/sdk/sign'],
      ['Recover & Connect', '/sdk/recover'],
      ['Adapters', '/sdk/adapters'],
      ['KitError taxonomy', '/sdk/errors'],
    ],
  },
  {
    label: 'Reference',
    icon: <I.Flag />,
    items: [
      ['Compatibility', '/compatibility'],
      ['How it works', '/how-it-works'],
      ['Security', '/security'],
    ],
  },
];
export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="dx-side">
      {NAV.map((g, gi) => (
        <div className="dx-navgroup" key={g.label}>
          <p className="dx-navgroup__label">
            {g.icon}
            {g.label}
          </p>
          {gi === 2 && <div className="dx-sep" />}
          {g.items.map(([name, href]) => (
            <Link className={`dx-navitem ${href === pathname ? 'is-active' : ''}`} key={name + href} to={href}>
              {name}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}

/* ---- code / callout / table / toc / pagenav --------------------------- */
export const Cm = (s) => <span className="c-com">{s}</span>;
export const Kw = (s) => <span className="c-key">{s}</span>;
export const St = (s) => <span className="c-str">{s}</span>;
export const Fn = (s) => <span className="c-fn">{s}</span>;

export function CodeGroup({ tabs }) {
  const [i, setI] = useState(0);
  const [copied, copy] = useCopy();
  return (
    <div className="dx-codegroup">
      {tabs.length > 1 && (
        <div className="dx-codegroup__bar" role="tablist">
          {tabs.map((t, idx) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === idx}
              className="dx-codegroup__tab"
              onClick={() => setI(idx)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <pre className="dx-code">
        {tabs[i].body}
        <button
          className={`dx-code__copy ${copied ? 'is-copied' : ''}`}
          onClick={() => copy(tabs[i].raw)}
          aria-label="Copy code"
        >
          {copied ? <I.Ok s={15} /> : <I.Copy />}
        </button>
      </pre>
    </div>
  );
}
export function Callout({ kind = 'note', children }) {
  const icon = kind === 'tip' ? <I.Bulb /> : kind === 'warn' ? <I.Warn /> : <I.Info />;
  return (
    <div className={`dx-callout dx-callout--${kind}`}>
      {icon}
      <p>{children}</p>
    </div>
  );
}
export function PropsTable({ cols, rows }) {
  return (
    <table className="dx-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function Toc({ items }) {
  const [active, setActive] = useState(items[0] && items[0][0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-72px 0px -70% 0px' },
    );
    items.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <nav className="dx-toc">
      <p className="dx-toc__label">On this page</p>
      {items.map(([id, label, sub]) => (
        <a
          key={id}
          className={`dx-toc__link ${sub ? 'dx-toc__link--sub' : ''} ${active === id ? 'is-active' : ''}`}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
export function PageNav({ prev, next }) {
  return (
    <div className="dx-pagenav">
      {prev ? (
        <Link to={prev[1]}>
          <span>Previous</span>
          <strong>← {prev[0]}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="is-next" to={next[1]}>
          <span>Next</span>
          <strong>{next[0]} →</strong>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

/* Page wrapper: handles theme + shell layout. `toc` optional. */
export function DocsPage({ active, toc, children }) {
  const [theme, setTheme] = useTheme();
  return (
    <div className="dx">
      <TopBar theme={theme} setTheme={setTheme} />
      <div className="dx-shell">
        <Sidebar active={active} />
        <main className="dx-main">{children}</main>
        {toc ? <Toc items={toc} /> : <div />}
      </div>
    </div>
  );
}

export function Badge({ kind, children }) {
  return <span className={`dx-badge dx-badge--${kind}`}>{children}</span>;
}

/* ---- Feature grid (icon + title + body cards) ------------------------- */
export function FeatureGrid({ items }) {
  return (
    <div className="dx-featgrid">
      {items.map(([icon, title, body], i) => (
        <div className="dx-feat" key={i}>
          <span className="dx-feat__ic">{icon}</span>
          <p className="dx-feat__t">{title}</p>
          <p className="dx-feat__b">{body}</p>
        </div>
      ))}
    </div>
  );
}

/* ---- Use-case cards (numbered) ---------------------------------------- */
export function UseCases({ items }) {
  return (
    <div className="dx-usecases">
      {items.map(([title, body], i) => (
        <div className="dx-usecase" key={i}>
          <span className="dx-usecase__n">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <p className="dx-usecase__t">{title}</p>
            <p className="dx-usecase__b">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
