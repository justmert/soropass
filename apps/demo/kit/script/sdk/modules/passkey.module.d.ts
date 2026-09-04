import type { AccountDeployer, CredentialStorage, IndexerAdapter, PasskeyCredential, WebAuthnClient, WebAuthnSigner } from "@soropass/core";
import { type ModuleInterface, ModuleType } from "../../types/mod.js";
/**
 * A passkey wallet: a Soroban smart account (a C-address) authorized by a WebAuthn
 * secp256r1 signature that the account contract's `__check_auth` verifies on-chain.
 * There is no extension to install and no seed phrase; the key lives in the platform
 * authenticator (Touch ID, Windows Hello, Android biometrics).
 *
 * The WebAuthn ceremony, ES256 enforcement, DER to compact low-S conversion, and
 * Soroban auth-entry assembly come from `@soropass/core`; this module maps them onto
 * the kit's `ModuleInterface`.
 *
 * The account verifies each assertion against the enrolled SEC-1 public key, and the
 * factory salts the account address by that key. A WebAuthn assertion does not return
 * the public key, so the module captures it at create time, persists it beside the
 * credential id, and re-fetches it from the factory event on a returning device.
 *
 * Accounts deploy through an AccountFactory contract. `@soropass/core` ships a
 * permissionless factory on testnet and mainnet and uses it whenever `factoryContractId`
 * is omitted, here and in its `factoryDeployer` and `eventsIndexer` adapters.
 *
 * Requirements: `@stellar/stellar-sdk` 17 or newer and a secure context (https or
 * localhost), since WebAuthn is unavailable over plain http.
 *
 * Configuration is required, so this module is not part of `defaultModules()`:
 *
 * ```typescript
 * import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
 * import { PasskeyModule } from "@creit.tech/stellar-wallets-kit/modules/passkey";
 * import { eventsIndexer, factoryDeployer } from "@soropass/core";
 *
 * const rpcUrl = "https://soroban-testnet.stellar.org";
 * StellarWalletsKit.init({
 *   network: Networks.TESTNET,
 *   modules: [
 *     ...defaultModules(),
 *     new PasskeyModule({
 *       rpId: globalThis.location.hostname,
 *       networkPassphrase: Networks.TESTNET,
 *       // Pays the one-time deploy fee for a new account (a sponsor account or relayer).
 *       deployer: factoryDeployer({ rpcUrl, networkPassphrase: Networks.TESTNET, sourceSecret }),
 *       // Resolves a returning user's credential to their account on a new device.
 *       indexer: eventsIndexer({ rpcUrl }),
 *     }),
 *   ],
 * });
 * ```
 */
