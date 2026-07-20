import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';

export interface DeriveAccountAddressOptions {
  /** The AccountFactory contract C-address — the deployer. */
  factoryContractId: string;
  /** Raw WebAuthn credential-id bytes (the factory salts by SHA-256 of this). */
  credentialId: Uint8Array;
  networkPassphrase: string;
}

/**
 * Derive the deterministic C-address of the `webauthn-account` the AccountFactory
 * deploys for a passkey — with NO network round-trip. Mirrors the on-chain
 * derivation exactly: the factory salts by `sha256(credential_id)` and deploys
 * with `deployer().with_current_contract(salt)`, so the contract id is
 *
 *   sha256( XDR( HashIDPreimage::ContractID {
 *     networkId: sha256(networkPassphrase),
 *     contractIdPreimage: FromAddress { address: factory, salt },
 *   } ) )
 *
 * Verified against the on-chain `factoryDeployProof` in `contracts/deployments.json`
 * (credential `democred` → `CAGWE36M…`). This is what lets the kit module's
 * `getAddress` resolve an account from the passkey alone — no deploy, no indexer.
 */
export function deriveAccountAddress(options: DeriveAccountAddressOptions): string {
  const { factoryContractId, credentialId, networkPassphrase } = options;
  if (credentialId.length === 0) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'deriveAccountAddress: empty credential id');
  }
  let deployer: xdr.ScAddress;
  try {
    deployer = Address.fromString(factoryContractId).toScAddress();
  } catch (cause) {
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      `deriveAccountAddress: invalid factory contract id "${factoryContractId}"`,
      { cause },
    );
  }
  const salt = hash(Buffer.from(credentialId)); // e.crypto().sha256(credential_id)
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: deployer,
          salt: Buffer.from(salt),
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}
