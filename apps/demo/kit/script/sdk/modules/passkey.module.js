"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasskeyModule = exports.PASSKEY_ID = void 0;
const dntShim = __importStar(require("../../_dnt.shims.js"));
const core_1 = require("@soropass/core");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const mod_js_1 = require("../../types/mod.js");
const utils_js_1 = require("../utils.js");
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
exports.PASSKEY_ID = "passkey";
/**
 * Budget for `isAvailable`. The kit gives a module 1000ms before it renders the wallet
 * as unavailable, so the platform-authenticator probe is capped below that: a hung
 * `isUserVerifyingPlatformAuthenticatorAvailable` resolves to `false` here rather than
 * losing the race in the kit and taking the whole wallet list down with it.
 */
const IS_AVAILABLE_BUDGET_MS = 800;
/**
 * Inline so the wallet list never depends on a remote asset. Pass `productIcon` to show
 * your own wallet's mark instead.
 */
const PASSKEY_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI3IiBmaWxsPSIjMTAxMzE5Ii8+CiAgPHBhdGggZD0iTTIwLjIgNy41YTYuNiA2LjYgMCAwIDAtNi4yNCA4Ljc0TDcgMjMuMlYyNmg1LjN2LTIuNGgyLjR2LTIuNGgyLjRsMS4zMi0xLjMyQTYuNiA2LjYgMCAwIDAgMjAuMiA3LjVabTEuNSA1LjU1YTEuODUgMS44NSAwIDEgMS0xLjg1LTEuODUgMS44NSAxLjg1IDAgMCAxIDEuODUgMS44NVoiIGZpbGw9IiNGMkY0RjgiLz4KPC9zdmc+Cg==";
/**
 * `@soropass/core` uses a closed set of string error codes. The kit's `IKitError`
 * uses numbers, so the string is preserved in `ext` and the code is mapped onto the
 * kit's vocabulary: `-1` for an abort the user drove, `-3` for everything the module
 * could not complete.
 *
 * The string code is detected by shape as well as by `instanceof`, because a bundler
 * that ends up with two copies of `@soropass/core` (ESM plus CJS, or two versions)
 * breaks the prototype check, and a string code reaching `IKitError.code` would break
 * every consumer that switches on the number.
 */
function toKitError(e) {
    const code = (0, core_1.isKitError)(e)
        ? e.code
        : typeof e?.code === "string"
            ? e.code
            : undefined;
    if (code !== undefined) {
        return {
            code: code === "USER_CANCELLED" ? -1 : -3,
            message: e.message ?? code,
            ext: code,
        };
    }
    return (0, utils_js_1.parseError)(e);
}
/**
 * How many Soroban auth entries in this envelope a smart account can authorize.
 *
 * A passkey account is a contract, so it can never be a transaction's source account,
 * and its authorization is carried in an `InvokeHostFunction` operation's auth entries
 * rather than in the envelope's signature list. An envelope with none of those is
 * nothing this wallet can sign, and saying so here beats returning it untouched and
 * failing at submission.
 */
