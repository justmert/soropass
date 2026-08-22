extern crate std;

use p256::{
    ecdsa::{signature::hazmat::PrehashSigner, Signature as P256Signature, SigningKey},
    elliptic_curve::sec1::ToEncodedPoint,
    SecretKey,
};
use soroban_sdk::{
    symbol_short, testutils::Events as _, vec, Address, Bytes, BytesN, Env, IntoVal, Val, Vec,
};
use std::string::String;

use crate::{
    DataKey, Error, Secp256r1Signature, WebauthnAccount, WebauthnAccountClient, AUTH_DATA_FLAGS_BE,
    AUTH_DATA_FLAGS_BS, AUTH_DATA_FLAGS_UP, AUTH_DATA_FLAGS_UV, CLIENT_DATA_MAX_LEN,
    INSTANCE_EXTEND_AMOUNT, INSTANCE_TTL_THRESHOLD, MAX_SIGNERS,
};

const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Unpadded base64url of 32 bytes, matching the contract + SDK.
fn b64url(payload: &[u8; 32]) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i + 3 <= payload.len() {
        let v =
            (payload[i] as usize) << 16 | (payload[i + 1] as usize) << 8 | payload[i + 2] as usize;
        out.push(ALPHABET[(v >> 18) & 0x3f] as char);
        out.push(ALPHABET[(v >> 12) & 0x3f] as char);
        out.push(ALPHABET[(v >> 6) & 0x3f] as char);
        out.push(ALPHABET[v & 0x3f] as char);
        i += 3;
    }
    let v = (payload[i] as usize) << 16 | (payload[i + 1] as usize) << 8;
    out.push(ALPHABET[(v >> 18) & 0x3f] as char);
    out.push(ALPHABET[(v >> 12) & 0x3f] as char);
    out.push(ALPHABET[(v >> 6) & 0x3f] as char);
    out
}

struct Signer {
    key: SigningKey,
    public_key: [u8; 65],
}

fn signer_from(seed: u8) -> Signer {
    let mut sk_bytes = [0u8; 32];
    for (i, b) in sk_bytes.iter_mut().enumerate() {
        *b = seed.wrapping_add(i as u8).wrapping_add(1);
    }
    let secret = SecretKey::from_slice(&sk_bytes).unwrap();
    let key = SigningKey::from(&secret);
    let point = secret.public_key().to_encoded_point(false);
    let mut public_key = [0u8; 65];
    public_key.copy_from_slice(point.as_bytes());
    Signer { key, public_key }
}

fn pk(e: &Env, s: &Signer) -> BytesN<65> {
    BytesN::from_array(e, &s.public_key)
}

/// Standard 37-byte authenticatorData: 32-byte rpIdHash of zeros, the given
/// flags byte, a zero counter.
fn auth_data(e: &Env, flags: u8) -> Bytes {
    let mut auth = [0u8; 37];
    auth[32] = flags;
    Bytes::from_array(e, &auth)
}

/// Sign the EXACT (authenticator_data, client_data_json) bytes with `signing`,
/// claiming `claimed`'s public key. Lower-level than `build_signature`: the
/// malformed-input tests use it so the signature covers the adversarial bytes
/// and ONLY the targeted check fails.
fn build_raw_signature(
    e: &Env,
    claimed: &Signer,
    signing: &Signer,
    authenticator_data: &Bytes,
    client_data_json: &Bytes,
) -> Secp256r1Signature {
    // digest = sha256(authenticator_data || sha256(client_data_json))
    let cdj_hash = e.crypto().sha256(client_data_json).to_bytes();
    let mut message = authenticator_data.clone();
    message.append(&Bytes::from(cdj_hash));
    let digest = e.crypto().sha256(&message).to_array();

    let sig: P256Signature = signing.key.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&sig.to_bytes());

    Secp256r1Signature {
        authenticator_data: authenticator_data.clone(),
        client_data_json: client_data_json.clone(),
        public_key: pk(e, claimed),
        signature: BytesN::from_array(e, &sig_bytes),
    }
}

