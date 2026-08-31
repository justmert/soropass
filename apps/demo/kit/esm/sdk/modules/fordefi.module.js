import { ModuleType } from "../../types/mod.js";
import { parseError } from "../utils.js";
/**
 * Fordefi Wallet module for Stellar Wallets Kit.
 *
 * The Fordefi browser extension can optionally impersonate the Freighter wallet
 * (controlled by a user-facing toggle in extension settings). When impersonation
 * is enabled, the extension listens for the standard Freighter postMessage
 * protocol (FREIGHTER_EXTERNAL_MSG_REQUEST / FREIGHTER_EXTERNAL_MSG_RESPONSE)
 * so that dapps using @stellar/freighter-api work transparently.
 *
 * This module reuses that same postMessage protocol to communicate with the
 * extension, while detecting Fordefi specifically via window.FordefiProviders
 * (which the extension always injects regardless of impersonation settings).
 * This allows the kit to show "Fordefi" as a distinct wallet option even when
 * Freighter impersonation is active.
 */
const FREIGHTER_EXTERNAL_MSG_REQUEST = "FREIGHTER_EXTERNAL_MSG_REQUEST";
const FREIGHTER_EXTERNAL_MSG_RESPONSE = "FREIGHTER_EXTERNAL_MSG_RESPONSE";
let messageCounter = 0;
function sendFreighterMessage(type, params) {
    return new Promise((resolve, reject) => {
        const messageId = ++messageCounter;
        const handler = (event) => {
            if (event.source !== window)
                return;
            if (event.data?.source !== FREIGHTER_EXTERNAL_MSG_RESPONSE)
                return;
            // Freighter uses "messagedId" (typo with extra 'd') in responses
            if (event.data?.messagedId !== messageId)
                return;
            window.removeEventListener("message", handler);
            if (event.data.apiError) {
                reject(event.data.apiError);
            }
            else {
                resolve(event.data);
            }
        };
        window.addEventListener("message", handler);
        window.postMessage({
            source: FREIGHTER_EXTERNAL_MSG_REQUEST,
            messageId,
            type,
            ...params,
        }, window.location.origin);
    });
}
export const FORDEFI_ID = "fordefi";
export class FordefiModule {
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
            value: FORDEFI_ID
        });
        Object.defineProperty(this, "productName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Fordefi"
        });
        Object.defineProperty(this, "productUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://www.fordefi.com"
        });
        Object.defineProperty(this, "productIcon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "https://stellar.creit.tech/wallet-icons/fordefi.png"
        });
    }
    async runChecks() {
        if (!(await this.isAvailable())) {
            throw new Error("Fordefi is not installed");
        }
    }
    async isAvailable() {
        return (typeof window !== "undefined" &&
            !!window.FordefiProviders?.StellarProvider);
    }
    async getAddress() {
        try {
            await this.runChecks();
            const { publicKey } = await sendFreighterMessage("REQUEST_ACCESS");
            if (!publicKey) {
                return Promise.reject({
                    code: -3,
                    message: "Failed to get address from Fordefi.",
                });
            }
            return { address: publicKey };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async signTransaction(xdr, opts) {
        try {
            await this.runChecks();
            const { signedTransaction, signerAddress } = await sendFreighterMessage("SUBMIT_TRANSACTION", {
                transactionXdr: xdr,
                networkPassphrase: opts?.networkPassphrase,
                accountToSign: opts?.address,
            });
            if (!signedTransaction) {
                return Promise.reject({
                    code: -3,
                    message: "Failed to sign transaction with Fordefi.",
                });
            }
            return { signedTxXdr: signedTransaction, signerAddress };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    signAuthEntry() {
        return Promise.reject({
            code: -3,
            message: 'Fordefi does not support the "signAuthEntry" function',
        });
    }
    async signMessage(message, opts) {
        try {
            await this.runChecks();
            const { signedBlob, signerAddress } = await sendFreighterMessage("SUBMIT_BLOB", {
                blob: message,
                networkPassphrase: opts?.networkPassphrase,
                accountToSign: opts?.address,
            });
            if (!signedBlob) {
                return Promise.reject({
                    code: -3,
                    message: "Failed to sign message with Fordefi.",
                });
            }
            return { signedMessage: signedBlob, signerAddress };
        }
        catch (e) {
            throw parseError(e);
        }
    }
    async getNetwork() {
        try {
            await this.runChecks();
            const { networkDetails } = await sendFreighterMessage("REQUEST_NETWORK_DETAILS");
            return {
                network: networkDetails.network,
                networkPassphrase: networkDetails.networkPassphrase,
            };
        }
        catch (e) {
            throw parseError(e);
        }
    }
}
