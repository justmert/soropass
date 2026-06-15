import {
  browserWebAuthnClient,
  connect,
  createPasskey,
  decodeChallenge,
  derToCompactLowS,
  encodeChallenge,
  normalizeLowS,
  signAuthEntry as coreSignAuthEntry,
  signTransaction as coreSignTransaction,
} from '@soropass/core';
import type {
  AccountDeployer,
  CredentialStorage,
  IndexerAdapter,
  PasskeyCredential,
  WebAuthnClient,
  WebAuthnSigner,
} from '@soropass/core';
import { ModuleType, type ModuleInterface } from './kitTypes';

export const PASSKEY_ID = 'passkey';
const IS_AVAILABLE_BUDGET_MS = 500;

export interface PasskeyModuleOptions {
  rpId: string;
  rpName?: string;
  networkPassphrase: string;
  network?: string;
  indexer: IndexerAdapter;
  deployer: AccountDeployer;
  /** WebAuthn signer for signTransaction/signAuthEntry; default builds one from `webauthn`. */
  signer?: WebAuthnSigner;
  /** WebAuthn client for create/connect; default `browserWebAuthnClient()` (lazy). */
  webauthn?: WebAuthnClient;
  storage?: CredentialStorage;
  productUrl?: string;
  productIcon?: string;
}

type SignOpts = { networkPassphrase?: string; address?: string; path?: string };

/**
 * `PasskeyModule` for `@creit.tech/stellar-wallets-kit` v2.2.0 — a thin adapter
 * that wires the kit's `ModuleInterface` onto `@soropass/core` ceremonies
 * (S11/S13). No crypto/logic is duplicated here. Drop-in for the kit's
 * `src/sdk/modules/` (upstream PR, S27).
 */
export class PasskeyModule implements ModuleInterface {
  readonly moduleType = ModuleType.HOT_WALLET;
  readonly productId = PASSKEY_ID;
  readonly productName = 'Passkey (Smart Account)';
  readonly productUrl: string;
  readonly productIcon: string;

  private cachedWebauthn?: WebAuthnClient;
  private cachedSigner?: WebAuthnSigner;
  private currentAddress: string | null = null;
  private currentCredentialId: string | null = null;

  constructor(private readonly options: PasskeyModuleOptions) {
    this.productUrl = options.productUrl ?? 'https://github.com/Creit-Tech/Stellar-Wallets-Kit';
    this.productIcon = options.productIcon ?? 'https://stellar.creit.tech/wallet-icons/passkey.png';
  }

  private get webauthn(): WebAuthnClient {
    return (this.cachedWebauthn ??= this.options.webauthn ?? browserWebAuthnClient());
  }
  private get signer(): WebAuthnSigner {
    return (this.cachedSigner ??= this.options.signer ?? this.buildSigner());
  }
  private buildSigner(): WebAuthnSigner {
    return async (challenge: string) => {
      const assertion = await this.webauthn.get({
        rpId: this.options.rpId,
        challenge: decodeChallenge(challenge),
        allowCredentials: this.currentCredentialId ? [this.currentCredentialId] : [],
      });
      return {
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        signature: assertion.signature,
        credentialId: decodeChallenge(assertion.id),
      };
    };
  }

  /** isUVPAA within a 500 ms budget; returns false (never throws) when unsupported. */
  async isAvailable(): Promise<boolean> {
    const pkc = (
      globalThis as {
        PublicKeyCredential?: {
          isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
        };
      }
    ).PublicKeyCredential;
    if (!pkc?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    try {
      return await Promise.race([
        pkc.isUserVerifyingPlatformAuthenticatorAvailable(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), IS_AVAILABLE_BUDGET_MS)),
      ]);
    } catch {
      return false;
    }
  }

  /** Create a new passkey smart account (beyond ModuleInterface; used by the create flow). */
  async createAccount(userName = 'user'): Promise<PasskeyCredential> {
    const result = await createPasskey({
      rpId: this.options.rpId,
      rpName: this.options.rpName ?? this.options.rpId,
      userName,
      deployer: this.options.deployer,
      webauthn: this.webauthn,
      storage: this.options.storage,
    });
    this.currentAddress = result.contractId;
    this.currentCredentialId = result.credentialId;
    return result;
  }

  /** Returns the connected smart-account C-address (connects via the IndexerAdapter if needed). */
  async getAddress(): Promise<{ address: string }> {
    if (this.currentAddress) return { address: this.currentAddress };
    const connected = await connect({
      rpId: this.options.rpId,
      indexer: this.options.indexer,
      webauthn: this.webauthn,
      storage: this.options.storage,
    });
    if (!connected) {
      throw new Error('No passkey account connected; create one first via createAccount().');
    }
    this.currentAddress = connected.contractId;
    this.currentCredentialId = connected.credentialId;
    return { address: connected.contractId };
  }

  async signTransaction(
    xdr: string,
    opts?: SignOpts,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    const signedTxXdr = await coreSignTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? this.options.networkPassphrase,
      sign: this.signer,
    });
    return { signedTxXdr, signerAddress: opts?.address ?? this.currentAddress ?? undefined };
  }

  async signAuthEntry(
    authEntry: string,
    opts?: SignOpts,
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
    const signedAuthEntry = await coreSignAuthEntry(authEntry, {
      networkPassphrase: opts?.networkPassphrase ?? this.options.networkPassphrase,
      sign: this.signer,
    });
    return { signedAuthEntry, signerAddress: opts?.address ?? this.currentAddress ?? undefined };
  }

  /**
   * Smart accounts have no standardized on-chain message-verification scheme
   * (integration doc, open Q2). We return the low-S WebAuthn assertion signature
   * (base64url); verification is application-defined for now.
   */
  async signMessage(
    message: string,
    opts?: SignOpts,
  ): Promise<{ signedMessage: string; signerAddress?: string }> {
    const challenge = encodeChallenge(new TextEncoder().encode(message));
    const assertion = await this.signer(challenge);
    const compact =
      assertion.signature.length === 64
        ? normalizeLowS(assertion.signature)
        : derToCompactLowS(assertion.signature);
    return {
      signedMessage: encodeChallenge(compact),
      signerAddress: opts?.address ?? this.currentAddress ?? undefined,
    };
  }

  getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return Promise.resolve({
      network: this.options.network ?? 'TESTNET',
      networkPassphrase: this.options.networkPassphrase,
    });
  }
}
