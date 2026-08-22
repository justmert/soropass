#![no_std]
//! Multi-signer WebAuthn (secp256r1) smart account for **on-chain verification
//! of `@soropass/core`'s signed auth entries** (v0.2).
//!
//! `__check_auth` follows the audited OpenZeppelin reference verifier
//! (`references/stellar-contracts/packages/accounts/src/verifiers/webauthn.rs`):
//! real JSON parsing of `clientDataJSON` (serde-json-core), `type ==
//! "webauthn.get"`, challenge binding to the Soroban `signature_payload`,
//! User-Present + User-Verified flag checks, Backup Eligibility/State
//! consistency, length caps, and the host `secp256r1_verify` over
//! `SHA256(authenticator_data ‖ SHA256(client_data_json))`.
//!
//! Multi-signer: the account starts with the founding passkey and can enroll
//! or remove further passkeys (`add_signer` / `remove_signer`), both gated by
//! the account's own `__check_auth` (an existing device authorizes the change).
//! This is the on-chain half of multi-device recovery: a lost device does not
//! lock the user out as long as another enrolled device can sign.
//!
//! Wire-shape choices kept in lockstep with the SDK:
//!   1. The auth-entry signature is the `Secp256r1Signature` struct
//!      (`ScVal::Map { authenticator_data, client_data_json, public_key,
//!      signature }`) the SDK assembles (packages/core/src/soroban/assemble.ts).
//!      `public_key` names the enrolled signer to verify against; unknown keys
//!      are rejected before any crypto runs.
//!   2. base64url is **unpadded** (WebAuthn challenges are unpadded; the SDK's
//!      `bytesToBase64Url` is unpadded).
//!   3. The host `secp256r1_verify` REQUIRES low-S: it rejects a high-S
//!      signature at decode (`ecdsa::Signature::s().is_high()`). The SDK always
//!      normalizes to low-S client-side (invariant #2), which is what makes real
//!      authenticator traffic pass, since roughly half of Apple assertions are
//!      high-S. Low-S here is a validity requirement, not just malleability
//!      hygiene.

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    panic_with_error, symbol_short, Bytes, BytesN, Env, Vec,
};

// ################## CONSTANTS ##################

const DAY_IN_LEDGERS: u32 = 17280;
/// Bump the instance TTL toward the network maximum (~180 days) whenever fewer
/// than ~90 days remain. Mainnet instance entries start at min_persistent_ttl
/// (~120 days), so this keeps an active account far from archival; the host
/// clamps the target to the ledger's max_entry_ttl, so an over-large value is
/// safe. Instance entries are tiny, so the rent per bump is negligible. NOTE:
/// the shared account WASM *code* entry has a SEPARATE TTL the contract cannot
/// extend; the deploy runbook bumps that (and the factory instance) out of band.
pub const INSTANCE_EXTEND_AMOUNT: u32 = 180 * DAY_IN_LEDGERS;
pub const INSTANCE_TTL_THRESHOLD: u32 = 90 * DAY_IN_LEDGERS;

/// Bound on enrolled signers; keeps the instance entry small.
pub const MAX_SIGNERS: u32 = 20;

/// clientDataJSON upper bound (challenge 43B + type 12B + origin + extras).
pub const CLIENT_DATA_MAX_LEN: usize = 1024;
/// authenticatorData lower bound: 32B rpIdHash + 1B flags + 4B counter.
pub const AUTHENTICATOR_DATA_MIN_LEN: u32 = 37;

/// authenticatorData flags: User Present (bit 0).
pub const AUTH_DATA_FLAGS_UP: u8 = 0x01;
/// authenticatorData flags: User Verified (bit 2).
pub const AUTH_DATA_FLAGS_UV: u8 = 0x04;
/// authenticatorData flags: Backup Eligibility (bit 3).
pub const AUTH_DATA_FLAGS_BE: u8 = 0x08;
/// authenticatorData flags: Backup State (bit 4).
pub const AUTH_DATA_FLAGS_BS: u8 = 0x10;

