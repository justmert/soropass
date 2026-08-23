#!/usr/bin/env bash
# Resume the mainnet deploy: the webauthn-account wasm is already uploaded
# (hash 9a4ada31..., tx fd50edee9cbaacca06d876c23ad48b9f3e17d6d6e68bc40feb55575802078311).
# This does only the remaining two steps: upload the factory wasm and deploy the
# AccountFactory instance. Errors are VISIBLE (no 2>/dev/null) so a failure is diagnosable.
set -euo pipefail
cd "$(dirname "$0")"

SOURCE="${SOURCE:-soropass-mainnet-deployer}"
RPC_URL="${RPC_URL:-https://mainnet.sorobanrpc.com}"
PASSPHRASE="Public Global Stellar Network ; September 2015"
ACCOUNT_HASH="9a4ada31cdbc10d08dda3bba573f0140187d5bbf041b059f5802c9864ab4a7bc"
FACTORY_WASM="account-factory/target/wasm32v1-none/release/account_factory.wasm"

test -f "$FACTORY_WASM" || { echo "missing $FACTORY_WASM (run ./build.sh)"; exit 1; }
common=(--source "$SOURCE" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE")
echo "source=$(stellar keys address "$SOURCE") rpc=$RPC_URL"

echo "== upload account-factory wasm =="
FACTORY_HASH="$(stellar contract upload --wasm "$FACTORY_WASM" "${common[@]}")"
echo "factory_wasm_hash=$FACTORY_HASH"

echo "== deploy AccountFactory(account_wasm_hash) =="
FACTORY_ID="$(stellar contract deploy --wasm-hash "$FACTORY_HASH" "${common[@]}" \
  -- --account_wasm_hash "$ACCOUNT_HASH")"

echo
echo "== deployments.json values =="
echo "network:                  public (mainnet)"
echo "deployer:                 $(stellar keys address "$SOURCE")"
echo "accountFactory.id:        $FACTORY_ID"
echo "accountFactory.wasmHash:  $FACTORY_HASH"
echo "webauthnAccount.wasmHash: $ACCOUNT_HASH"
