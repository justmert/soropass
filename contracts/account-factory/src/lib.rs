#![no_std]
//! Minimal factory for `webauthn-account` smart accounts.
//!
//! Deploys a fresh single-signer secp256r1 account per passkey (constructor
//! `public_key`), deterministically salted by `credential_id`, and emits a
//! `(deployed, credential_id) -> contract_address` event so the off-chain
//! `eventsIndexer` (`@soropass/core`) can resolve a credential to its
//! smart-account C-address with zero extra infrastructure. This is what turns
//! "create a passkey" into "create a passkey wallet on-chain".

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, BytesN, Env, Symbol};

const WASM: Symbol = symbol_short!("WASM");

#[contract]
pub struct AccountFactory;

#[contractimpl]
impl AccountFactory {
    /// Store the `webauthn-account` wasm hash this factory deploys instances of.
    pub fn __constructor(e: Env, account_wasm_hash: BytesN<32>) {
        e.storage().instance().set(&WASM, &account_wasm_hash);
    }

    /// Deploy a new `webauthn-account` for `public_key` (65-byte SEC-1), salted
    /// deterministically by `sha256(credential_id)`, emit
    /// `(deployed, credential_id) -> address` for the indexer, and return the
    /// new smart-account C-address.
    pub fn deploy(e: Env, public_key: BytesN<65>, credential_id: Bytes) -> Address {
        let wasm_hash: BytesN<32> = e.storage().instance().get(&WASM).unwrap();
        let salt: BytesN<32> = e.crypto().sha256(&credential_id).into();
        let deployed: Address = e
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, (public_key,));
        e.events()
            .publish((symbol_short!("deployed"), credential_id), deployed.clone());
        deployed
    }

    /// The account wasm hash this factory deploys (for verification / indexing).
    pub fn account_wasm(e: Env) -> BytesN<32> {
        e.storage().instance().get(&WASM).unwrap()
    }
}