// ################## ERRORS ##################

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Constructor never ran (no signers stored). Code kept from v0.1.
    NotInitialized = 1,
    /// clientDataJSON.challenge != base64url(signature_payload). Kept from v0.1.
    ChallengeMismatch = 2,
    /// signature.public_key is not an enrolled signer.
    UnknownSigner = 3,
    /// add_signer with a key that is already enrolled.
    SignerAlreadyExists = 4,
    /// remove_signer would leave the account with zero signers.
    LastSignerRemoval = 5,
    /// add_signer beyond MAX_SIGNERS.
    SignerLimitReached = 6,
    /// clientDataJSON exceeds CLIENT_DATA_MAX_LEN.
    ClientDataTooLong = 7,
    /// clientDataJSON is not parseable JSON with challenge + type.
    ClientDataParseError = 8,
    /// clientDataJSON.type is not "webauthn.get".
    WrongCeremonyType = 9,
    /// authenticatorData shorter than AUTHENTICATOR_DATA_MIN_LEN.
    AuthDataTooShort = 10,
    /// User-Present flag not set.
    UserPresentFlagMissing = 11,
    /// User-Verified flag not set (biometric / PIN required).
    UserVerifiedFlagMissing = 12,
    /// Backup State set without Backup Eligibility (invalid per WebAuthn).
    BackupStateInvalid = 13,
}

// ################## STORAGE ##################

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Number of enrolled signers.
    SignerCount,
    /// Enrolled signer marker, keyed by the 65-byte SEC-1 public key.
    Signer(BytesN<65>),
}

// ################## SIGNATURE ##################

/// secp256r1 assertion + the WebAuthn metadata needed to rebuild the signed
/// message + the enrolled signer to verify against. Field order is
/// alphabetical so the ScMap keys are canonically sorted.
#[contracttype]
#[derive(Clone)]
pub struct Secp256r1Signature {
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    pub public_key: BytesN<65>,
    pub signature: BytesN<64>,
}

/// clientDataJSON fields verified on-chain (unknown fields are ignored).
#[derive(serde::Deserialize)]
struct ClientDataJson<'a> {
    challenge: &'a str,
    #[serde(rename = "type")]
    type_field: &'a str,
}

#[contract]
pub struct WebauthnAccount;

#[contractimpl]
impl WebauthnAccount {
    /// Enroll the founding secp256r1 signer (SEC-1 uncompressed, 65 bytes).
    pub fn __constructor(e: Env, public_key: BytesN<65>) {
        e.storage()
            .instance()
            .set(&DataKey::Signer(public_key), &());
        e.storage().instance().set(&DataKey::SignerCount, &1u32);
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);
    }

    /// Enroll an additional passkey signer. Authorized by the account itself,
    /// so an existing device's `__check_auth` gates the change (multi-device
    /// recovery: enroll the new device while one enrolled device still signs).
    #[allow(deprecated)] // .publish kept for a stable event wire shape
    pub fn add_signer(e: Env, public_key: BytesN<65>) {
        e.current_contract_address().require_auth();
        let count = signer_count(&e);
        if e.storage()
            .instance()
            .has(&DataKey::Signer(public_key.clone()))
        {
            panic_with_error!(&e, Error::SignerAlreadyExists);
        }
        if count >= MAX_SIGNERS {
            panic_with_error!(&e, Error::SignerLimitReached);
        }
        e.storage()
            .instance()
            .set(&DataKey::Signer(public_key.clone()), &());
        e.storage()
            .instance()
            .set(&DataKey::SignerCount, &(count + 1));
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);
        e.events().publish((symbol_short!("sgnr_add"),), public_key);
    }

    /// Remove an enrolled passkey signer. Authorized by the account itself.
    /// The last signer can never be removed (no lockout by misconfiguration).
    #[allow(deprecated)] // .publish kept for a stable event wire shape
    pub fn remove_signer(e: Env, public_key: BytesN<65>) {
        e.current_contract_address().require_auth();
        let count = signer_count(&e);
        if !e
            .storage()
            .instance()
            .has(&DataKey::Signer(public_key.clone()))
        {
            panic_with_error!(&e, Error::UnknownSigner);
        }
        if count <= 1 {
            panic_with_error!(&e, Error::LastSignerRemoval);
        }
        e.storage()
            .instance()
            .remove(&DataKey::Signer(public_key.clone()));
        e.storage()
            .instance()
            .set(&DataKey::SignerCount, &(count - 1));
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);
        e.events().publish((symbol_short!("sgnr_rm"),), public_key);
    }

    /// Whether `public_key` is an enrolled signer.
    pub fn is_signer(e: Env, public_key: BytesN<65>) -> bool {
        e.storage().instance().has(&DataKey::Signer(public_key))
    }

    /// Number of enrolled signers.
    pub fn signer_count(e: Env) -> u32 {
        signer_count(&e)
    }
}