/// Build a `Secp256r1Signature` for `payload`, allowing each field to be
/// tampered for negative tests.
#[allow(clippy::too_many_arguments)]
fn build_signature(
    e: &Env,
    s: &Signer,
    payload: &[u8; 32],
    flags: u8,
    type_field: &str,
    challenge: Option<String>,
    verify_signer: Option<&Signer>,
) -> Secp256r1Signature {
    let challenge = challenge.unwrap_or_else(|| b64url(payload));
    let json = std::format!(
        r#"{{"type":"{type_field}","challenge":"{challenge}","origin":"https://soropass.dev"}}"#
    );
    let client_data_json = Bytes::from_slice(e, json.as_bytes());
    let authenticator_data = auth_data(e, flags);
    // The signature may come from a different (unknown) key for negative tests.
    build_raw_signature(
        e,
        s,
        verify_signer.unwrap_or(s),
        &authenticator_data,
        &client_data_json,
    )
}

fn check_auth(
    e: &Env,
    account: &Address,
    payload: &[u8; 32],
    signature: Secp256r1Signature,
) -> Result<(), Result<Error, soroban_sdk::InvokeError>> {
    let contexts: Vec<soroban_sdk::auth::Context> = vec![e];
    let sig_val: Val = signature.into_val(e);
    e.try_invoke_contract_check_auth::<Error>(
        account,
        &BytesN::from_array(e, payload),
        sig_val,
        &contexts,
    )
}

fn register(e: &Env, founder: &Signer) -> Address {
    register_with_key(e, &pk(e, founder))
}

fn register_with_key(e: &Env, public_key: &BytesN<65>) -> Address {
    e.register(WebauthnAccount, (public_key.clone(),))
}

/// Decode a hex string (test-fixture helper; no hex crate in dev-deps).
fn hex_vec(s: &str) -> std::vec::Vec<u8> {
    assert!(s.len().is_multiple_of(2));
    s.as_bytes()
        .chunks(2)
        .map(|c| u8::from_str_radix(core::str::from_utf8(c).unwrap(), 16).unwrap())
        .collect()
}

fn hex_arr<const N: usize>(s: &str) -> [u8; N] {
    hex_vec(s).as_slice().try_into().unwrap()
}

// ################## KNOWN-ANSWER VECTORS ##################
//
// KAT-1: cross-language pinned vector. Key + payload shared with the audited
// OZ webauthn verifier's test; signature computed with noble (RFC 6979
// deterministic ECDSA, so p256's sign_prehash reproduces the identical bytes).
const KAT1_SECRET_HEX: &str = "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";
const KAT1_PUBLIC_HEX: &str = "041f140146bfb1b251f84f4ddbe0d4cdcfd77afd984a9520e35794021f8312bb9eec995a08b1fa7704df3dcc0b50a9665263fb7711f95f9f8a449c5096e47c892b";
const KAT1_PAYLOAD_HEX: &str = "4bb7a8b99609b0b8b1d534694bb1f31f129138a2f2a11f8e8702eedbb792922e";
const KAT1_CLIENT_DATA: &[u8] = br#"{"type":"webauthn.get","challenge":"S7eouZYJsLix1TRpS7HzHxKROKLyoR-OhwLu27eSki4","origin":"https://soropass.dev"}"#;
const KAT1_DIGEST_HEX: &str = "0bb37185abc9921bb74eb06a53fbfe76fe196d0f3adff584fcd13de9085ad18a";
const KAT1_SIG_LOW_S_HEX: &str = "95c88fa792f37da64e6ad55af4a8c40b3c70251b9fe6031a028864334f9c7baa31984e03293a5312746e37b2986d1a19a01075fba631b08d5ec3df60de792df5";
/// The (r, n-s) mirror of the low-S signature: valid under plain ECDSA, but the
/// host rejects it at decode.
const KAT1_SIG_HIGH_S_HEX: &str = "95c88fa792f37da64e6ad55af4a8c40b3c70251b9fe6031a028864334f9c7baace67b1fbd6c5acee8b91c84d6792e5e61cd684b200e5edf794f5eb621de9f75c";

// KAT-2: a REAL authenticator assertion (SimpleWebAuthn fixture
// `assertionFirstTimeUsedResponse`). Its challenge is exactly 32 ASCII bytes
// ("totallyUniqueValueEveryAssertion"), so using those bytes as the
// signature_payload drives the full __check_auth path with genuine
// authenticator output. flags = 0x01 (UP only, NO UV).
const KAT2_AUTH_DATA_HEX: &str =
    "3ddc4710e9c088b229dba89d563220bb39f7229aff465b0a656b1afb9a8af8a00100000000";
