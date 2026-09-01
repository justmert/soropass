import { type Transaction } from "@stellar/stellar-sdk";
/**
 * Builds the `{ path, networkPassphrase, transaction }` payload that
 * `TrezorConnect.stellarSignTransaction` expects, field by field.
 *
 * This replaces `@trezor/connect-plugin-stellar`'s `transformTransaction`. That function reads
 * offer prices via a `xdrOperation.body().value().price().n()/.d()` method-chain, which
 * `@stellar/stellar-sdk` v17 (built on `@stellar/js-xdr` v5) no longer supports: `body`, `value`,
 * `price`, `n` and `d` all became plain readonly properties. It throws for `manageBuyOffer`,
 * `manageSellOffer`, and `createPassiveSellOffer` transactions as a result. This is a clean-room
 * reimplementation written against the public `TrezorConnect.stellarSignTransaction` param shape
 * (documented in `@trezor/connect`'s own type declarations), not copied from Trezor's source —
 * `@trezor/connect-plugin-stellar` is licensed under Trezor's T-RSL, which doesn't permit
 * redistributing its code outside the company that downloaded it.
 *
 * Along the way this also fixes two smaller v17 fallout bugs the original plugin has: `Buffer`
 * usages (`.toString('hex')`, `instanceof Buffer`) that silently no-op once stellar-sdk hands back
 * plain `Uint8Array`s for signer keys and `manageData` values instead of `Buffer` instances.
 */
export declare function transformTransaction(path: string, tx: Transaction): {
    path: string;
    networkPassphrase: string;
    transaction: Record<string, unknown>;
};
