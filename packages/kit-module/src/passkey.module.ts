import {
  browserWebAuthnClient,
  connect,
  createPasskey,
  decodeChallenge,
  defaultCredentialStorage,
  deriveAccountAddress,
  deriveSmartWalletAddress,
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
  WalletTarget,
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
  /**
   * The AccountFactory C-address (our single-signer webauthn-account). When set,
   * `getAddress` derives the address deterministically from `sha256(utf8(credentialId))`.
   */
  factoryContractId?: string;
  /**
   * SEC-1 (65-byte) public key of the founding passkey, for offline single-signer
   * `getAddress` with `factoryContractId`. The v0.2 factory binds the key into the
   * deploy salt (F1), so the address cannot be derived from the credential id
   * alone. When omitted and no account was created this session, `getAddress`
   * resolves through `connect` + the indexer instead.
   */
  foundingPublicKey?: Uint8Array;
  /**
   * The deployer account for a passkey-kit **v1 smart-wallet**. When set,
   * `getAddress` derives the address offline via `sha256(rawCredentialId)` (the v1
   * scheme). Pair with `walletTarget: 'smart-wallet'` so signatures use the v1 map,
   * a `smartWalletV1Deployer` for `deployer`, and a `smartWalletV1Indexer` for `indexer`.
   */
  smartWalletDeployer?: string;
  /**
   * Which contract ABI to sign for: `single-signer` (our webauthn-account, the
   * default) or `smart-wallet` (passkey-kit v1). Set `smart-wallet` for v1 wallets.
   */
  walletTarget?: WalletTarget;
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
  private currentPublicKey: Uint8Array | null = null;
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
    this.currentPublicKey = result.publicKey;
    return result;
  }

  /**
   * Returns the connected smart-account C-address. When `factoryContractId` is
   * configured and a credential id is known, it derives the address
   * deterministically (no deploy, no indexer round-trip); otherwise it resolves
   * via a silent `connect` + the IndexerAdapter.
   */
  async getAddress(): Promise<{ address: string }> {
    if (this.currentAddress) return { address: this.currentAddress };

    const credentialId = this.resolveCredentialId();

    // v1 smart-wallet: derive offline from the deployer + sha256(rawCredentialId).
    if (this.options.smartWalletDeployer && credentialId) {
      const address = deriveSmartWalletAddress({
        deployer: this.options.smartWalletDeployer,
        credentialId,
        networkPassphrase: this.options.networkPassphrase,
      });
      this.currentAddress = address;
      this.currentCredentialId = credentialId;
      return { address };
    }

    // Single-signer factory: mirror the factory's on-chain salt,
    // sha256(utf8(base64url credential id) ‖ public_key). The founding key is
    // required (F1); when it is unknown this session, fall through to connect.
    const foundingKey = this.currentPublicKey ?? this.options.foundingPublicKey;
    if (this.options.factoryContractId && credentialId && foundingKey) {
      const address = deriveAccountAddress({
        factoryContractId: this.options.factoryContractId,
        credentialId: new TextEncoder().encode(credentialId),
        publicKey: foundingKey,
        networkPassphrase: this.options.networkPassphrase,
      });
      this.currentAddress = address;
      this.currentCredentialId = credentialId;
      return { address };
    }

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

  /** Known credential id: the in-session one, else the per-rpId stored one. */
  private resolveCredentialId(): string | null {
    if (this.currentCredentialId) return this.currentCredentialId;
    try {
      const storage = this.options.storage ?? defaultCredentialStorage();
      return storage.get(this.options.rpId);
    } catch {
      return null;
    }
  }

  async signTransaction(
    xdr: string,
    opts?: SignOpts,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    const signedTxXdr = await coreSignTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? this.options.networkPassphrase,
      sign: this.signer,
      target: this.options.walletTarget,
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
      target: this.options.walletTarget,
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
