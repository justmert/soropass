/* Theming (2G) + Theme Builder */
import { useState, useMemo } from 'react';
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, I, Kw } from '../shell.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [["skins","Skins",0],["builder","Theme builder",0],["tokens","Token reference",0],["gate","The token gate",0]];

const BRANDS = ["oklch(0.55 0.18 264)", "oklch(0.58 0.15 245)", "oklch(0.60 0.12 195)", "oklch(0.55 0.20 300)", "oklch(0.45 0.02 270)"];

function ThemeBuilder() {
  const [skin, setSkin] = useState("light");
  const [brand, setBrand] = useState(BRANDS[0]);
  const [radius, setRadius] = useState(16);
  const [space, setSpace] = useState(24);
  const vars = useMemo(() => ({
    "--pk-color-brand": brand,
    "--pk-color-brand-hover": `color-mix(in oklch, ${brand}, black 14%)`,
    "--pk-color-brand-active": `color-mix(in oklch, ${brand}, black 26%)`,
    "--pk-radius-lg": radius + "px",
    "--pk-radius-md": Math.round(radius * 0.75) + "px",
    "--pk-space-6": space + "px",
    "--pk-space-5": Math.round(space * 0.82) + "px",
  }), [brand, radius, space]);
  const rootBlock = `:root {\n  --pk-color-brand: ${brand};\n  --pk-radius-lg: ${radius}px;\n  --pk-radius-md: ${Math.round(radius*0.75)}px;\n  --pk-space-6: ${space}px;\n}`;
  return (
    <div className="dx-builder">
      <div className="dx-builder__rail">
        <div>
          <p className="dx-runner__label" style={{ marginBottom: 8 }}>Skin</p>
          <div className="dx-fw" style={{ margin: 0 }}>
            {["light", "dark", "teal"].map((s) => <button key={s} className="dx-fw__tab" aria-selected={skin === s} onClick={() => setSkin(s)}>{s}</button>)}
          </div>
        </div>
        <div>
          <p className="dx-runner__label" style={{ marginBottom: 8 }}>Brand accent</p>
          <div className="dx-swatches">
            {BRANDS.map((b) => <button key={b} className="dx-swatch" aria-pressed={brand === b} style={{ background: b }} onClick={() => setBrand(b)} aria-label="accent" />)}
          </div>
        </div>
        <div>
          <p className="dx-runner__label" style={{ marginBottom: 8 }}>Corner radius · {radius}px</p>
          <input className="dx-range" type="range" min="4" max="24" value={radius} onChange={(e) => setRadius(+e.target.value)} />
        </div>
        <div>
          <p className="dx-runner__label" style={{ marginBottom: 8 }}>Density · {space}px</p>
          <input className="dx-range" type="range" min="16" max="36" value={space} onChange={(e) => setSpace(+e.target.value)} />
        </div>
        <CodeGroup tabs={[{ label: ":root override", raw: rootBlock, body: <code>{rootBlock}</code> }]} />
      </div>
      <div className="dx-builder__stage">
        <div className="dx-embed">
          <div className="dx-embed__bar"><span className="dx-embed__dot" /><span className="dx-embed__dot" /><span className="dx-embed__dot" /><span className="dx-embed__url">themed preview</span></div>
          <div className="dx-embed__body pk" data-theme={skin} style={vars}><RealScreen screen="create" state="success" /></div>
        </div>
      </div>
    </div>
  );
}

const TOKENS = [
  ["Color", "--pk-color-brand / -hover / -active / -on-brand / -soft", "Primary button, focus, accents"],
  ["Color", "--pk-color-background / -surface / -surface-sunken", "Page, card, wells"],
  ["Color", "--pk-color-text / -muted / -faint", "Text scale"],
  ["Color", "--pk-color-border / -border-strong", "Hairlines, inputs"],
  ["Status", "--pk-color-success / -error / -info (+ -soft)", "Distinct: errors assertive, progress calm"],
  ["Shape", "--pk-radius-none … -full", "Corner scale"],
  ["Space", "--pk-space-0 … -10", "Spacing scale"],
  ["Type", "--pk-font-sans / -mono, --pk-text-xs … -xl, --pk-weight-*", "Family, size, weight, leading"],
  ["Focus", "--pk-focus-color / -width / -offset / -halo", "Visible focus ring"],
  ["Busy", "--pk-busy-opacity, --pk-scrim, --pk-disabled-opacity", "OS-sheet dim + scrim"],
  ["Spinner", "--pk-spinner-* , --pk-progress-* (--pk-progress-duration 1400ms)", "We're-working looks"],
  ["Elevation", "--pk-shadow-sm/md/lg, --pk-z-card/overlay/toast", "Layers under the OS sheet"],
  ["Motion", "--pk-ease, --pk-duration-fast/base/slow, --pk-pulse-duration", "Transitions + reduced-motion fallback"],
];

export default function Theming() {
  return (
    <DocsPage active="Theming" toc={TOC}>
      <div className="dx-breadcrumb">Guides <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Theming</span></div>
      <h1 className="dx-h1">Theming</h1>
      <p className="dx-lead">One OKLCH token file is the only styling surface. Pick a skin, override tokens, done — the components never change.</p>

      <h2 className="dx-h2" id="skins">Skins</h2>
      <p className="dx-p">Three skins ship by default. Set <code>[data-theme]</code> on any wrapping element; dark and teal override only the values that change.</p>
      <CodeGroup tabs={[{ label: "html", raw: '<div data-theme="dark"> … </div>', body: <code>&lt;{Kw("div")} data-theme={St2('"dark"')}&gt; … &lt;/{Kw("div")}&gt;</code> }]} />

      <h2 className="dx-h2" id="builder">Theme builder</h2>
      <p className="dx-p dx-p--muted">Tweak the axes — the real component re-themes live, and the <code>:root</code> block updates to paste into your app.</p>
      <ThemeBuilder />

      <h2 className="dx-h2" id="tokens">Token reference</h2>
      <p className="dx-p dx-p--muted">~70 tokens across these groups. The shipped <code>tokens.css</code> is canonical (note <code>--pk-progress-duration: 1400ms</code>).</p>
      <PropsTable cols={["Group", "Tokens", "Purpose"]} rows={TOKENS.map(([g, t, p]) => [g, <span className="t-type">{t}</span>, p])} />

      <h2 className="dx-h2" id="gate">The token gate</h2>
      <Callout kind="tip">A machine-enforced CI gate means <code>passkey.css</code> references only <code>var()</code> tokens — restyle the whole set by overriding tokens, never by editing components.</Callout>

      <PageNav prev={["KitError taxonomy", "/sdk/errors"]} next={["Examples", "/examples"]} />
    </DocsPage>
  );
}
const St2 = (s) => <span className="c-str">{s}</span>;
