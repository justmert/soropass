import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk';
import { sha256 } from '@noble/hashes/sha256';
import { KitError } from '../errors';
import { decodeChallenge } from '../webauthn/clientData';

/** The createCustomContract C-address from a deployer address + 32-byte salt (no network round-trip). */
function contractIdFromDeployerSalt(
  deployer: string,
  salt: Uint8Array,
  networkPassphrase: string,
): string {
  let address: xdr.ScAddress;
  try {
    address = Address.fromString(deployer).toScAddress();
  } catch (cause) {
    throw new KitError('CONTRACT_AUTH_FAILED', `invalid deployer address "${deployer}"`, { cause });
  }
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address,
          salt: Buffer.from(salt),
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

export interface DeriveAccountAddressOptions {
  /** The AccountFactory contract C-address — the deployer. */
  factoryContractId: string;
  /** The credential-id bytes the factory salts by SHA-256 (utf-8 of the base64url id in our factory). */
  credentialId: Uint8Array;
  networkPassphrase: string;
}

/**
 * Derive the deterministic C-address of the `webauthn-account` our AccountFactory
 * deploys for a passkey — with NO network round-trip. The factory salts by
 * `sha256(credential_id)` and deploys with `deployer().with_current_contract(salt)`.
 * Verified against the on-chain `factoryDeployProof` in `contracts/deployments.json`
 * (credential `democred` → `CAGWE36M…`). For the passkey-kit v1 smart-wallet, use
 * {@link deriveSmartWalletAddress} instead (different deployer + salt-input scheme).
 */
export function deriveAccountAddress(options: DeriveAccountAddressOptions): string {
  const { factoryContractId, credentialId, networkPassphrase } = options;
  if (credentialId.length === 0) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'deriveAccountAddress: empty credential id');
  }
  return contractIdFromDeployerSalt(
    factoryContractId,
    hash(Buffer.from(credentialId)), // e.crypto().sha256(credential_id)
    networkPassphrase,
  );
}

export interface DeriveSmartWalletAddressOptions {
  /**
   * The account that deploys the wallet via `createCustomContract` — a classic
   * G-address (or a factory C-address). MUST be stable for offline `getAddress`.
   */
  deployer: string;
  /** base64url WebAuthn credential id of the FOUNDING passkey — its RAW bytes are salted. */
  credentialId: string;
  networkPassphrase: string;
}

/**
 * Derive the deterministic C-address of a passkey-kit **v1 smart-wallet** — offline,
 * no network. Mirrors passkey-kit's scheme exactly: `salt = sha256(rawCredentialId)`
 * (the base64url-decoded credential-id bytes), deployed by a fixed `deployer`
 * account via `createCustomContract`. Proven on-chain (`scripts/v1-events-probe.ts`:
 * derived id === deployed id).
 *
 * This only recovers the address for the wallet's FOUNDING credential (the one used
 * as the deploy salt). Signers added later via `add_signer` do not change the
 * address and cannot be reversed into it — resolve those through the events indexer
 * ({@link smartWalletV1Indexer}).
 */
export function deriveSmartWalletAddress(options: DeriveSmartWalletAddressOptions): string {
  const raw = decodeChallenge(options.credentialId);
  if (raw.length === 0) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'deriveSmartWalletAddress: empty credential id');
  }
  return contractIdFromDeployerSalt(options.deployer, sha256(raw), options.networkPassphrase);
}
