/* KitError taxonomy — the SDK's error model. */
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, I, Cm, Kw, St, Fn } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [
  ['shape', 'KitError shape', 0],
  ['guard', 'Guard pattern', 0],
  ['table', 'The 10 codes', 0],
  ['copy', 'Styled copy', 0],
];

// code · when it's thrown · which SDK area throws it · styled UI copy · recovery
const CODES = [
  ['USER_CANCELLED', 'User dismissed the OS passkey sheet', 'assertUserActivation / ceremony', 'You closed the passkey prompt before it finished.', 'Try again'],
  ['UNSUPPORTED_AUTHENTICATOR', "Device/passkey can't be used", 'create / sign / recover (fallback)', "This device or passkey can't be used — try another.", 'Try again'],
  ['ES256_NOT_SUPPORTED', 'Non-P256 key at creation (alg ≠ −7)', 'assertES256 / coseKeyToSec1', "This passkey isn't supported for on-chain accounts.", 'Try again'],
  ['INVALID_PUBLIC_KEY', "COSE key couldn't be read", 'coseKeyToSec1 / extractPublicKey*', "We couldn't read the key from this passkey.", 'Try again'],
  ['INVALID_SIGNATURE_DER', 'Malformed / >72-byte DER signature', 'derToCompact', 'There was a problem with the signature.', 'Try again'],
  ['RP_ID_MISMATCH', 'rpIdHash ≠ expected origin', 'verifyRpIdHash', "Couldn't verify this request — it may have changed.", 'Try again'],
  ['ORIGIN_MISMATCH', 'clientDataJSON origin mismatch', 'verifyClientDataJSON', "Couldn't verify this request — it may have changed.", 'Try again'],
  ['CHALLENGE_MISMATCH', 'Challenge changed or expired', 'verifyClientDataJSON', "Couldn't verify this request — it may have expired.", 'Try again'],
  ['CONTRACT_AUTH_FAILED', '__check_auth rejected on-chain', 'signTransaction / deploy', "Couldn't set up / authorize the account.", 'Try again'],
  ['NETWORK_ERROR', 'RPC / network unreachable', 'submission / indexer', "We couldn't reach the network.", 'Retry'],
];

export default function KitErrors() {
  return (
    <DocsPage active="KitError taxonomy" toc={TOC}>
      <div className="dx-breadcrumb">
        SDK reference <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>KitError taxonomy</span>
      </div>
      <h1 className="dx-h1">
        <span className="dx-h1__glyph">
          <PKIErr />
        </span>{' '}
        KitError taxonomy
      </h1>
      <p className="dx-lead">
        One frozen 10-code taxonomy drives every failure path — and the single styled error layout, with copy swapped by
        code. Every throw in the SDK is a typed <code>KitError</code>, never a bare string.
      </p>

      <h2 className="dx-h2" id="shape">
        KitError shape
      </h2>
      <p className="dx-p">
        <code>KitError</code> extends <code>Error</code> with a typed, exhaustive <code>code</code>. The 10 codes live in
        the frozen <code>KIT_ERROR_CODES</code> tuple, and <code>isKitError</code> is the type guard. All three come from{' '}
        <code>@soropass/core/types</code> (≈182 B gzipped).
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'types',
            raw: "import { KitError, KIT_ERROR_CODES, isKitError } from '@soropass/core/types';\nimport type { KitErrorCode } from '@soropass/core/types';\n\nclass KitError extends Error {\n  readonly code: KitErrorCode;   // one of KIT_ERROR_CODES\n  readonly cause?: unknown;      // the underlying error, when wrapped\n}",
            body: (
              <code>
                {Kw('import')} {'{ KitError, KIT_ERROR_CODES, isKitError }'} {Kw('from')} {St("'@soropass/core/types'")};
                {'\n'}
                {Kw('import type')} {'{ KitErrorCode }'} {Kw('from')} {St("'@soropass/core/types'")};{'\n\n'}
                {Kw('class')} {Fn('KitError')} {Kw('extends')} {Fn('Error')} {'{'}
                {'\n'} {Kw('readonly')} code: KitErrorCode; {Cm('// one of KIT_ERROR_CODES')}
                {'\n'} {Kw('readonly')} cause?: unknown; {Cm('// the underlying error, when wrapped')}
                {'\n'}
                {'}'}
              </code>
            ),
          },
        ]}
      />

      <h2 className="dx-h2" id="guard">
        Guard pattern
      </h2>
      <CodeGroup
        tabs={[
          {
            label: 'guard.ts',
            raw: "import { isKitError } from '@soropass/core/types';\n\nif (isKitError(err)) {\n  switch (err.code) {\n    case 'USER_CANCELLED': return retry();\n    case 'NETWORK_ERROR': return retry();\n    // …exhaustive over KIT_ERROR_CODES\n  }\n}",
            body: (
              <code>
                {Kw('import')} {'{ isKitError }'} {Kw('from')} {St("'@soropass/core/types'")};{'\n\n'}
                {Kw('if')} ({Fn('isKitError')}(err)) {'{'}
                {'\n'} {Kw('switch')} (err.code) {'{'}
                {'\n'} {Kw('case')} {St("'USER_CANCELLED'")}: {Kw('return')} {Fn('retry')}();{'\n'} {Kw('case')}{' '}
                {St("'NETWORK_ERROR'")}: {Kw('return')} {Fn('retry')}();{'\n'} {Cm('// …exhaustive over KIT_ERROR_CODES')}
                {'\n'} {'}'}
                {'\n'}
                {'}'}
              </code>
            ),
          },
        ]}
      />
      <Callout kind="note">
        The taxonomy is frozen with <code>Object.freeze</code> — <code>KIT_ERROR_CODES</code> is exhaustively
        switchable, so the compiler catches a missing case when you add handling.
      </Callout>

      <h2 className="dx-h2" id="table">
        The 10 codes
      </h2>
      <PropsTable
        cols={['Code', 'When thrown', 'Thrown by', 'Styled UI copy', 'Recovery']}
        rows={CODES.map(([c, w, by, m, a]) => [
          <code key={c}>{c}</code>,
          w,
          <span style={{ fontFamily: 'var(--pk-font-mono)', fontSize: 12.5, color: 'var(--pk-color-text-muted)' }}>{by}</span>,
          <span style={{ color: 'var(--pk-color-text-muted)' }}>{m}</span>,
          a,
        ])}
      />

      <h2 className="dx-h2" id="copy">
        From code to styled copy
      </h2>
      <p className="dx-p">
        The headless layer surfaces a screen-agnostic <code>KitErrorCode</code>; the styled layer's error connector maps{' '}
        <code>(screen, code)</code> → a screen-scoped copy key (e.g. <code>create:cancelled</code>, <code>sign:verify</code>)
        so the same 10 codes read naturally on each screen. One layout, copy swapped by code — see it live on the{' '}
        <a href="/components/sign">Sign</a> and <a href="/components/create">Create</a> state galleries.
      </p>
      <Callout kind="tip">
        Unknown or unmapped codes fall back to the screen's <code>*:unsupported</code> message — a safe, device-level
        line — never a blank or a stack trace.
      </Callout>

      <PageNav prev={['Adapters', '/sdk/adapters']} next={['Compatibility', '/compatibility']} />
    </DocsPage>
  );
}
function PKIErr() {
  return PKI.IconAlert({ size: 25 });
}