const KAT2_CLIENT_DATA: &[u8] = br#"{"challenge":"dG90YWxseVVuaXF1ZVZhbHVlRXZlcnlBc3NlcnRpb24","clientExtensions":{},"hashAlgorithm":"SHA-256","origin":"https://dev.dontneeda.pw","type":"webauthn.get"}"#;
const KAT2_PUBLIC_HEX: &str = "04699ac51e2605bba4736421b56da5761000779e79afe96394640df0c6dc4e73cff42c94944fb4001d9f6f365b36006f26e45aeebea8da33e984e9adc8d3d1fe46";
/// The fixture's DER signature converted to 64-byte compact (already low-S).
const KAT2_SIG_HEX: &str = "1bba33e0c6ceed4ef22a1c187123d14680666d079b14de44813afa74b7fc23e343b26233cb9b1a718c30ce0a57a9fc11b7fdaf979ca2419fce02a589401195b1";

fn kat1_signer() -> Signer {
    let secret = SecretKey::from_slice(&hex_vec(KAT1_SECRET_HEX)).unwrap();
    let key = SigningKey::from(&secret);
    let point = secret.public_key().to_encoded_point(false);
    let mut public_key = [0u8; 65];
    public_key.copy_from_slice(point.as_bytes());
    assert_eq!(public_key, hex_arr::<65>(KAT1_PUBLIC_HEX));
    Signer { key, public_key }
}

/// The KAT-1 signature struct with every field hardcoded (no signing at test
/// time); `sig_hex` picks the low-S or high-S form.
fn kat1_signature(e: &Env, sig_hex: &str) -> Secp256r1Signature {
    Secp256r1Signature {
        authenticator_data: auth_data(e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV),
        client_data_json: Bytes::from_slice(e, KAT1_CLIENT_DATA),
        public_key: BytesN::from_array(e, &hex_arr::<65>(KAT1_PUBLIC_HEX)),
        signature: BytesN::from_array(e, &hex_arr::<64>(sig_hex)),
    }
}

#[test]
fn constructor_enrolls_founding_signer() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);
    assert_eq!(client.signer_count(), 1);
    assert!(client.is_signer(&pk(&e, &a)));
    assert!(!client.is_signer(&pk(&e, &signer_from(2))));
}

#[test]
fn check_auth_succeeds_for_enrolled_signer() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

#[test]
fn check_auth_rejects_unknown_signer() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    // Sign with, and claim, a key that was never enrolled.
    let intruder = signer_from(9);
    let sig = build_signature(
        &e,
        &intruder,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UnknownSigner))
    );
}

#[test]
fn check_auth_rejects_wrong_key_signature() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    // Claim the enrolled key `a`, but sign the digest with a different key.
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        Some(&signer_from(2)),
    );
    // The host secp256r1_verify traps on a bad signature.
    assert!(check_auth(&e, &account, &payload, sig).is_err());
}

#[test]
fn check_auth_rejects_tampered_challenge() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let wrong = b64url(&[8u8; 32]);
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        Some(wrong),
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );
}

#[test]
fn check_auth_rejects_wrong_ceremony_type() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.create",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::WrongCeremonyType))
    );
}

#[test]
fn check_auth_requires_user_present() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UserPresentFlagMissing))
    );
}

#[test]
fn check_auth_requires_user_verified() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UserVerifiedFlagMissing))
    );
}

#[test]
fn check_auth_rejects_backup_state_without_eligibility() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    // BS set, BE clear -> invalid.
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV | AUTH_DATA_FLAGS_BS;
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::BackupStateInvalid))
    );
}

#[test]
fn check_auth_accepts_backup_eligible_and_backed_up() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV | AUTH_DATA_FLAGS_BE | AUTH_DATA_FLAGS_BS;
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

#[test]
fn add_signer_enrolls_second_device_and_it_can_auth() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);

    client.add_signer(&pk(&e, &b));
    assert_eq!(client.signer_count(), 2);
    assert!(client.is_signer(&pk(&e, &b)));

    // The newly enrolled device now authorizes on its own.
    let payload = [11u8; 32];
    let sig = build_signature(
        &e,
        &b,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn add_signer_rejects_duplicate() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let account = register(&e, &a);
    WebauthnAccountClient::new(&e, &account).add_signer(&pk(&e, &a));
}

#[test]
fn remove_signer_revokes_a_device() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);
    client.add_signer(&pk(&e, &b));
    client.remove_signer(&pk(&e, &a));
    assert_eq!(client.signer_count(), 1);
    assert!(!client.is_signer(&pk(&e, &a)));

    // The removed device can no longer authorize.
    let payload = [12u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UnknownSigner))
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn remove_signer_refuses_last_signer() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let account = register(&e, &a);
    WebauthnAccountClient::new(&e, &account).remove_signer(&pk(&e, &a));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn remove_signer_rejects_unknown() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let account = register(&e, &a);
    WebauthnAccountClient::new(&e, &account).remove_signer(&pk(&e, &signer_from(2)));
}

