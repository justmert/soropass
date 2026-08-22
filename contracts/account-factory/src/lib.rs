#![no_std]
//! Minimal factory for `webauthn-account` smart accounts (v0.2).
//!
//! Deploys a fresh secp256r1 account per passkey (constructor `public_key`),
//! deterministically salted by `sha256(credential_id ‖ public_key)`, and emits
//! a `(deployed, credential_id) -> contract_address` event so the off-chain
//! `eventsIndexer` (`@soropass/core`) can resolve a credential to its
//! smart-account C-address with zero extra infrastructure. This is what turns
//! "create a passkey" into "create a passkey wallet on-chain".
//!
//! The salt binds BOTH the credential id and the public key. Binding only the
//! credential id (v0.1) allowed address squatting: credential ids are public
//! (this factory emits them), so anyone could pre-deploy at a credential's
//! derived address with their own key, capturing funds sent there and
//! permanently occupying the canonical address. With the key bound, deploying
//! at someone's derived address requires their exact public key, which makes a
//! squatted deploy produce the victim's intended account.

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, Bytes, BytesN,
    Env, Symbol,
};

const WASM: Symbol = symbol_short!("WASM");

const DAY_IN_LEDGERS: u32 = 17280;
/// Bump the factory instance toward ~180 days when under ~90 days remain (host
/// clamps to max_entry_ttl). See the account contract for the rationale.
pub const INSTANCE_EXTEND_AMOUNT: u32 = 180 * DAY_IN_LEDGERS;
pub const INSTANCE_TTL_THRESHOLD: u32 = 90 * DAY_IN_LEDGERS;

/// Upper bound on `credential_id` bytes. A WebAuthn credential id is at most
/// 1023 raw bytes (base64url ~1364 chars); this caps the salt preimage and the
/// event topic well above any real id and rejects oversized input with a typed
/// error rather than a metering failure.
pub const MAX_CREDENTIAL_ID_LEN: u32 = 2048;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// deploy() with an empty credential id.
    EmptyCredentialId = 1,
    /// deploy() with a credential id longer than MAX_CREDENTIAL_ID_LEN.
    CredentialIdTooLong = 2,
}

#[contract]
pub struct AccountFactory;

#[contractimpl]
impl AccountFactory {
    /// Store the `webauthn-account` wasm hash this factory deploys instances of.
    pub fn __constructor(e: Env, account_wasm_hash: BytesN<32>) {
        e.storage().instance().set(&WASM, &account_wasm_hash);
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);
    }

    /// Deploy a new `webauthn-account` for `public_key` (65-byte SEC-1), salted
    /// deterministically by `sha256(credential_id ‖ public_key)`, emit
    /// `(deployed, credential_id, public_key) -> address` for the indexer, and
    /// return the new smart-account C-address.
    ///
    /// The event carries `public_key` as a topic so a resolver can bind a
    /// `(credential_id, public_key)` pair to its address. `deploy` is
    /// permissionless (gasless/relayer deploys), and `credential_id` alone is not
    /// exclusive: anyone may deploy a DIFFERENT account for the same credential id
    /// with their own key (it lands at a different salted address by the F1
    /// binding). A consumer resolving a credential to an account MUST therefore
    /// verify the user's key is enrolled (via `is_signer`, or by re-deriving the
    /// address with `deriveAccountAddress(credential_id, public_key)`) and never
    /// blindly trust the first `deployed` event for a credential id.
    #[allow(deprecated)] // .publish kept for a stable indexer event wire shape
    pub fn deploy(e: Env, public_key: BytesN<65>, credential_id: Bytes) -> Address {
        if credential_id.is_empty() {
            panic_with_error!(&e, Error::EmptyCredentialId);
        }
        if credential_id.len() > MAX_CREDENTIAL_ID_LEN {
            panic_with_error!(&e, Error::CredentialIdTooLong);
        }
        let wasm_hash: BytesN<32> = e.storage().instance().get(&WASM).unwrap();
        let mut salt_input = credential_id.clone();
        salt_input.extend_from_array(&public_key.to_array());
        let salt: BytesN<32> = e.crypto().sha256(&salt_input).into();
        let deployed: Address = e
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, (public_key.clone(),));
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);
        e.events().publish(
            (symbol_short!("deployed"), credential_id, public_key),
            deployed.clone(),
        );
        deployed
    }

    /// The account wasm hash this factory deploys (for verification / indexing).
    pub fn account_wasm(e: Env) -> BytesN<32> {
        e.storage().instance().get(&WASM).unwrap()
    }
}

#[cfg(test)]
mod test;
