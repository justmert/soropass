import type { IndexerAdapter } from '../adapters/types';
import { browserWebAuthnClient, defaultCredentialStorage } from './browserClient';
import type { CredentialStorage, WebAuthnClient } from './types';

export interface ConnectOptions {
  rpId: string;
  indexer: IndexerAdapter;
  webauthn?: WebAuthnClient;
  storage?: CredentialStorage;
  /** Override silent-mediation detection (default: probe isConditionalMediationAvailable). */
  silentMediationSupported?: boolean;
  /**
   * SEC-1 (65-byte) public key of this passkey. When set, `connect` returns the
   * account whose factory `deployed` event names this exact key, ignoring any
   * other candidate for the same credential id. Because `deploy` is
   * permissionless, a credential id can resolve to more than one account; pass
   * the founding key (persisted at create time) so a poisoned candidate is never
   * selected. When omitted, `connect` returns the first resolved account and you
   * MUST verify enrollment yourself before trusting it with funds.
   */
  publicKey?: Uint8Array;
}

export interface ConnectResult {
  contractId: string;
  credentialId: string;
}

async function probeConditionalMediation(): Promise<boolean> {
  const pkc = (
    globalThis as {
      PublicKeyCredential?: { isConditionalMediationAvailable?: () => Promise<boolean> };
    }
  ).PublicKeyCredential;
  if (!pkc?.isConditionalMediationAvailable) return false;
  try {
    return await pkc.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

/**
 * `connect` — silent reconnect using the stored credential id. Where conditional
 * mediation is available, does a best-effort `mediation:'silent'` liveness check;
 * the C-address is resolved via the IndexerAdapter regardless, so connect
 * degrades gracefully where silent mediation is unsupported. Returns null when
 * there is no stored credential (the caller should `recover`) or no account.
 */
export async function connect(options: ConnectOptions): Promise<ConnectResult | null> {
  const storage = options.storage ?? defaultCredentialStorage();
  const credentialId = storage.get(options.rpId);
  if (!credentialId) return null;

  const silentSupported = options.silentMediationSupported ?? (await probeConditionalMediation());
  if (silentSupported) {
    const webauthn = options.webauthn ?? browserWebAuthnClient();
    try {
      await webauthn.get({
        rpId: options.rpId,
        allowCredentials: [credentialId],
        mediation: 'silent',
      });
    } catch {
      // A silent get may no-op or reject; resolution is via the indexer.
    }
  }

  const accounts = await options.indexer.resolveByCredential(credentialId);
  const selected = selectAccount(accounts, options.publicKey);
  return selected ? { contractId: selected.contractId, credentialId } : null;
}

/** True if two byte arrays are equal. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Pick the resolved account. With an expected public key, return only the
 * candidate whose factory-reported founding key matches it (poison-resistant);
 * without one, fall back to the first candidate (see the `publicKey` doc on
 * ConnectOptions for why that is a trust decision the caller must back up).
 */
function selectAccount(
  accounts: { contractId: string; publicKey?: Uint8Array }[],
  publicKey?: Uint8Array,
): { contractId: string } | null {
  if (publicKey) {
    const match = accounts.find((a) => a.publicKey && bytesEqual(a.publicKey, publicKey));
    return match ? { contractId: match.contractId } : null;
  }
  return accounts[0] ?? null;
}