#[test]
fn add_signer_emits_event() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    WebauthnAccountClient::new(&e, &account).add_signer(&pk(&e, &b));
    // Exactly one event from the account: topics [sgnr_add], data = enrolled key.
    assert_eq!(
        e.events().all().filter_by_contract(&account),
        vec![
            &e,
            (
                account.clone(),
                (symbol_short!("sgnr_add"),).into_val(&e),
                pk(&e, &b).into_val(&e),
            )
        ]
    );
}

// W21: `sgnr_rm` wire shape (the add event is pinned above; events().all()
// returns only the LAST invocation's events, so this asserts the remove alone).
#[test]
fn remove_signer_emits_event() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);
    client.add_signer(&pk(&e, &b));
    client.remove_signer(&pk(&e, &a));
    assert_eq!(
        e.events().all().filter_by_contract(&account),
        vec![
            &e,
            (
                account.clone(),
                (symbol_short!("sgnr_rm"),).into_val(&e),
                pk(&e, &a).into_val(&e),
            )
        ]
    );
}

// ################## KNOWN-ANSWER TESTS (W1, W2, W19) ##################

// W1: the host REJECTS a high-S signature at decode (Crypto, InvalidInput), so
// it traps rather than returning a contract error. The (r, n-s) mirror of any
// valid signature verifies under plain ECDSA; a synthetic mirror is therefore
// cryptographically identical to a real high-S Apple assertion. Client-side
// low-S normalization (SDK invariant #2) is a VALIDITY requirement.
#[test]
fn high_s_signature_rejected_by_host() {
    let e = Env::default();
    let kat = kat1_signer();
    let account = register(&e, &kat);
    let payload = hex_arr::<32>(KAT1_PAYLOAD_HEX);

    let high_s = kat1_signature(&e, KAT1_SIG_HIGH_S_HEX);
    assert!(matches!(
        check_auth(&e, &account, &payload, high_s),
        Err(Err(_))
    ));

    // The low-S form of the same (r, s) pair verifies.
    let low_s = kat1_signature(&e, KAT1_SIG_LOW_S_HEX);
    assert_eq!(check_auth(&e, &account, &payload, low_s), Ok(()));
}

// W2: full pinned vector through __check_auth, with NO signing at test time.
// Also pins the digest construction and RFC 6979 determinism: p256's
// sign_prehash must reproduce the noble-computed hardcoded signature bytes.
#[test]
fn kat_pinned_vector_verifies() {
    let e = Env::default();
    let kat = kat1_signer();
    let account = register(&e, &kat);
    let payload = hex_arr::<32>(KAT1_PAYLOAD_HEX);

    let sig = kat1_signature(&e, KAT1_SIG_LOW_S_HEX);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));

    // digest = sha256(authenticator_data || sha256(client_data_json))
    let cdj = Bytes::from_slice(&e, KAT1_CLIENT_DATA);
    let mut message = auth_data(&e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV);
    message.append(&Bytes::from(e.crypto().sha256(&cdj).to_bytes()));
    let digest = e.crypto().sha256(&message).to_array();
    assert_eq!(digest, hex_arr::<32>(KAT1_DIGEST_HEX));

    // RFC 6979: deterministic ECDSA reproduces the pinned low-S bytes exactly.
    let sig: P256Signature = kat.key.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&sig.to_bytes());
    assert_eq!(sig_bytes, hex_arr::<64>(KAT1_SIG_LOW_S_HEX));
}

// W19: a REAL authenticator assertion (KAT-2, flags 0x01 = UP without UV) is
// rejected by the UV gate. Real-world proof the gate fires on genuine
// authenticator output, not just on synthetic fixtures.
#[test]
fn real_assertion_rejected_missing_uv() {
    let e = Env::default();
    let public_key = BytesN::from_array(&e, &hex_arr::<65>(KAT2_PUBLIC_HEX));
    let account = register_with_key(&e, &public_key);
    // The fixture's challenge is base64url of these exact 32 ASCII bytes.
    let payload = *b"totallyUniqueValueEveryAssertion";
    let auth_bytes = hex_arr::<37>(KAT2_AUTH_DATA_HEX);
    let sig = Secp256r1Signature {
        authenticator_data: Bytes::from_array(&e, &auth_bytes),
        client_data_json: Bytes::from_slice(&e, KAT2_CLIENT_DATA),
        public_key,
        signature: BytesN::from_array(&e, &hex_arr::<64>(KAT2_SIG_HEX)),
    };
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UserVerifiedFlagMissing))
    );
}

