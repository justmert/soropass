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
  const contractId = accounts[0]?.contractId;
  return contractId ? { contractId, credentialId } : null;
}
