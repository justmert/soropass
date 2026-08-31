import type { AccountDeployer, CredentialStorage, IndexerAdapter, PasskeyCredential, WebAuthnClient, WebAuthnSigner } from "@soropass/core";
import { type ModuleInterface, ModuleType } from "../../types/mod.js";
/**
 * A passkey wallet: a Soroban smart account (a C-address) whose authorization is a
 * WebAuthn secp256r1 signature verified on-chain by the account's `__check_auth`.
 * There is no extension to install and no seed phrase; the key lives in the platform
 * authenticator (Touch ID, Windows Hello, Android biometrics).
 *
 * The ceremonies, the ES256 enforcement, the DER -> compact low-S conversion and the
 * Soroban auth-entry assembly come from `@soropass/core`; this module only maps them
 * onto the kit's `ModuleInterface`.
 *
 * The v0.2 account is multi-signer and verifies each assertion against the enrolled
 * SEC-1 public key carried inline in the auth entry, and the v0.2 factory salts the
 * account address by `sha256(credentialId ‖ publicKey)`. A WebAuthn assertion never
 * returns the public key, so this module captures it at create time, persists it next
 * to the credential id, and re-fetches it from the factory `deployed` event when a
 * returning device has only the credential id. That key is then passed to
 * `deriveAccountAddress` (for offline `getAddress`) and to `signTransaction` /
 * `signAuthEntry` (for the on-chain signer check).
 *
 * **IMPORTANT**: this module requires a "Buffer" polyfill in your app (it is a
 * `@stellar/stellar-sdk` requirement, the same one the Ledger and Trezor modules
 * carry). It also needs a secure context (https, or localhost) because WebAuthn is
 * unavailable over plain http.
 *
 * Configuration is required, so this module is not part of `defaultModules()`:
 *
 * ```typescript
 * import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
 * import { PasskeyModule } from "@creit.tech/stellar-wallets-kit/modules/passkey";
 * import { eventsIndexer, factoryDeployer } from "@soropass/core";
 *
 * StellarWalletsKit.init({
 *   network: Networks.TESTNET,
 *   modules: [
 *     ...defaultModules(),
 *     new PasskeyModule({
 *       rpId: globalThis.location.hostname,
 *       networkPassphrase: Networks.TESTNET,
 *       factoryContractId: "C...",
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
     * The AccountFactory C-address. With it, and the persisted founding public key,
     * `getAddress` derives the account address offline from the credential id (no
     * indexer and no deploy round-trip), which is what makes a returning user's connect
     * instant and infra-free.
     */
    factoryContractId?: string;
    /**
     * The deployer account of a passkey-kit v1 smart wallet. Set it together with
     * `walletTarget: "smart-wallet"` to derive v1 addresses offline.
     */
    smartWalletDeployer?: string;
    /** Contract ABI to sign for. Defaults to `"single-signer"`. */
    walletTarget?: PasskeyWalletTarget;
    /**
     * Resolves a credential id to its deployed account(s). Required when neither
     * `factoryContractId` nor `smartWalletDeployer` is set, and used as the fallback
     * whenever an offline derivation is not possible. On the `single-signer` target it
     * is also how a returning device with only its credential id re-fetches the founding
     * public key (from the factory `deployed` event), which the account needs to verify
     * a signature.
     */
    indexer?: IndexerAdapter;
    /**
     * Deploys the smart account for a newly created passkey. Required for
     * `createAccount()` and for the create-on-connect path.
     */
    deployer?: AccountDeployer;
    /**
     * Create a passkey and deploy an account when `getAddress` finds no existing
     * credential, so a first-time user can connect straight from the kit's modal.
     * Requires `deployer`. Defaults to `true` when a `deployer` is configured.
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
    /**
     * Display name for this wallet in the kit's picker. Defaults to `"Passkey"`. Set it to
     * your own brand (for example `"Acme Wallet"`) so the passkey option reads as part of
     * your wallet rather than a separate product; SoroPass is the layer, not the wallet.
     */
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
     * The connected passkey's SEC-1 (65-byte) public key. The v0.2 single-signer account
     * verifies against it and the v0.2 factory salts the address by it, so it must travel
     * with every sign and every offline derivation. It is never in a WebAuthn assertion,
     * so it is captured at create time, persisted, and re-fetched from the indexer.
     */
    private publicKey?;
    constructor(params: PasskeyModuleParams);
    private get webauthn();
    private get storage();
    private get signer();
    /** True unless this module was configured for the passkey-kit v1 smart-wallet ABI. */
    private get singleSigner();
    /** One `navigator.credentials.get` over the auth-entry challenge. */
    private assert;
    /**
     * True when the browser exposes WebAuthn and a user-verifying platform
     * authenticator is present. Resolves `false` rather than throwing, so an
     * unsupported browser renders the wallet as "unavailable" instead of breaking
     * the kit's wallet list.
     */
    isAvailable(): Promise<boolean>;
    /**
     * Resolves the smart-account address, creating the account on the first visit when
     * a `deployer` is configured.
     *
     * The order is: the address already resolved in this session, then an offline
     * derivation from a remembered credential id + public key, then the indexer, and
     * finally a new passkey. Only the last two steps show an OS prompt.
     */
    getAddress(params?: {
        path?: string;
        skipRequestAccess?: boolean;
    }): Promise<{
        address: string;
    }>;
    /**
     * Registers a new passkey and deploys its smart account. This is beyond
     * `ModuleInterface`: the kit's modal only asks for an address, so apps that want an
     * explicit "create account" button call this directly. Requires `deployer`.
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
     * Signs an arbitrary message with the passkey. A smart account has no standard
     * on-chain message-verification entry point, so `signedMessage` is a self-contained
     * WebAuthn envelope: JSON with base64url fields
     * `{ authenticatorData, clientDataJSON, signature }`, where `signature` is the
     * 64-byte low-S compact secp256r1 signature. Verify it in your app against the
     * account's registered public key over `SHA-256(authenticatorData || SHA-256(clientDataJSON))`.
     * The bare signature alone is not verifiable, which is why the ceremony data travels with it.
     */
    signMessage(message: string, opts?: SignOpts): Promise<{
        signedMessage: string;
        signerAddress?: string;
    }>;
    getNetwork(): Promise<{
        network: string;
        networkPassphrase: string;
    }>;
    /**
     * Drops the in-memory session so the next `getAddress` resolves from scratch. The
     * passkey itself stays in the authenticator: this is a sign-out, not a deletion.
     */
    disconnect(): Promise<void>;
    private canCreate;
    /**
     * The public key required to sign for the single-signer account. Undefined only for
     * the smart-wallet target (which resolves the key on-chain). For single-signer, a
     * missing key here becomes a clear error at assembly time in `@soropass/core`.
     */
    private requireSigningKey;
    private rememberedCredentialId;
    /** The founding public key, from this session or persisted next to the credential id. */
    private rememberedPublicKey;
    /**
     * Re-fetch the founding public key for a credential from the factory `deployed`
     * event. Needed on a returning device that has only the credential id, since the
     * account verifies against the key and a WebAuthn assertion never returns it.
     */
    private resolvePublicKey;
    /** The offline address derivation, when the module is configured for one. */
    private deriveAddress;
    private publicKeyStorageKey;
    private remember;
}
export {};
//# sourceMappingURL=passkey.module.d.ts.map