// W18: a real browser clientDataJSON layout (type LAST, unknown fields
// including a nested object) parses and verifies with our challenge in place.
#[test]
fn real_browser_client_data_parses() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let challenge = b64url(&payload);
    let json = std::format!(
        r#"{{"challenge":"{challenge}","clientExtensions":{{}},"hashAlgorithm":"SHA-256","origin":"https://dev.dontneeda.pw","type":"webauthn.get"}}"#
    );
    let cdj = Bytes::from_slice(&e, json.as_bytes());
    let auth = auth_data(&e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV);
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

// ################## SIGNER-SET INTEGRITY (W3, W4, W5) ##################

// W3: exactly MAX_SIGNERS enroll; the next add fails and changes nothing.
#[test]
fn signer_limit_boundary() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);

    // Founder is #1; add up to the cap.
    for seed in 2..=MAX_SIGNERS as u8 {
        client.add_signer(&pk(&e, &signer_from(seed)));
    }
    assert_eq!(client.signer_count(), MAX_SIGNERS);

    let overflow = signer_from(MAX_SIGNERS as u8 + 1);
    assert_eq!(
        client.try_add_signer(&pk(&e, &overflow)),
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::SignerLimitReached as u32
        )))
    );
    assert_eq!(client.signer_count(), MAX_SIGNERS);
    assert!(!client.is_signer(&pk(&e, &overflow)));
}

// W4: interleaved add/remove keeps count and membership exact at every step,
// and authorization follows membership.
#[test]
fn signer_count_integrity_interleaved() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let c = signer_from(3);
    let d = signer_from(4);
    let f = signer_from(5);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);
    let member = |s: &Signer| client.is_signer(&pk(&e, s));

    client.add_signer(&pk(&e, &b));
    client.add_signer(&pk(&e, &c));
    client.add_signer(&pk(&e, &d));
    assert_eq!(client.signer_count(), 4);

    client.remove_signer(&pk(&e, &b));
    assert_eq!(client.signer_count(), 3);
    assert!(member(&a) && !member(&b) && member(&c) && member(&d) && !member(&f));

    client.add_signer(&pk(&e, &f));
    assert_eq!(client.signer_count(), 4);
    assert!(member(&f) && !member(&b));

    client.remove_signer(&pk(&e, &d));
    client.remove_signer(&pk(&e, &c));
    assert_eq!(client.signer_count(), 2);
    assert!(member(&a) && member(&f) && !member(&b) && !member(&c) && !member(&d));

    // Auth follows membership: removed key rejected, remaining key accepted.
    let payload = [21u8; 32];
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;
    let sig_c = build_signature(&e, &c, &payload, flags, "webauthn.get", None, None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig_c),
        Err(Ok(Error::UnknownSigner))
    );
    let sig_f = build_signature(&e, &f, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig_f), Ok(()));
}

// W5: a removed signer re-enrolls cleanly (no tombstone) and authorizes again.
#[test]
fn readd_removed_signer() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    let client = WebauthnAccountClient::new(&e, &account);
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;

    // Remove the founder, then re-add it.
    client.add_signer(&pk(&e, &b));
    client.remove_signer(&pk(&e, &a));
    assert_eq!(client.signer_count(), 1);
    client.add_signer(&pk(&e, &a));
    assert_eq!(client.signer_count(), 2);
    assert!(client.is_signer(&pk(&e, &a)));
    let payload = [31u8; 32];
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));

    // Same for a non-founder key.
    client.remove_signer(&pk(&e, &b));
    client.add_signer(&pk(&e, &b));
    assert_eq!(client.signer_count(), 2);
    let payload = [32u8; 32];
    let sig = build_signature(&e, &b, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

// W11: with A and B BOTH enrolled, a signature claiming A but produced by B is
// rejected: verification runs against the claimed key, never "any enrolled
// key". Strictly stronger than check_auth_rejects_wrong_key_signature (where
// the producing key is unenrolled).
#[test]
fn enrolled_key_foreign_signature() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let b = signer_from(2);
    let account = register(&e, &a);
    WebauthnAccountClient::new(&e, &account).add_signer(&pk(&e, &b));

    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        Some(&b),
    );
    // The host secp256r1_verify traps: not a contract-error rejection.
    assert!(matches!(
        check_auth(&e, &account, &payload, sig),
        Err(Err(_))
    ));
}

