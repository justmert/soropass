extern crate std;

use soroban_sdk::{
    symbol_short,
    testutils::{Events, Ledger as _},
    vec, Address, Bytes, BytesN, Env, IntoVal, Val, Vec,
};

use crate::{AccountFactory, AccountFactoryClient, MAX_CREDENTIAL_ID_LEN};

// The webauthn-account wasm this factory deploys. Built before the factory tests
// run (see contracts/build.sh). Gives us a real cross-contract deploy in-test.
mod account_wasm {
    use soroban_sdk::auth::Context;
    soroban_sdk::contractimport!(
        file = "../webauthn-account/target/wasm32v1-none/release/webauthn_account.wasm"
    );
}

fn a_pubkey(e: &Env, tag: u8) -> BytesN<65> {
    let mut k = [0u8; 65];
    k[0] = 0x04;
    k[1] = tag;
    BytesN::from_array(e, &k)
}

fn register_factory(e: &Env) -> (AccountFactoryClient<'static>, BytesN<32>) {
    let wasm_hash = e.deployer().upload_contract_wasm(account_wasm::WASM);
    let factory = e.register(AccountFactory, (wasm_hash.clone(),));
    (AccountFactoryClient::new(e, &factory), wasm_hash)
}

/// Register the factory at a FIXED address (determinism tests need the
/// deployer address, part of the contract-id preimage, held constant).
fn register_factory_at(e: &Env, at: &str) -> AccountFactoryClient<'static> {
    let wasm_hash = e.deployer().upload_contract_wasm(account_wasm::WASM);
    let factory = Address::from_str(e, at);
    e.register_at(&factory, AccountFactory, (wasm_hash,));
    AccountFactoryClient::new(e, &factory)
}

/// StrKey of an Address as a std String, for cross-Env comparison.
fn addr_string(a: &Address) -> std::string::String {
    let s = a.to_string();
    let mut buf = std::vec![0u8; s.len() as usize];
    s.copy_into_slice(&mut buf);
    std::string::String::from_utf8(buf).unwrap()
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

// KAT-1 pinned vector, shared with webauthn-account/src/test.rs (see the
// constants there for provenance). Lets the factory tests run a REAL
// __check_auth through a factory-deployed wasm instance with no signing (and
// no p256 dependency) at test time.
const KAT1_PUBLIC_HEX: &str = "041f140146bfb1b251f84f4ddbe0d4cdcfd77afd984a9520e35794021f8312bb9eec995a08b1fa7704df3dcc0b50a9665263fb7711f95f9f8a449c5096e47c892b";
const KAT1_PAYLOAD_HEX: &str = "4bb7a8b99609b0b8b1d534694bb1f31f129138a2f2a11f8e8702eedbb792922e";
const KAT1_CLIENT_DATA: &[u8] = br#"{"type":"webauthn.get","challenge":"S7eouZYJsLix1TRpS7HzHxKROKLyoR-OhwLu27eSki4","origin":"https://soropass.dev"}"#;
const KAT1_SIG_LOW_S_HEX: &str = "95c88fa792f37da64e6ad55af4a8c40b3c70251b9fe6031a028864334f9c7baa31984e03293a5312746e37b2986d1a19a01075fba631b08d5ec3df60de792df5";

/// Fixed factory address for the determinism/KAT tests (the testnet v0.2
/// factory's strkey; any fixed C-address works, this one keeps the KAT
/// aligned with the deployed testnet reality).
const FACTORY_AT: &str = "CDBOW57Z4PY3SWFMTVPODG33JC55CKDFAFPH5EVB5APVPL7KMMO5OO4X";
/// SHA256("Test SDF Network ; September 2015").
const TESTNET_NETWORK_ID_HEX: &str =
    "cee0302d59844d32bdca915c8203dd44b33fbb7edc19051ea37abedf28ecd472";
/// deriveAccountAddress(FACTORY_AT, "democred", KAT1 key, testnet) — computed
/// by @soropass/core (packages/core/src/soroban/address.ts) and pinned here as
/// a cross-language KAT.
const KAT_DERIVED_ADDR: &str = "CDLHJTPY4QU74EGLADUTZQCKLINANILFLE5E4OF46QJXKBA7QC7IV4KQ";

#[test]
fn deploy_returns_a_working_account() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);
    let cred = Bytes::from_slice(&e, b"democred");

    let account = factory.deploy(&pk, &cred);
    // The deployed contract is a real webauthn-account with the founding signer.
    let client = account_wasm::Client::new(&e, &account);
    assert_eq!(client.signer_count(), 1);
    assert!(client.is_signer(&pk));
}