export declare const PASSKEY_ID: string;
/** Which on-chain account ABI the assembled signature targets. */
export type PasskeyWalletTarget = "single-signer" | "smart-wallet";
export interface PasskeyModuleParams {
    /**
     * The WebAuthn Relying Party ID: the registrable domain the passkey is bound to,
     * for example `example.org` (it must be the current domain or a parent of it).
     */
    rpId: string;
    /** Human-readable RP name shown in the OS passkey sheet. Defaults to `rpId`. */
    rpName?: string;
    /** The network the assembled auth entries are bound to. */
    networkPassphrase: string;
    /** Human-readable network name returned by `getNetwork`. Defaults to `"TESTNET"`. */
    network?: string;
    /**
     * The AccountFactory C-address the accounts deploy through. With it and the persisted
     * public key, `getAddress` derives a returning device's account address offline, with
     * no indexer and no deploy round-trip. Defaults to the `@soropass/core` factory for
     * `networkPassphrase` (testnet and mainnet). Set it when your `deployer` targets
     * another factory, so the offline derivation matches the deployed address.
     */
    factoryContractId?: string;
    /**
     * Deployer account of a passkey-kit smart wallet. Set it together with
     * `walletTarget: "smart-wallet"` to derive those addresses offline.
     */
    smartWalletDeployer?: string;
    /** Contract ABI to sign for. Defaults to `"single-signer"`. */
    walletTarget?: PasskeyWalletTarget;
    /**
     * Resolves a credential id to its deployed account(s). The fallback when an offline
     * derivation is not possible: a device that remembers only its credential id, or a
     * network with no default factory and no `factoryContractId`. On the single-signer
     * target it is also how a returning device re-fetches the public key the account
     * verifies against.
     */
    indexer?: IndexerAdapter;
    /**
     * Deploys the smart account for a newly created passkey. Required for
     * `createAccount()` and the create-on-connect path.
     */
    deployer?: AccountDeployer;
    /**
     * Create and deploy an account when `getAddress` finds no existing credential, so a
     * first-time user connects straight from the modal. Requires `deployer`. Defaults to
     * `true` when a `deployer` is configured.
     */
    createOnConnect?: boolean;
    /** Username recorded in the passkey. Defaults to `"Stellar account"`. */
    userName?: string;
    /** Override the WebAuthn signer (tests, or a custom ceremony). */
    signer?: WebAuthnSigner;
    /** Override the WebAuthn client (tests, or a custom ceremony). */
    webauthn?: WebAuthnClient;
    /** Where the credential id is remembered between visits. Defaults to `localStorage`. */
    storage?: CredentialStorage;
    /** Display name in the wallet picker. Defaults to `"Passkey"`; set it to your brand. */
    productName?: string;
    productUrl?: string;
    productIcon?: string;
}
type SignOpts = {
    networkPassphrase?: string;
    address?: string;
    path?: string;
};
export declare class PasskeyModule implements ModuleInterface {
    moduleType: ModuleType;
    productId: string;
    productName: string;
    productUrl: string;
    productIcon: string;
    private readonly params;
    private cachedWebauthn?;
    private cachedSigner?;
    private address?;
    private credentialId?;
    /**
     * The connected passkey's SEC-1 (65-byte) public key. The account verifies against it
     * and the factory salts the address by it, and it is never in a WebAuthn assertion, so
     * it is captured at create time, persisted, and re-fetched from the indexer.
     */
    private publicKey?;
    constructor(params: PasskeyModuleParams);
    private get webauthn();
    private get storage();
    private get signer();
    private get singleSigner();
    /** One `navigator.credentials.get` over the auth-entry challenge. */
    private assert;
    /**
     * True when the browser exposes WebAuthn and a user-verifying platform authenticator
     * is present. Resolves `false` rather than throwing, so an unsupported browser renders
     * the wallet as unavailable instead of breaking the wallet list.
     */
    isAvailable(): Promise<boolean>;
    /**
     * Resolves the smart-account address, creating the account on first visit when a
     * `deployer` is configured. Resolution order: the address held this session, an
     * offline derivation from a remembered credential id and public key, the indexer, then
     * a new passkey. Only the last two can show an OS prompt.
     */
    getAddress(params?: {
        path?: string;
        skipRequestAccess?: boolean;
    }): Promise<{
        address: string;
    }>;
    /**
     * Registers a new passkey and deploys its smart account. Beyond `ModuleInterface`:
     * the modal only asks for an address, so an app that wants an explicit "create account"
     * button calls this directly. Requires `deployer`.
     */
    createAccount(userName?: string): Promise<PasskeyCredential>;
    signTransaction(xdr: string, opts?: SignOpts): Promise<{
        signedTxXdr: string;
        signerAddress?: string;
    }>;
    signAuthEntry(authEntry: string, opts?: SignOpts): Promise<{
        signedAuthEntry: string;
        signerAddress?: string;
    }>;
    /**
     * Signs an arbitrary message. A smart account has no standard on-chain message
     * verification entry point, so the result is a self-contained WebAuthn envelope: JSON
     * with base64url `authenticatorData`, `clientDataJSON`, and a 64-byte low-S compact
     * `signature`. Verify it against the account's registered public key over
     * `SHA-256(authenticatorData || SHA-256(clientDataJSON))`; the ceremony data travels
     * with the signature because the signature alone is not verifiable.
     */
    signMessage(message: string, opts?: SignOpts): Promise<{
        signedMessage: string;
        signerAddress?: string;
    }>;
    getNetwork(): Promise<{
        network: string;
        networkPassphrase: string;
    }>;
    /** Drops the in-memory session; the passkey stays in the authenticator. A sign-out, not a deletion. */
    disconnect(): Promise<void>;
    private canCreate;
    /** The signing key, required for single-signer; the smart-wallet target resolves it on-chain. */
    private requireSigningKey;
    private rememberedCredentialId;
    private rememberedPublicKey;
    /** Re-fetch the public key from the factory event for a returning device that lacks it. */
    private resolvePublicKey;
    private deriveAddress;
    /** The configured factory, else the `@soropass/core` default for the network, else none. */
    private factoryContractId;
    private publicKeyStorageKey;
    private addressStorageKey;
    /** The deployed address pinned at create or connect time when it is not the derivation. */
    private rememberedAddress;
    private remember;
}
export {};