// ################## clientDataJSON EDGES (W6, W7, W8, W15, W16) ##################

/// A valid signed clientDataJSON padded via `origin` to exactly `target` bytes.
fn client_data_padded_to(payload: &[u8; 32], target: usize) -> String {
    let challenge = b64url(payload);
    let skeleton =
        std::format!(r#"{{"type":"webauthn.get","challenge":"{challenge}","origin":""}}"#);
    let origin = "a".repeat(target - skeleton.len());
    std::format!(r#"{{"type":"webauthn.get","challenge":"{challenge}","origin":"{origin}"}}"#)
}

// W6: the length cap is `>` CLIENT_DATA_MAX_LEN: exactly 1024 passes, 1025 is
// rejected BEFORE any parse.
#[test]
fn client_data_len_boundary() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let auth = auth_data(&e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV);

    let at_cap = client_data_padded_to(&payload, CLIENT_DATA_MAX_LEN);
    assert_eq!(at_cap.len(), CLIENT_DATA_MAX_LEN);
    let cdj = Bytes::from_slice(&e, at_cap.as_bytes());
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));

    let over_cap = client_data_padded_to(&payload, CLIENT_DATA_MAX_LEN + 1);
    let cdj = Bytes::from_slice(&e, over_cap.as_bytes());
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ClientDataTooLong))
    );
}

// W7: adversarial clientDataJSON shapes all land in ClientDataParseError.
// Each signature covers the exact malformed bytes, so ONLY the parse fails.
// Pins serde-json-core 0.6.0 behavior (duplicate fields, trailing input,
// wrong types, missing fields) against silent changes from a dependency bump.
#[test]
fn malformed_client_data_suite() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let auth = auth_data(&e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV);
    let good = b64url(&payload);
    let bad = b64url(&[8u8; 32]);

    let cases: std::vec::Vec<(&str, String)> = std::vec![
        (
            "missing challenge",
            String::from(r#"{"type":"webauthn.get","origin":"https://soropass.dev"}"#),
        ),
        (
            "missing type",
            std::format!(r#"{{"challenge":"{good}","origin":"https://soropass.dev"}}"#),
        ),
        ("empty object", String::from("{}")),
        (
            "duplicate challenge, correct first",
            std::format!(r#"{{"type":"webauthn.get","challenge":"{good}","challenge":"{bad}"}}"#),
        ),
        (
            "duplicate challenge, wrong first",
            std::format!(r#"{{"type":"webauthn.get","challenge":"{bad}","challenge":"{good}"}}"#),
        ),
        (
            "trailing garbage",
            std::format!(r#"{{"type":"webauthn.get","challenge":"{good}"}}garbage"#),
        ),
        (
            "second JSON doc appended",
            std::format!(r#"{{"type":"webauthn.get","challenge":"{good}"}}{{"a":1}}"#),
        ),
        (
            "type is not a string",
            std::format!(r#"{{"type":7,"challenge":"{good}"}}"#),
        ),
        (
            "challenge is null",
            String::from(r#"{"type":"webauthn.get","challenge":null}"#),
        ),
        (
            "top-level array",
            std::format!(r#"["webauthn.get","{good}"]"#),
        ),
        ("empty input", String::new()),
    ];

    for (label, json) in cases {
        let cdj = Bytes::from_slice(&e, json.as_bytes());
        let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
        assert_eq!(
            check_auth(&e, &account, &payload, sig),
            Err(Ok(Error::ClientDataParseError)),
            "case: {label}"
        );
    }
}

// W8: JSON string escapes are NOT unescaped (no unescape buffer), so a
// \u-escaped challenge that DECODES to the correct string still mismatches:
// the compare is over the raw bytes. The safe direction: no conformant client
// escapes base64url characters, and an escaped look-alike cannot pass.
#[test]
fn escaped_challenge_mismatch() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let challenge = b64url(&payload);
    let first = challenge.as_bytes()[0];
    let escaped = std::format!("\\u{:04x}{}", first as u32, &challenge[1..]);
    let json = std::format!(
        r#"{{"type":"webauthn.get","challenge":"{escaped}","origin":"https://soropass.dev"}}"#
    );
    let cdj = Bytes::from_slice(&e, json.as_bytes());
    let auth = auth_data(&e, AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV);
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );
}

// W15: a non-canonical base64url encoding that DECODES to the same 32 bytes
// (final char with a padding bit flipped) is rejected: the contract compares
// canonical encodings, not decoded bytes. Pins encoding-malleability rejection.
#[test]
fn non_canonical_base64url_challenge() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let mut challenge = b64url(&payload);
    let last = challenge.pop().unwrap();
    let idx = ALPHABET.iter().position(|&c| c == last as u8).unwrap();
    // The final char of a 43-char encoding carries 4 data bits + 2 padding
    // bits; flipping the low bit changes the string but not the decoded bytes.
    challenge.push(ALPHABET[idx ^ 0x01] as char);
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        Some(challenge),
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );
}

// W16: challenge strings of the wrong length (42 and 44 valid base64url
// chars) mismatch the 43-byte expected encoding.
#[test]
fn challenge_wrong_length() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;

    let mut short = b64url(&payload);
    short.pop();
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", Some(short), None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );

    let mut long = b64url(&payload);
    long.push('A');
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", Some(long), None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );
}

// ################## authenticatorData EDGES (W9, W10) ##################

// W9: 37 bytes is a floor. 36 is rejected; longer data (trailing extension
// bytes, all covered by the signature) is accepted.
#[test]
fn auth_data_length_edges() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let challenge = b64url(&payload);
    let json = std::format!(
        r#"{{"type":"webauthn.get","challenge":"{challenge}","origin":"https://soropass.dev"}}"#
    );
    let cdj = Bytes::from_slice(&e, json.as_bytes());

    // (a) 36 bytes: one short of the rpIdHash + flags + counter minimum.
    let mut short = [0u8; 36];
    short[32] = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;
    let auth = Bytes::from_array(&e, &short);
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::AuthDataTooShort))
    );

    // (c) 37 + trailing bytes, signature covering all of them.
    let mut long = [0xEEu8; 45];
    long[..32].copy_from_slice(&[0u8; 32]);
    long[32] = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;
    long[33..37].copy_from_slice(&[0u8; 4]);
    let auth = Bytes::from_array(&e, &long);
    let sig = build_raw_signature(&e, &a, &a, &auth, &cdj);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
}

