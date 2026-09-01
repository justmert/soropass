/**
 * Independent proof that the wallets our tests created run passkey-kit v1 — by
 * reading each deployed wallet's on-chain executable wasm hash straight from
 * testnet and comparing it to the canonical v1 hash kalepail gave in issue #32.
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/verify-v1.ts
 */
import { Address, rpc, xdr } from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(RPC_URL);

// The canonical, audited v1 testnet wasm hash (kalepail, issue #32).
const V1_WASM_HASH = '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';

// Wallets our on-chain proofs created (contracts/deployments.json).
const WALLETS = [
  ['v1LifecycleProof (2026-07-28)', 'CDIUAXCB37ZLQRPHLPE3Q7Z4UGMMAVLHBSTGK22ZLUCUYZFFBU3W7NQ4'],
  ['v1-events-probe (2026-07-28)', 'CDXICVKLHPPAZ3EM65OESOGBSQE4YQGFN6JK7ICPYUXDAQPAVXBZ4PAT'],
  ['demoRunProof (2026-07-24)', 'CBX7RC2U5C3JEDM2H5JAHFW4PW3FWE6SPSIZJZPRNFAEOQMR7FJPAAFO'],
  ['addSignerProof (2026-07-24)', 'CBMQFHQYB6SYRKJFUGZX57FTNGCNNN6LNO6YRB37IUIOECWULLM4F4CU'],
] as const;

async function onchainWasmHash(contractId: string): Promise<string> {
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
  const { entries } = await server.getLedgerEntries(key);
  const data = entries[0]?.val;
  if (!data) throw new Error('no contract-instance ledger entry (not found on testnet)');
  if (data.type !== 'contractData')
    throw new Error(`ledger entry is ${data.type}, not contractData`);
  const val = data.contractData.val;
  if (val.type !== 'scvContractInstance') throw new Error(`val is ${val.type}, not an instance`);
  const exec = val.instance.executable;
  if (exec.type !== 'contractExecutableWasm') {
    throw new Error(`executable is ${exec.type}, not wasm`);
  }
  return exec.wasmHash.toString();
}

async function main(): Promise<void> {
  console.log(`canonical v1 wasm hash (kalepail #32): ${V1_WASM_HASH}\n`);
  let allMatch = true;
  for (const [label, id] of WALLETS) {
    try {
      const hash = await onchainWasmHash(id);
      const match = hash === V1_WASM_HASH;
      allMatch &&= match;
      console.log(`${match ? '✓' : '✗'} ${label}`);
      console.log(`    wallet:    ${id}`);
      console.log(`    on-chain:  ${hash}`);
      console.log(`    is v1:     ${match ? 'YES — identical to the canonical v1 wasm' : 'NO'}\n`);
    } catch (e) {
      allMatch = false;
      console.log(`✗ ${label} (${id}): ${(e as Error).message}\n`);
    }
  }
  console.log(
    allMatch
      ? '✅ Every wallet our tests created runs the audited passkey-kit v1 wasm.'
      : '❌ At least one wallet is not the canonical v1 wasm.',
  );
  process.exit(allMatch ? 0 : 1);
}

void main();
