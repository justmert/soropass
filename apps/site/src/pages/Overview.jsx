/* Components Overview */
import { DocsPage, PageNav, FeatureGrid, I } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [["screens","Screens",0],["additions","Also included",0],["primitives","Primitives",0],["included","What's included",0]];

export default function Overview() {
  return (
    <DocsPage active="Overview" toc={TOC}>
      <div className="dx-breadcrumb">Components <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Overview</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconPasskey /></span> Components</h1>
      <p className="dx-lead">Drop-in, token-driven create / sign / recover screens for Stellar smart-account passkeys — framework-agnostic vanilla DOM today, wired through Stellar Wallets Kit.</p>

      <h2 className="dx-h2" id="screens">Screens</h2>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[["Create", <PKI.IconPasskey />, "5 states", "New wallet from a passkey; deploys a smart account.", "/components/create"],
          ["Sign", <PKI.IconShield />, "5 states", "Approve a host-supplied transaction with the passkey.", "/components/sign"],
          ["Recover", <PKI.IconKey />, "6 states", "Find the accounts a passkey controls on a new device.", "/components/recover"]].map(([t, ic, meta, body, href]) => (
          <a className="dx-card" href={href} key={t}>
            <span className="dx-card__icon">{ic}</span>
            <p className="dx-card__title">{t} <span className="dx-card__meta">{meta}</span></p>
            <p className="dx-card__body">{body}</p>
          </a>
        ))}
      </div>

      <h2 className="dx-h2" id="additions">Also included</h2>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[["Connect", <PKI.IconPasskey />, "chooser", "One entry point that forks create-vs-recover.", "/components/connect"],
          ["Add backup passkey", <PKI.IconPlus />, "5 states", "Enroll a new passkey as an additional signer.", "/components/connect"],
          ["Funding", <PKI.IconShield />, "in Create", "Sponsor a zero-balance new account.", "/components/connect"]].map(([t, ic, meta, body, href]) => (
          <a className="dx-card" href={href} key={t}>
            <span className="dx-card__icon">{ic}</span>
            <p className="dx-card__title">{t} <span className="dx-card__meta">{meta}</span></p>
            <p className="dx-card__body">{body}</p>
          </a>
        ))}
      </div>

      <h2 className="dx-h2" id="primitives">Primitives</h2>
      <p className="dx-p dx-p--muted">The building blocks the screens compose from — all token-driven.</p>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[["Card", "Shell · max-width 384px · is-waiting"], ["Button", "primary / secondary / ghost"], ["AddressChip", "identicon + truncate + copy"], ["TxSummary", "host-supplied amount / dest / action"], ["RecoverList", "listbox + roving focus"], ["WaitOverlay / WorkBlock", "the two busy looks"]].map(([t, d]) => (
          <a className="dx-card" href="/components/primitives" key={t}><p className="dx-card__title">{t}</p><p className="dx-card__body">{d}</p></a>
        ))}
      </div>

      <h2 className="dx-h2" id="included">What's included</h2>
      <FeatureGrid items={[
        [<PKI.IconPasskey />, "Three core screens", "Create, Sign, and Recover — sixteen states in total, every one designed, accessible, and themeable."],
        [<PKI.IconShield />, "Complete primitive set", "Card, Button, AddressChip, Identicon, TxSummary, the listbox, and both busy overlays — all token-driven."],
        [<PKI.IconRefresh />, "One token system", "Light and dark from a single set of OKLCH custom properties, plus RTL and a reduced-motion variant."],
        [<PKI.IconAlert />, "Typed error layout", "A single error view wired to the frozen 10-code KitError taxonomy, with friendly copy per code."],
        [<PKI.IconKey />, "Stellar Wallets Kit module", "A PasskeyModule that registers passkey as a first-class option in the kit's wallet picker."],
        [<PKI.IconCopy />, "Headless or styled", "Use the styled screens, or drive your own UI from the headless flow controllers — your call."],
      ]} />

      <PageNav prev={["Quickstart", "/quickstart"]} next={["Create", "/components/create"]} />
    </DocsPage>
  );
}