// W10: flag-matrix completion. BE-without-BS is valid; AT/ED bits are ignored
// by design; all-zero flags fail on UP first (pins the UP-before-UV order).
#[test]
fn flag_matrix_completion() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];

    // (a) UP|UV|BE, BS clear: backup-eligible but not backed up, valid.
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV | AUTH_DATA_FLAGS_BE;
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));

    // (b) AT (0x40) and ED (0x80) set: ignored by design, even without the
    // attested-credential/extension data they would imply.
    for flags in [0x45u8, 0xC5u8] {
        let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
        assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
    }

    // (c) no flags at all: UP is checked before UV.
    let sig = build_signature(&e, &a, &payload, 0x00, "webauthn.get", None, None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::UserPresentFlagMissing))
    );
}

// ################## STATE + LIFECYCLE (W13, W14, W17, W20, W22) ##################

// W13: with SignerCount gone (constructor never ran), every entry point
// reports NotInitialized. The only test coverage error #1 has.
#[test]
fn not_initialized_paths() {
    let e = Env::default();
    e.mock_all_auths();
    let a = signer_from(1);
    let account = register(&e, &a);
    e.as_contract(&account, || {
        e.storage().instance().remove(&DataKey::SignerCount);
    });
    let client = WebauthnAccountClient::new(&e, &account);

    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::NotInitialized))
    );
    // The client's try_ methods surface the panic as a raw contract error #1.
    let not_initialized = soroban_sdk::Error::from_contract_error(Error::NotInitialized as u32);
    assert_eq!(
        client.try_add_signer(&pk(&e, &signer_from(2))),
        Err(Ok(not_initialized))
    );
    assert_eq!(
        client.try_remove_signer(&pk(&e, &a)),
        Err(Ok(not_initialized))
    );
    assert_eq!(client.try_signer_count(), Err(Ok(not_initialized)));
}

