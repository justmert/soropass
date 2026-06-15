#![no_std]
//! Minimal single-signer WebAuthn (secp256r1) smart account for **on-chain
//! verification of `@soropass/core`'s signed auth entries**.
//!
//! `__check_auth` mirrors the audited reference verifier
//! (`references/stellar-contracts/.../webauthn-verifier`): it binds the WebAuthn
//! `clientDataJSON.challenge` to the Soroban auth `signature_payload` and runs the
//! host `secp256r1_verify` over `SHA256(authenticator_data ‖ SHA256(client_data_json))`.
//!
//! Two deliberate choices so it matches the SDK exactly:
//!   1. The auth-entry signature is the plain `Secp256r1Signature` struct
//!      (`ScVal::Map { authenticator_data, client_data_json, signature }`) — the
//!      clean shape the SDK assembles (see packages/core/src/soroban/assemble.ts).
//!   2. base64url is **unpadded** (WebAuthn challenges are unpadded; the SDK's
//!      `bytesToBase64Url` is unpadded) — unlike the reference verifier which pads.

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    symbol_short, Bytes, BytesN, Env, Symbol, Vec,
};

const PK: Symbol = symbol_short!("PK");

#[contract]
pub struct WebauthnAccount;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    ChallengeMismatch = 2,
}

/// secp256r1 assertion + the WebAuthn metadata needed to rebuild the signed
/// message. Field order is alphabetical so the ScMap keys are canonically sorted.
#[contracttype]
#[derive(Clone)]
pub struct Secp256r1Signature {
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    pub signature: BytesN<64>,
}

#[contractimpl]
impl WebauthnAccount {
    /// Store the single secp256r1 signer (SEC-1 uncompressed, 65 bytes).
    pub fn __constructor(e: Env, public_key: BytesN<65>) {
        e.storage().instance().set(&PK, &public_key);
    }

    /// A `require_auth`-gated method: invoking it forces `__check_auth` to run,
    /// which is exactly the on-chain path we want to exercise.
    pub fn protected(e: Env) -> u32 {
        e.current_contract_address().require_auth();
        42
    }

    pub fn public_key(e: Env) -> BytesN<65> {
        e.storage().instance().get(&PK).unwrap()
    }
}

#[contractimpl]
impl CustomAccountInterface for WebauthnAccount {
    type Signature = Secp256r1Signature;
    type Error = Error;

    #[allow(non_snake_case)]
    fn __check_auth(
        e: Env,
        signature_payload: Hash<32>,
        signature: Secp256r1Signature,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let public_key: BytesN<65> = e
            .storage()
            .instance()
            .get(&PK)
            .ok_or(Error::NotInitialized)?;

        // 1. Challenge binding: clientDataJSON.challenge == base64url(signature_payload).
        let mut payload = Bytes::new(&e);
        payload.extend_from_array(&signature_payload.to_array());
        let expected = base64url_nopad(&e, &payload);
        if !client_data_challenge_matches(&e, &signature.client_data_json, &expected) {
            return Err(Error::ChallengeMismatch);
        }

        // 2. Reconstruct the signed message: authenticator_data ‖ sha256(client_data_json).
        let mut message = signature.authenticator_data.clone();
        let cdj_hash = e.crypto().sha256(&signature.client_data_json);
        let cdj_hash_bytes: Bytes = cdj_hash.to_bytes().into();
        message.append(&cdj_hash_bytes);

        // 3. secp256r1_verify over SHA256(message). The host fn traps on an
        //    invalid signature (and does NOT enforce low-S — hence the SDK
        //    normalizes client-side before it ever reaches here).
        let digest = e.crypto().sha256(&message);
        e.crypto()
            .secp256r1_verify(&public_key, &digest, &signature.signature);

        Ok(())
    }
}

/// Unpadded base64url, matching WebAuthn `clientDataJSON.challenge` and the SDK's
/// `bytesToBase64Url`.
fn base64url_nopad(e: &Env, data: &Bytes) -> Bytes {
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut result = Bytes::new(e);
    let mut i = 0;
    while i < data.len() {
        let b0 = data.get(i).unwrap();
        let b1 = if i + 1 < data.len() { data.get(i + 1).unwrap() } else { 0 };
        let b2 = if i + 2 < data.len() { data.get(i + 2).unwrap() } else { 0 };

        result.push_back(alphabet[(b0 >> 2) as usize]);
        result.push_back(alphabet[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize]);
        if i + 1 < data.len() {
            result.push_back(alphabet[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize]);
        }
        if i + 2 < data.len() {
            result.push_back(alphabet[(b2 & 0x3f) as usize]);
        }
        i += 3;
    }
    result
}

fn client_data_challenge_matches(e: &Env, client_data_json: &Bytes, expected: &Bytes) -> bool {
    let needle = Bytes::from_slice(e, b"\"challenge\":\"");
    match find_subsequence(client_data_json, &needle) {
        Some(start) => {
            let value_start = start + needle.len();
            let mut end = value_start;
            while end < client_data_json.len() && client_data_json.get(end).unwrap() != b'"' {
                end += 1;
            }
            let actual = client_data_json.slice(value_start..end);
            &actual == expected
        }
        None => false,
    }
}

fn find_subsequence(haystack: &Bytes, needle: &Bytes) -> Option<u32> {
    if needle.len() == 0 || needle.len() > haystack.len() {
        return None;
    }
    let mut i = 0;
    while i + needle.len() <= haystack.len() {
        let mut matched = true;
        let mut j = 0;
        while j < needle.len() {
            if haystack.get(i + j).unwrap() != needle.get(j).unwrap() {
                matched = false;
                break;
            }
            j += 1;
        }
        if matched {
            return Some(i);
        }
        i += 1;
    }
    None
}