fn signer_count(e: &Env) -> u32 {
    match e.storage().instance().get(&DataKey::SignerCount) {
        Some(count) => count,
        None => panic_with_error!(e, Error::NotInitialized),
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
        // Every authorized use keeps the account alive.
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_EXTEND_AMOUNT);

        if !e.storage().instance().has(&DataKey::SignerCount) {
            return Err(Error::NotInitialized);
        }
        // 1. The claimed signer must be enrolled, before any crypto runs.
        if !e
            .storage()
            .instance()
            .has(&DataKey::Signer(signature.public_key.clone()))
        {
            return Err(Error::UnknownSigner);
        }

        // 2. clientDataJSON: length cap, real JSON parse, ceremony type,
        //    challenge binding (steps 11-12 of the WebAuthn assertion
        //    verification procedure, mirroring the audited OZ verifier).
        if signature.client_data_json.len() > CLIENT_DATA_MAX_LEN as u32 {
            return Err(Error::ClientDataTooLong);
        }
        let client_data_buf = signature
            .client_data_json
            .to_buffer::<CLIENT_DATA_MAX_LEN>();
        let parsed: ClientDataJson =
            match serde_json_core::de::from_slice(client_data_buf.as_slice()) {
                Ok((value, _)) => value,
                Err(_) => return Err(Error::ClientDataParseError),
            };
        if parsed.type_field != "webauthn.get" {
            return Err(Error::WrongCeremonyType);
        }
        let mut expected_challenge = [0u8; 43];
        base64url_nopad(&mut expected_challenge, &signature_payload.to_array());
        if parsed.challenge.as_bytes() != expected_challenge {
            return Err(Error::ChallengeMismatch);
        }

        // 3. authenticatorData: length + flags (steps 16-17 + BE/BS
        //    consistency). Byte 32 is the flags byte.
        if signature.authenticator_data.len() < AUTHENTICATOR_DATA_MIN_LEN {
            return Err(Error::AuthDataTooShort);
        }
        let flags = signature
            .authenticator_data
            .get(32)
            .expect("length checked above");
        if flags & AUTH_DATA_FLAGS_UP == 0 {
            return Err(Error::UserPresentFlagMissing);
        }
        if flags & AUTH_DATA_FLAGS_UV == 0 {
            return Err(Error::UserVerifiedFlagMissing);
        }
        if flags & AUTH_DATA_FLAGS_BE == 0 && flags & AUTH_DATA_FLAGS_BS != 0 {
            return Err(Error::BackupStateInvalid);
        }

        // 4. Reconstruct the signed message and verify:
        //    SHA256(authenticator_data ‖ SHA256(client_data_json)). The host fn
        //    traps on an invalid signature, and it REJECTS a high-S signature at
        //    decode, so the SDK's client-side low-S normalization is what lets
        //    real (roughly half high-S) authenticator output verify here.
        let mut message = signature.authenticator_data.clone();
        let cdj_hash = e.crypto().sha256(&signature.client_data_json);
        let cdj_hash_bytes: Bytes = cdj_hash.to_bytes().into();
        message.append(&cdj_hash_bytes);
        let digest = e.crypto().sha256(&message);
        e.crypto()
            .secp256r1_verify(&signature.public_key, &digest, &signature.signature);

        Ok(())
    }
}

/// Unpadded base64url of exactly 32 bytes into a 43-byte buffer, matching
/// WebAuthn `clientDataJSON.challenge` and the SDK's `bytesToBase64Url`.
fn base64url_nopad(dst: &mut [u8; 43], src: &[u8; 32]) {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut di = 0;
    let mut si = 0;
    while si + 3 <= src.len() {
        let val = (src[si] as usize) << 16 | (src[si + 1] as usize) << 8 | (src[si + 2] as usize);
        dst[di] = ALPHABET[(val >> 18) & 0x3f];
        dst[di + 1] = ALPHABET[(val >> 12) & 0x3f];
        dst[di + 2] = ALPHABET[(val >> 6) & 0x3f];
        dst[di + 3] = ALPHABET[val & 0x3f];
        si += 3;
        di += 4;
    }
    // 32 = 10 * 3 + 2: two trailing bytes -> three base64url chars, no padding.
    let val = (src[si] as usize) << 16 | (src[si + 1] as usize) << 8;
    dst[di] = ALPHABET[(val >> 18) & 0x3f];
    dst[di + 1] = ALPHABET[(val >> 12) & 0x3f];
    dst[di + 2] = ALPHABET[(val >> 6) & 0x3f];
}

#[cfg(test)]
mod test;