// W14: __check_auth extends the instance TTL back to the full amount once it
// falls below the threshold. A FAILING attempt does NOT extend: the contract
// code runs the extend before validation (lib.rs), but the host rolls back
// every storage effect of a failed invocation, TTL bumps included. Only
// authorized use keeps the account alive. Live counterpart: deployments TTL
// probe.
#[test]
fn ttl_extended_by_check_auth() {
    use soroban_sdk::testutils::{storage::Instance as _, Ledger as _};

    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let get_ttl = || e.as_contract(&account, || e.storage().instance().get_ttl());
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;

    // The constructor bumped the fresh instance to the full extend amount.
    assert_eq!(get_ttl(), INSTANCE_EXTEND_AMOUNT);

    // Advance the ledger until the remaining TTL is just under the threshold.
    let advance = INSTANCE_EXTEND_AMOUNT - INSTANCE_TTL_THRESHOLD + 1;
    e.ledger().with_mut(|l| l.sequence_number += advance);
    assert_eq!(get_ttl(), INSTANCE_TTL_THRESHOLD - 1);

    // A successful check_auth restores the full TTL.
    let payload = [7u8; 32];
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    assert_eq!(check_auth(&e, &account, &payload, sig), Ok(()));
    assert_eq!(get_ttl(), INSTANCE_EXTEND_AMOUNT);

    // A FAILING attempt (wrong challenge) does not: the failed invocation's
    // storage effects, the early TTL extend included, are rolled back.
    e.ledger().with_mut(|l| l.sequence_number += advance);
    assert_eq!(get_ttl(), INSTANCE_TTL_THRESHOLD - 1);
    let wrong = b64url(&[8u8; 32]);
    let sig = build_signature(&e, &a, &payload, flags, "webauthn.get", Some(wrong), None);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );
    assert_eq!(get_ttl(), INSTANCE_TTL_THRESHOLD - 1);
}

// W17: the account ADDRESS is not part of the signed payload. With the same
// key enrolled in two accounts, one signature passes BOTH accounts'
// __check_auth for the same payload: enrollment is the only account binding
// inside the contract. Actual cross-account misuse is prevented one protocol
// layer up (the host matches auth entries to specific require_auth addresses,
// and nonces are consumed per address). Pinned so no integrator assumes the
// contract itself binds the address.
#[test]
fn same_key_two_accounts_payload_not_address_bound() {
    let e = Env::default();
    let k = signer_from(1);
    let account_a = register(&e, &k);
    let account_b = register(&e, &k);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &k,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    assert_eq!(check_auth(&e, &account_a, &payload, sig.clone()), Ok(()));
    assert_eq!(check_auth(&e, &account_b, &payload, sig), Ok(()));
}

// W20: _auth_contexts is intentionally unused; a multi-entry vec still
// verifies. A future refactor that starts reading contexts shows up here.
#[test]
fn multi_context_vec_accepted() {
    use soroban_sdk::auth::{Context, ContractContext};

    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let sig = build_signature(
        &e,
        &a,
        &payload,
        AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV,
        "webauthn.get",
        None,
        None,
    );
    let ctx = Context::Contract(ContractContext {
        contract: account.clone(),
        fn_name: symbol_short!("transfer"),
        args: vec![&e],
    });
    let contexts = vec![&e, ctx.clone(), ctx];
    let sig_val: Val = sig.into_val(&e);
    assert_eq!(
        e.try_invoke_contract_check_auth::<Error>(
            &account,
            &BytesN::from_array(&e, &payload),
            sig_val,
            &contexts,
        ),
        Ok(())
    );
}

// W22: validation order. A wrong challenge with a garbage signature returns
// the cheap typed error (no crypto runs); with the challenge correct, the
// same garbage signature reaches the host verify and traps.
#[test]
fn check_order_challenge_before_crypto() {
    let e = Env::default();
    let a = signer_from(1);
    let account = register(&e, &a);
    let payload = [7u8; 32];
    let flags = AUTH_DATA_FLAGS_UP | AUTH_DATA_FLAGS_UV;

    let wrong = b64url(&[8u8; 32]);
    let mut sig = build_signature(&e, &a, &payload, flags, "webauthn.get", Some(wrong), None);
    sig.signature = BytesN::from_array(&e, &[2u8; 64]);
    assert_eq!(
        check_auth(&e, &account, &payload, sig),
        Err(Ok(Error::ChallengeMismatch))
    );

    let mut sig = build_signature(&e, &a, &payload, flags, "webauthn.get", None, None);
    sig.signature = BytesN::from_array(&e, &[2u8; 64]);
    assert!(matches!(
        check_auth(&e, &account, &payload, sig),
        Err(Err(_))
    ));
}