function signableAuthEntries(txXdr) {
    const envelope = stellar_sdk_1.xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
    const kind = envelope.switch().name;
    const tx = kind === "envelopeTypeTxFeeBump" ? envelope.feeBump().tx().innerTx().v1().tx() : envelope.v1().tx();
    let count = 0;
    for (const op of tx.operations()) {
        if (op.body().switch().name !== "invokeHostFunction")
            continue;
        for (const entry of op.body().invokeHostFunctionOp().auth()) {
            if (entry.credentials().switch().name === "sorobanCredentialsAddress")
                count++;
        }
    }
    return count;
}
class PasskeyModule {
    constructor(params) {
        Object.defineProperty(this, "moduleType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mod_js_1.ModuleType.HOT_WALLET
        });
        Object.defineProperty(this, "productId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: exports.PASSKEY_ID
        });
        Object.defineProperty(this, "productName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "productUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "productIcon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cachedWebauthn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cachedSigner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "address", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "credentialId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The connected passkey's SEC-1 (65-byte) public key. The v0.2 single-signer account
         * verifies against it and the v0.2 factory salts the address by it, so it must travel
         * with every sign and every offline derivation. It is never in a WebAuthn assertion,
         * so it is captured at create time, persisted, and re-fetched from the indexer.
         */
        Object.defineProperty(this, "publicKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.params = params;
        this.productName = params.productName ?? "Passkey";
        this.productUrl = params.productUrl ?? "https://soropass.dev";
        this.productIcon = params.productIcon ?? PASSKEY_ICON;
    }
    get webauthn() {
        if (!this.cachedWebauthn) {
            this.cachedWebauthn = this.params.webauthn ?? (0, core_1.browserWebAuthnClient)();
        }
        return this.cachedWebauthn;
    }
    get storage() {
        return this.params.storage ?? (0, core_1.defaultCredentialStorage)();
    }
    get signer() {
        if (!this.cachedSigner) {
            this.cachedSigner = this.params.signer ?? ((challenge) => this.assert(challenge));
        }
        return this.cachedSigner;
    }
    /** True unless this module was configured for the passkey-kit v1 smart-wallet ABI. */
    get singleSigner() {
        return this.params.walletTarget !== "smart-wallet";
    }
    /** One `navigator.credentials.get` over the auth-entry challenge. */
    async assert(challenge) {
        const assertion = await this.webauthn.get({
            rpId: this.params.rpId,
            challenge: (0, core_1.decodeChallenge)(challenge),
            allowCredentials: this.credentialId ? [this.credentialId] : [],
        });
        if (!this.credentialId)
            this.credentialId = assertion.id;
        return {
            authenticatorData: assertion.authenticatorData,
            clientDataJSON: assertion.clientDataJSON,
            signature: assertion.signature,
            credentialId: (0, core_1.decodeChallenge)(assertion.id),
            // A WebAuthn assertion carries no public key; the account needs it inline, so
            // supply the one captured at create time / recovered from the indexer.
            publicKey: this.publicKey,
        };
    }
    /**
     * True when the browser exposes WebAuthn and a user-verifying platform
     * authenticator is present. Resolves `false` rather than throwing, so an
     * unsupported browser renders the wallet as "unavailable" instead of breaking
     * the kit's wallet list.
     */
    async isAvailable() {
        // An app that supplies its own WebAuthn client has already said how ceremonies are
        // performed (a cross-device flow, a hardware key, a test authenticator), so the
        // platform probe is not what decides availability for it.
        if (this.params.webauthn)
            return true;
        const pkc = dntShim.dntGlobalThis.PublicKeyCredential;
        if (!pkc?.isUserVerifyingPlatformAuthenticatorAvailable)
            return false;
        // `ReturnType<typeof setTimeout>` rather than `number`: the npm build of the kit is
        // type checked against Node's typings, where the handle is a `Timeout` object.
        let timeout;
        const timer = new Promise((r) => {
            timeout = setTimeout(() => r(false), IS_AVAILABLE_BUDGET_MS);
        });
        try {
            return await Promise.race([timer, pkc.isUserVerifyingPlatformAuthenticatorAvailable()]);
        }
        catch {
            return false;
        }
        finally {
            // The probe usually wins the race; leaving the timer pending would keep a
            // handle alive for the rest of the budget in every host that tracks them.
            clearTimeout(timeout);
        }
    }
    /**
     * Resolves the smart-account address, creating the account on the first visit when
     * a `deployer` is configured.
     *
     * The order is: the address already resolved in this session, then an offline
     * derivation from a remembered credential id + public key, then the indexer, and
     * finally a new passkey. Only the last two steps show an OS prompt.
     */
    async getAddress(params) {
        try {
            if (this.address)
                return { address: this.address };
            const remembered = this.rememberedCredentialId();
            if (remembered) {
                const derived = this.deriveAddress(remembered, this.rememberedPublicKey());
                if (derived)
                    return this.remember(derived, remembered, this.rememberedPublicKey());
            }
            // `skipRequestAccess` means "answer without asking the user". Everything below
            // this point can show an OS passkey sheet, so it stops here instead.
            if (params?.skipRequestAccess === true) {
                throw {
                    code: -3,
                    message: "No passkey account is known without prompting the user.",
                    ext: "REQUEST_ACCESS_REQUIRED",
                };
            }
            if (this.params.indexer) {
                const rememberedKey = this.rememberedPublicKey();
                const connected = await (0, core_1.connect)({
                    rpId: this.params.rpId,
                    indexer: this.params.indexer,
                    webauthn: this.webauthn,
                    storage: this.storage,
                    // Pick the account whose founding key matches ours, when we know it.
                    publicKey: rememberedKey,
                });
                if (connected) {
                    const key = rememberedKey ?? (await this.resolvePublicKey(connected.credentialId, connected.contractId));
                    return this.remember(connected.contractId, connected.credentialId, key);
                }
            }
            if (this.canCreate()) {
                const created = await this.createAccount();
                return { address: created.contractId };
            }
            throw {
                code: -3,
                message: "No passkey account is available. Create one first, or configure the module with a deployer so it can create one.",
            };
        }
        catch (e) {
            throw toKitError(e);
        }
    }
    /**
     * Registers a new passkey and deploys its smart account. This is beyond
     * `ModuleInterface`: the kit's modal only asks for an address, so apps that want an
     * explicit "create account" button call this directly. Requires `deployer`.
     */
    async createAccount(userName) {
        try {
            if (!this.params.deployer) {
                throw {
                    code: -3,
                    message: "PasskeyModule requires a `deployer` to create an account.",
                };
            }
            const created = await (0, core_1.createPasskey)({
                rpId: this.params.rpId,
                rpName: this.params.rpName ?? this.params.rpId,
                userName: userName ?? this.params.userName ?? "Stellar account",
                deployer: this.params.deployer,
                webauthn: this.webauthn,
                storage: this.storage,
            });
            // Capture the founding public key so signing and offline derivation work later.
            this.remember(created.contractId, created.credentialId, created.publicKey);
            return created;
        }
        catch (e) {
            throw toKitError(e);
        }
    }
    async signTransaction(xdr, opts) {
        try {
            if (signableAuthEntries(xdr) === 0) {
                throw {
                    code: -3,
                    message: "A passkey account authorizes Soroban auth entries, so it cannot sign this transaction: build the transaction with a funded source account and an InvokeHostFunction operation carrying an address-credential auth entry for the passkey account, then sign that.",
                    ext: "NO_SOROBAN_AUTH_ENTRY",
                };
            }
            const signedTxXdr = await (0, core_1.signTransaction)(xdr, {
                networkPassphrase: opts?.networkPassphrase ?? this.params.networkPassphrase,
                sign: this.signer,
                target: this.params.walletTarget,
                // Sign only THIS account's auth entries, never a co-authorizer's (H1).
                signerAddress: opts?.address ?? this.address,
                // The v0.2 single-signer account carries the signer key inline and verifies
                // against it; the smart-wallet target resolves the key on-chain and ignores this.
                publicKey: this.requireSigningKey(),
            });
            return { signedTxXdr, signerAddress: opts?.address ?? this.address };
        }
        catch (e) {
            throw toKitError(e);
        }
    }
    async signAuthEntry(authEntry, opts) {
        try {
            const signedAuthEntry = await (0, core_1.signAuthEntry)(authEntry, {
                networkPassphrase: opts?.networkPassphrase ?? this.params.networkPassphrase,
                sign: this.signer,
                target: this.params.walletTarget,
                publicKey: this.requireSigningKey(),
            });
            return { signedAuthEntry, signerAddress: opts?.address ?? this.address };
        }
        catch (e) {
            throw toKitError(e);
        }
    }
    /**
     * Signs an arbitrary message with the passkey. A smart account has no standard
     * on-chain message-verification entry point, so `signedMessage` is a self-contained
     * WebAuthn envelope: JSON with base64url fields
     * `{ authenticatorData, clientDataJSON, signature }`, where `signature` is the
     * 64-byte low-S compact secp256r1 signature. Verify it in your app against the
     * account's registered public key over `SHA-256(authenticatorData || SHA-256(clientDataJSON))`.
     * The bare signature alone is not verifiable, which is why the ceremony data travels with it.
     */
    async signMessage(message, opts) {
        try {
            const assertion = await this.signer((0, core_1.encodeChallenge)(new TextEncoder().encode(message)));
            const signature = assertion.signature.length === 64
                ? (0, core_1.normalizeLowS)(assertion.signature)
                : (0, core_1.derToCompactLowS)(assertion.signature);
            const signedMessage = JSON.stringify({
                authenticatorData: (0, core_1.encodeChallenge)(assertion.authenticatorData),
                clientDataJSON: (0, core_1.encodeChallenge)(assertion.clientDataJSON),
                signature: (0, core_1.encodeChallenge)(signature),
            });
            return { signedMessage, signerAddress: opts?.address ?? this.address };
        }
        catch (e) {
            throw toKitError(e);
        }
    }
    getNetwork() {
        const passphrase = this.params.networkPassphrase;
        const network = this.params.network ??
            (passphrase === stellar_sdk_1.Networks.PUBLIC ? "PUBLIC" : passphrase === stellar_sdk_1.Networks.TESTNET ? "TESTNET" : "UNKNOWN");
        return Promise.resolve({ network, networkPassphrase: passphrase });
    }
    /**
     * Drops the in-memory session so the next `getAddress` resolves from scratch. The
     * passkey itself stays in the authenticator: this is a sign-out, not a deletion.
     */
    disconnect() {
        this.address = undefined;
        this.credentialId = undefined;
        this.publicKey = undefined;
        this.cachedSigner = undefined;
        return Promise.resolve();
    }
    canCreate() {
        return !!this.params.deployer && this.params.createOnConnect !== false;
    }
    /**
     * The public key required to sign for the single-signer account. Undefined only for
     * the smart-wallet target (which resolves the key on-chain). For single-signer, a
     * missing key here becomes a clear error at assembly time in `@soropass/core`.
     */
    requireSigningKey() {
        return this.singleSigner ? this.publicKey : undefined;
    }
    rememberedCredentialId() {
        if (this.credentialId)
            return this.credentialId;
        try {
            return this.storage.get(this.params.rpId) ?? undefined;
        }
        catch {
            return undefined;
        }
    }
    /** The founding public key, from this session or persisted next to the credential id. */
    rememberedPublicKey() {
        if (this.publicKey)
            return this.publicKey;
        try {
            const stored = this.storage.get(this.publicKeyStorageKey());
            return stored ? (0, core_1.decodeChallenge)(stored) : undefined;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Re-fetch the founding public key for a credential from the factory `deployed`
     * event. Needed on a returning device that has only the credential id, since the
     * account verifies against the key and a WebAuthn assertion never returns it.
     */
    async resolvePublicKey(credentialId, contractId) {
        if (!this.params.indexer)
            return undefined;
        try {
            const resolved = await this.params.indexer.resolveByCredential(credentialId);
            return resolved.find((a) => a.contractId === contractId)?.publicKey ?? resolved[0]?.publicKey;
        }
        catch {
            return undefined;
        }
    }
    /** The offline address derivation, when the module is configured for one. */
    deriveAddress(credentialId, publicKey) {
        if (this.params.smartWalletDeployer) {
            return (0, core_1.deriveSmartWalletAddress)({
                deployer: this.params.smartWalletDeployer,
                credentialId,
                networkPassphrase: this.params.networkPassphrase,
            });
        }
        // The v0.2 factory salts by sha256(credentialId ‖ publicKey), so offline derivation
        // needs the key too. Without it, fall through to the indexer.
        if (this.params.factoryContractId && publicKey) {
            return (0, core_1.deriveAccountAddress)({
                factoryContractId: this.params.factoryContractId,
                credentialId: new TextEncoder().encode(credentialId),
                publicKey,
                networkPassphrase: this.params.networkPassphrase,
            });
        }
        return undefined;
    }
    publicKeyStorageKey() {
        return `${this.params.rpId}#pk`;
    }
    remember(address, credentialId, publicKey) {
        this.address = address;
        this.credentialId = credentialId;
        if (publicKey)
            this.publicKey = publicKey;
        // Persist so a later visit derives + signs offline. Core's CredentialStorage holds
        // only the credential id, so the key is stored under a sibling key.
        try {
            this.storage.set(this.params.rpId, credentialId);
            if (publicKey)
                this.storage.set(this.publicKeyStorageKey(), (0, core_1.encodeChallenge)(publicKey));
        }
        catch {
            // A read-only / unavailable store still leaves this session fully usable.
        }
        return { address };
    }
}
exports.PasskeyModule = PasskeyModule;
