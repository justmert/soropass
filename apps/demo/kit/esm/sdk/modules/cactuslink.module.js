import { ModuleType } from "../../types/mod.js";
import { parseError } from "../utils.js";
export const CACTUSLINK_ID = "cactuslink";
export class CactusLinkModule {
    constructor() {
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
            value: CACTUSLINK_ID
        });
        Object.defineProperty(this, "productName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Cactus Link"
        });
        Object.defineProperty(this, "productUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://www.mycactus.com"
        });
        Object.defineProperty(this, "productIcon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://stellar.creit.tech/wallet-icons/cactuslink.png"
        });
    }
    async runChecks() {
        if (!(await this.isAvailable())) {
            throw new Error("Cactus Link is not installed");
        }
    }
    async isAvailable() {
        return typeof window !== "undefined" && !!window.cactuslink_stellar;
    }
    async getAddress(params) {
        try {
            await this.runChecks();
            if (params?.skipRequestAccess !== true) {
                const requestAccessResult = await window.cactuslink_stellar.requestAccess();
                if (requestAccessResult.error)
                    return Promise.reject(parseError(requestAccessResult.error));
            }
            const { address } = await window.cactuslink_stellar.getAddress();
            if (!address) {
                return Promise.reject({
                    code: -3,
                    message: "Getting the address from Cactus Link is not allowed, please request access first.",
                });
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
            const { signedTxXdr } = await window.cactuslink_stellar.signTransaction(xdr, opts);
            return { signedTxXdr };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signAuthEntry(authEntry, opts) {
        try {
            await this.runChecks();
            const { signedAuthEntry } = await window.cactuslink_stellar.signAuthEntry(authEntry, opts);
            if (!signedAuthEntry) {
                return Promise.reject({
                    code: -3,
                    message: "signedAuthEntry returned from Cactus Link is undefined.",
                });
            }
            return {
                signedAuthEntry,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signMessage(message, opts) {
        try {
            await this.runChecks();
            const { signedMessage } = await window.cactuslink_stellar.signMessage(message, opts);
            if (!signedMessage) {
                return Promise.reject({
                    code: -3,
                    message: "signedMessage returned from Cactus Link is undefined.",
                });
            }
            return {
                signedMessage,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async getNetwork() {
        try {
            await this.runChecks();
            const { network, networkPassphrase, error } = await window.cactuslink_stellar.getNetwork();
            if (error)
                return Promise.reject(error);
            return { network, networkPassphrase };
        }
        catch (e) {
            throw parseError(e);
        }
    }
}
