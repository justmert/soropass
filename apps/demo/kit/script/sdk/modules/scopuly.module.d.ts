import { type IOnChangeEvent, type ModuleInterface, ModuleType } from "../../types/mod.js";
export declare const SCOPULY_ID = "scopuly";
export declare class ScopulyModule implements ModuleInterface {
    private removeChangeListener?;
    private providerInitializedListener?;
    moduleType: ModuleType;
    productId: string;
    productName: string;
    productUrl: string;
    productIcon: string;
    runChecks(): Promise<void>;
    isAvailable(): Promise<boolean>;
    isPlatformWrapper(): Promise<boolean>;
    onChange(callback: (event: IOnChangeEvent) => void): void;
    getAddress(params?: {
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
    signAndSubmitTransaction(xdr: string, opts?: {
        networkPassphrase?: string;
        address?: string;
    }): Promise<{
        status: "success" | "pending";
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
    disconnect(): Promise<void>;
    private getProvider;
    private isProviderReady;
}
