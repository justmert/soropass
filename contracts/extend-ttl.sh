#!/usr/bin/env bash
# Extend the mainnet TTL of the two wasm CODE entries and the factory instance to the
# network max (~180 days). The account contract self-extends its own instance on every
# use, but a contract cannot extend the shared wasm CODE entries, so do it here. Re-run
# before the TTL drops below ~90 days (roughly quarterly). Costs real XLM (rent).
set -euo pipefail
cd "$(dirname "$0")"

SOURCE="${SOURCE:-soropass-mainnet-deployer}"
RPC_URL="${RPC_URL:-https://mainnet.sorobanrpc.com}"
PASSPHRASE="Public Global Stellar Network ; September 2015"
LEDGERS="${LEDGERS:-3110000}" # just under mainnet max_entry_ttl (3,110,400 ~180 days); the extend op rejects a target at the exact max
FACTORY_ID="CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF"
ACCOUNT_HASH="9a4ada31cdbc10d08dda3bba573f0140187d5bbf041b059f5802c9864ab4a7bc"
FACTORY_HASH="98e405f8991eac0a7330514053028a4f6b310a55e4996874282bfec7422f1c0d"

common=(--source-account "$SOURCE" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE" --ledgers-to-extend "$LEDGERS")
echo "extend to $LEDGERS ledgers, source $(stellar keys address "$SOURCE")"

echo "== extend account-wasm CODE entry =="
stellar contract extend --wasm-hash "$ACCOUNT_HASH" "${common[@]}"

echo "== extend factory-wasm CODE entry =="
stellar contract extend --wasm-hash "$FACTORY_HASH" "${common[@]}"

echo "== extend factory INSTANCE entry =="
stellar contract extend --id "$FACTORY_ID" --durability persistent "${common[@]}"

echo "== done =="
