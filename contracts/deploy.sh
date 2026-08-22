#!/usr/bin/env bash
# Deploy the v0.2 contracts (webauthn-account + account-factory) to a network.
#
# Uploads both wasms, then deploys an AccountFactory instance whose constructor
# is the account wasm hash. Prints every id + hash for deployments.json.
#
# Parameterized for testnet OR mainnet. Mainnet is human-gated: run only after
# the external audit, with a funded mainnet SOURCE identity and eyes on it.
#
# Usage:
#   NETWORK=testnet SOURCE=<stellar-cli-identity> ./deploy.sh
#   NETWORK=mainnet SOURCE=<funded-identity>      ./deploy.sh   # after audit only
#
# Requires: `stellar` CLI (>= 23), the identity already created/funded, and the
# wasms built (./build.sh). RPC_URL defaults per network; override to pin a
# provider. Does NOT modify deployments.json (paste the printed values in).
set -euo pipefail
cd "$(dirname "$0")"

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:?set SOURCE to a funded stellar-cli identity}"
TARGET="wasm32v1-none"
ACCOUNT_WASM="webauthn-account/target/$TARGET/release/webauthn_account.wasm"
FACTORY_WASM="account-factory/target/$TARGET/release/account_factory.wasm"

if [ "$NETWORK" = "mainnet" ] || [ "$NETWORK" = "public" ]; then
  RPC_URL="${RPC_URL:-https://mainnet.sorobanrpc.com}"
  PASSPHRASE="Public Global Stellar Network ; September 2015"
  echo "!! MAINNET deploy. This spends real XLM and is irreversible."
  echo "!! Proceed only after the external audit. Ctrl-C now to abort."
else
  RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
  PASSPHRASE="Test SDF Network ; September 2015"
fi

echo "network=$NETWORK rpc=$RPC_URL source=$(stellar keys address "$SOURCE")"
test -f "$ACCOUNT_WASM" || { echo "missing $ACCOUNT_WASM (run ./build.sh)"; exit 1; }
test -f "$FACTORY_WASM" || { echo "missing $FACTORY_WASM (run ./build.sh)"; exit 1; }

common=(--source "$SOURCE" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE")

echo "== upload webauthn-account wasm =="
ACCOUNT_HASH="$(stellar contract upload --wasm "$ACCOUNT_WASM" "${common[@]}" 2>/dev/null)"
echo "account_wasm_hash=$ACCOUNT_HASH"

echo "== upload account-factory wasm =="
FACTORY_HASH="$(stellar contract upload --wasm "$FACTORY_WASM" "${common[@]}" 2>/dev/null)"
echo "factory_wasm_hash=$FACTORY_HASH"

echo "== deploy AccountFactory(account_wasm_hash) =="
FACTORY_ID="$(stellar contract deploy --wasm-hash "$FACTORY_HASH" "${common[@]}" \
  -- --account_wasm_hash "$ACCOUNT_HASH" 2>/dev/null)"
echo "factory_contract_id=$FACTORY_ID"

echo
echo "== deployments.json values =="
echo "network:            $NETWORK"
echo "rpcUrl:             $RPC_URL"
echo "deployer:           $(stellar keys address "$SOURCE")"
echo "accountFactory.id:  $FACTORY_ID"
echo "accountFactory.wasmHash:  $FACTORY_HASH"
echo "webauthnAccount.wasmHash: $ACCOUNT_HASH"
