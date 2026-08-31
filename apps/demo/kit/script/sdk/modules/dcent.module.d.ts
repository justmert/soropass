import { type ModuleInterface, ModuleType } from "../../types/mod.js";
export declare const DCENT_ID: string;
export declare class DcentModule implements ModuleInterface {
    moduleType: ModuleType;
    productId: string;
    productName: string;
    productUrl: string;
    productIcon: string;
    private getProvider;
    isAvailable(): Promise<boolean>;
    private isSentinelReady;
    private connected;
    isPlatformWrapper(): Promise<boolean>;
    getAddress(params?: {
        path?: string;
        skipRequestAccess?: boolean;
    }): Promise<{
        address: string;
    }>;
    signTransaction(xdr: string, opts?: {
        networkPassphrase?: string;
        address?: string;
        path?: string;
    }): Promise<{
        signedTxXdr: string;
        signerAddress?: string;
    }>;
    signAuthEntry(authEntry: string, opts?: {
        networkPassphrase?: string;
        address?: string;
        path?: string;
    }): Promise<{
        signedAuthEntry: string;
        signerAddress?: string;
    }>;
    signMessage(message: string, opts?: {
        networkPassphrase?: string;
        address?: string;
        path?: string;
    }): Promise<{
        signedMessage: string;
        signerAddress?: string;
    }>;
    getNetwork(): Promise<{
        network: string;
        networkPassphrase: string;
    }>;
}
//# sourceMappingURL=dcent.module.d.ts.map