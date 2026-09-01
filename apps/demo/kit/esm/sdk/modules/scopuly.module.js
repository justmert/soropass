import { ModuleType } from "../../types/mod.js";
import { parseError } from "../utils.js";
export const SCOPULY_ID = "scopuly";
const SCOPULY_AVAILABILITY_WAIT_MS = 800;
export class ScopulyModule {
    constructor() {
        Object.defineProperty(this, "removeChangeListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "providerInitializedListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "moduleType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ModuleType.HOT_WALLET
        });
        Object.defineProperty(this, "productId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: SCOPULY_ID
        });
        Object.defineProperty(this, "productName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Scopuly"
        });
        Object.defineProperty(this, "productUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://extension.scopuly.com/"
        });
        Object.defineProperty(this, "productIcon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://scopuly.com/img/logo/icon.png"
        });
    }
    async runChecks() {
        if (!(await this.isAvailable())) {
            throw {
                code: -3,
                message: "Scopuly provider is not available. Install the Scopuly browser extension or open the dApp inside the Scopuly app.",
            };
        }
    }
    async isAvailable() {
        if (typeof window === "undefined") {
            return false;
        }
        if (this.isProviderReady()) {
            return true;
        }
        return await new Promise((resolve) => {
            let settled = false;
            const finish = (available) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                window.removeEventListener("scopuly#initialized", onInitialized);
                resolve(available);
            };
            const onInitialized = () => finish(this.isProviderReady());
            const timer = setTimeout(() => finish(this.isProviderReady()), SCOPULY_AVAILABILITY_WAIT_MS);
            window.addEventListener("scopuly#initialized", onInitialized, { once: true });
            // Guard the gap between the first readiness check and listener registration.
            if (this.isProviderReady())
                finish(true);
        });
    }
    async isPlatformWrapper() {
        return this.isProviderReady() && window.scopuly?.platform === "mobile";
    }
    onChange(callback) {
        this.removeChangeListener?.();
        this.removeChangeListener = undefined;
        if (typeof window === "undefined")
            return;
        if (this.providerInitializedListener) {
            window.removeEventListener("scopuly#initialized", this.providerInitializedListener);
            this.providerInitializedListener = undefined;
        }
        const subscribe = () => {
            if (!this.isProviderReady())
                return;
            this.removeChangeListener = this.getProvider().onChange((event) => {
                callback({
                    address: event.address,
                    network: event.network,
                    networkPassphrase: event.networkPassphrase,
                });
            });
        };
        if (this.isProviderReady()) {
            subscribe();
            return;
        }
        this.providerInitializedListener = () => {
            this.providerInitializedListener = undefined;
            subscribe();
        };
        window.addEventListener("scopuly#initialized", this.providerInitializedListener, { once: true });
    }
    async getAddress(params) {
        try {
            await this.runChecks();
            if (params?.skipRequestAccess !== true) {
                const access = await this.getProvider().requestAccess();
                if (access.error)
                    throw access.error;
                if (access.address) {
                    return { address: access.address };
                }
            }
            const addressResult = await this.getProvider().getAddress();
            if (addressResult.error)
                throw addressResult.error;
            if (addressResult.address) {
                return { address: addressResult.address };
            }
            const address = await this.getProvider().getPublicKey();
            if (!address) {
                throw { code: -3, message: "Scopuly returned an empty address." };
            }
            return { address };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signTransaction(xdr, opts) {
        try {
            await this.runChecks();
            const { signedTxXdr, signedXDR, signerAddress, error } = await this.getProvider().signTransaction(xdr, opts);
            if (error)
                throw error;
            const signedTransaction = signedTxXdr || signedXDR;
            if (!signedTransaction) {
                throw { code: -3, message: "Scopuly returned an empty signed transaction." };
            }
            return {
                signedTxXdr: signedTransaction,
                signerAddress,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signAndSubmitTransaction(xdr, opts) {
        try {
            await this.runChecks();
            const result = await this.getProvider().signAndSubmitTransaction(xdr, opts);
            if (result.error)
                throw result.error;
            return { status: result.status };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signAuthEntry(authEntry, opts) {
        try {
            await this.runChecks();
            const result = await this.getProvider().signAuthEntry(authEntry, opts);
            if (result.error)
                throw result.error;
            if (!result.signedAuthEntry) {
                throw { code: -3, message: "Scopuly returned an empty signed auth entry." };
            }
            return {
                signedAuthEntry: result.signedAuthEntry,
                signerAddress: result.signerAddress,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signMessage(message, opts) {
        try {
            await this.runChecks();
            const result = await this.getProvider().signMessage(message, opts);
            if (result.error)
                throw result.error;
            if (!result.signedMessage) {
                throw { code: -3, message: "Scopuly returned an empty signed message." };
            }
            return {
                signedMessage: result.signedMessage,
                signerAddress: result.signerAddress,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async getNetwork() {
        try {
            await this.runChecks();
            const { network, networkPassphrase, error } = await this.getProvider().getNetwork();
            if (error)
                throw error;
            return { network, networkPassphrase };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async disconnect() {
        await this.getProvider().disconnect();
    }
    getProvider() {
        if (typeof window === "undefined" || !window.scopuly) {
            throw {
                code: -3,
                message: "Scopuly provider is not available. Install the Scopuly browser extension or open the dApp inside the Scopuly app.",
            };
        }
        return window.scopuly;
    }
    isProviderReady() {
        if (typeof window === "undefined" || window.scopuly?.isScopuly !== true) {
            return false;
        }
        return window.scopuly.platform === "mobile" || window.scopuly.platform === "extension";
    }
}