#[test]
fn f1_regression_public_key_is_bound_into_the_salt() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let cred = Bytes::from_slice(&e, b"democred");

    // Same credential id, different public keys -> different addresses. Under
    // the v0.1 salt (sha256(credential_id) only) both would collide at one
    // address, letting an attacker squat a victim's derived address.
    let addr_a = factory.deploy(&a_pubkey(&e, 1), &cred);
    let addr_b = factory.deploy(&a_pubkey(&e, 2), &cred);
    assert_ne!(addr_a, addr_b);
}

#[test]
#[should_panic]
fn deploy_twice_with_same_inputs_collides() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);
    let cred = Bytes::from_slice(&e, b"democred");
    factory.deploy(&pk, &cred);
    // Same (credential_id, public_key) -> same salt -> same address -> the
    // second deploy hits an already-existing contract and traps. This is the
    // determinism guarantee getAddress relies on.
    factory.deploy(&pk, &cred);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn deploy_rejects_empty_credential_id() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    factory.deploy(&a_pubkey(&e, 1), &Bytes::new(&e));
}

#[test]
fn deploy_emits_indexer_event() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);
    let cred = Bytes::from_slice(&e, b"democred");
    let account = factory.deploy(&pk, &cred);

    // Exactly one event from the factory: topics (deployed, credential_id,
    // public_key), data = the deployed account address.
    assert_eq!(
        e.events().all().filter_by_contract(&factory.address),
        vec![
            &e,
            (
                factory.address.clone(),
                (symbol_short!("deployed"), cred.clone(), pk.clone()).into_val(&e),
                account.into_val(&e),
            )
        ]
    );
}

#[test]
fn account_wasm_getter_matches_constructor() {
    let e = Env::default();
    let (factory, wasm_hash) = register_factory(&e);
    assert_eq!(factory.account_wasm(), wasm_hash);
}

// F1: complement of the salt-binding regression above: same key, different
// credential ids -> different addresses.
#[test]
fn same_key_different_credential_different_address() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);
    let addr_a = factory.deploy(&pk, &Bytes::from_slice(&e, b"a"));
    let addr_b = factory.deploy(&pk, &Bytes::from_slice(&e, b"b"));
    assert_ne!(addr_a, addr_b);
}

// F2: the determinism getAddress relies on. (a) The deployer address is part
// of the contract-id preimage: two factories, same inputs, different
// addresses. (b) Same factory address in two SEPARATE Envs, same inputs:
// byte-identical deployed address.
#[test]
fn deploy_determinism_across_instances() {
    let e = Env::default();
    let (f1, _) = register_factory(&e);
    let (f2, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);
    let cred = Bytes::from_slice(&e, b"democred");
    assert_ne!(f1.deploy(&pk, &cred), f2.deploy(&pk, &cred));

    let deploy_in_fresh_env = || {
        let e = Env::default();
        let factory = register_factory_at(&e, FACTORY_AT);
        let deployed = factory.deploy(&a_pubkey(&e, 1), &Bytes::from_slice(&e, b"democred"));
        addr_string(&deployed)
    };
    assert_eq!(deploy_in_fresh_env(), deploy_in_fresh_env());
}

// F3: cross-language address KAT. With the network id, factory address,
// credential id, and public key all fixed, the deployed address must equal the
// constant @soropass/core's deriveAccountAddress computes offline from the
// same inputs. Survives refactors of either side.
#[test]
fn address_kat_matches_sdk_derivation() {
    let e = Env::default();
    e.ledger()
        .with_mut(|l| l.network_id = hex_arr::<32>(TESTNET_NETWORK_ID_HEX));
    let factory = register_factory_at(&e, FACTORY_AT);
    let pk = BytesN::from_array(&e, &hex_arr::<65>(KAT1_PUBLIC_HEX));
    let deployed = factory.deploy(&pk, &Bytes::from_slice(&e, b"democred"));
    assert_eq!(deployed, Address::from_str(&e, KAT_DERIVED_ADDR));
}

