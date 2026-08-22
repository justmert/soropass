#!/usr/bin/env bash
# Reproducible release build of both contract crates + wasm hashes.
#
# Deterministic inputs: the toolchain is pinned by contracts/rust-toolchain.toml
# (channel 1.97.1, target wasm32v1-none) and soroban-sdk is pinned in each
# Cargo.lock. Re-running this on the pinned toolchain reproduces the same wasm
# and therefore the same sha256 hashes printed at the end.
#
# Build order matters: the account wasm is built first because the factory's
# unit tests embed it via contractimport!.
set -euo pipefail

cd "$(dirname "$0")"
TARGET="wasm32v1-none"

echo "== toolchain =="
rustc --version
echo "soroban-sdk: $(grep -m1 '^name = "soroban-sdk"' -A1 webauthn-account/Cargo.lock | grep version | head -1 | cut -d'"' -f2)"

for crate in webauthn-account account-factory; do
  echo "== build $crate =="
  ( cd "$crate" && cargo build --target "$TARGET" --release )
done

echo
echo "== wasm sha256 (Soroban wasm hash) =="
for pair in "webauthn-account:webauthn_account" "account-factory:account_factory"; do
  dir="${pair%%:*}"
  name="${pair##*:}"
  wasm="$dir/target/$TARGET/release/$name.wasm"
  hash="$(shasum -a 256 "$wasm" | cut -d' ' -f1)"
  size="$(wc -c < "$wasm" | tr -d ' ')"
  printf '%-20s %s  (%s bytes)\n' "$name" "$hash" "$size"
done
