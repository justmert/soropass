import { decodeChallenge } from '../webauthn/clientData';
import type { SubmitResult } from '../adapters/types';
import {
  buildAddSignerOperation,
  buildRemoveSignerOperation,
  type SignerStorage,
} from '../soroban/signer';
import { sendSmartWalletTx, type SendSmartWalletTxOptions } from '../soroban/submit';

/**
 * Multi-device recovery: add (or remove) a passkey signer on an existing
 * smart-wallet, on-chain. Adding a signer from a NEW device — while an existing
 * device is still available — is what keeps a lost device from locking the user
 * out. The new device produces a `{credentialId, publicKey}` via `registerPasskey`;
 * an EXISTING device authorizes `add_signer` here.
 *
 * These are thin wrappers over {@link sendSmartWalletTx}: build the wallet-
 * authorized `add_signer` / `remove_signer` invocation, then sign it with the
 * existing passkey and submit (recording → sign → enforcing re-sim → submit).
 */

/** The new device's signer to enroll. `credentialId` may be base64url or raw bytes. */
export interface NewDeviceSigner {
  credentialId: string | Uint8Array;
  /** SEC-1 uncompressed public key (65 bytes) from `registerPasskey`. */
  publicKey: Uint8Array;
  /** Optional UNIX-seconds expiry (v1). Omit for a non-expiring recovery signer. */
  expiration?: number | bigint;
  /** SignerStorage; defaults to `Persistent`. */
  storage?: SignerStorage;
}

/** Shared wiring for a wallet-authorized signer change — the submit options minus the operation. */
export interface WalletCallOptions extends Omit<SendSmartWalletTxOptions, 'operation'> {
  /** The smart-wallet C-address being modified. */
  walletContractId: string;
}

export interface AddSignerOptions extends WalletCallOptions {
  newSigner: NewDeviceSigner;
}

export interface RemoveSignerOptions extends WalletCallOptions {
  /** Credential id of the signer to remove (base64url or raw bytes). */
  credentialId: string | Uint8Array;
}

function toRawCredentialId(id: string | Uint8Array): Uint8Array {
  return typeof id === 'string' ? decodeChallenge(id) : id;
}

/**
 * Add a new passkey signer to a smart-wallet on-chain (multi-device recovery),
 * authorized by an existing device. Returns the submission result (tx hash on
 * success). Throws a typed {@link KitError} on any failure.
 */
export async function addSigner(options: AddSignerOptions): Promise<SubmitResult> {
  const { walletContractId, newSigner, ...wiring } = options;
  const operation = buildAddSignerOperation({
    walletContractId,
    signer: {
      credentialId: toRawCredentialId(newSigner.credentialId),
      publicKey: newSigner.publicKey,
      expiration: newSigner.expiration,
      storage: newSigner.storage,
    },
  });
  return sendSmartWalletTx({ ...wiring, operation });
}

/** Remove a passkey signer from a smart-wallet on-chain (authorized by an existing device). */
export async function removeSigner(options: RemoveSignerOptions): Promise<SubmitResult> {
  const { walletContractId, credentialId, ...wiring } = options;
  const operation = buildRemoveSignerOperation({
    walletContractId,
    credentialId: toRawCredentialId(credentialId),
  });
  return sendSmartWalletTx({ ...wiring, operation });
}