// F4: the deployed account enrolls EXACTLY the given key, and a real
// __check_auth round-trip through the factory-deployed wasm instance verifies
// the pinned KAT-1 vector.
#[test]
fn deployed_account_exact_enrollment() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = BytesN::from_array(&e, &hex_arr::<65>(KAT1_PUBLIC_HEX));
    let cred = Bytes::from_slice(&e, b"democred");
    let account = factory.deploy(&pk, &cred);

    let client = account_wasm::Client::new(&e, &account);
    assert_eq!(client.signer_count(), 1);
    assert!(client.is_signer(&pk));
    assert!(!client.is_signer(&a_pubkey(&e, 9)));

    let mut auth = [0u8; 37];
    auth[32] = 0x05; // UP | UV
    let sig = account_wasm::Secp256r1Signature {
        authenticator_data: Bytes::from_array(&e, &auth),
        client_data_json: Bytes::from_slice(&e, KAT1_CLIENT_DATA),
        public_key: pk,
        signature: BytesN::from_array(&e, &hex_arr::<64>(KAT1_SIG_LOW_S_HEX)),
    };
    let sig_val: Val = sig.into_val(&e);
    let contexts: Vec<soroban_sdk::auth::Context> = vec![&e];
    assert_eq!(
        e.try_invoke_contract_check_auth::<account_wasm::Error>(
            &account,
            &BytesN::from_array(&e, &hex_arr::<32>(KAT1_PAYLOAD_HEX)),
            sig_val,
            &contexts,
        ),
        Ok(())
    );
}

// F5: exact event wire shape per deploy (the indexer depends on it).
// events().all() returns the LAST invocation's events, so each deploy is
// asserted right after it runs: exactly one event, exact topics, exact data.
#[test]
fn deploy_event_exact_per_deploy() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);

    for cred_bytes in [&b"cred-one"[..], &b"cred-two"[..]] {
        let cred = Bytes::from_slice(&e, cred_bytes);
        let account = factory.deploy(&pk, &cred);
        assert_eq!(
            e.events().all().filter_by_contract(&factory.address),
            vec![
                &e,
                (
                    factory.address.clone(),
                    (symbol_short!("deployed"), cred, pk.clone()).into_val(&e),
                    account.into_val(&e),
                )
            ]
        );
    }
}

// F6: credential ids are opaque bytes. A 1024-byte id (the WebAuthn maximum
// is 1023 raw bytes) and raw non-UTF8 bytes both deploy, at distinct
// addresses, and the event carries the exact bytes.
#[test]
fn credential_id_shapes() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let pk = a_pubkey(&e, 1);

    let big = std::vec![0xABu8; 1024];
    let big_cred = Bytes::from_slice(&e, &big);
    let addr_big = factory.deploy(&pk, &big_cred);

    let raw_cred = Bytes::from_slice(&e, &[0x00, 0xff, 0x80]);
    let addr_raw = factory.deploy(&pk, &raw_cred);
    assert_ne!(addr_big, addr_raw);

    // The event for the non-UTF8 id carries the exact bytes.
    assert_eq!(
        e.events().all().filter_by_contract(&factory.address),
        vec![
            &e,
            (
                factory.address.clone(),
                (symbol_short!("deployed"), raw_cred, pk).into_val(&e),
                addr_raw.into_val(&e),
            )
        ]
    );
}

// The length cap is `>` MAX_CREDENTIAL_ID_LEN: exactly 2048 bytes deploys.
#[test]
fn deploy_accepts_credential_id_at_cap() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let cred = std::vec![7u8; MAX_CREDENTIAL_ID_LEN as usize];
    factory.deploy(&a_pubkey(&e, 1), &Bytes::from_slice(&e, &cred));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn deploy_rejects_oversized_credential_id() {
    let e = Env::default();
    let (factory, _) = register_factory(&e);
    let cred = std::vec![7u8; MAX_CREDENTIAL_ID_LEN as usize + 1];
    factory.deploy(&a_pubkey(&e, 1), &Bytes::from_slice(&e, &cred));
}
