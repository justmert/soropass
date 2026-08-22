/**
 * LIVE factory-correctness proof on testnet (v0.2 AccountFactory).
 *
 * Deploys a BRAND-NEW webauthn-account through the factory for a fresh passkey,
 * then reads the deployed instance to confirm it enrolled exactly the founding
 * key: `is_signer(foundingKey) == true`, `is_signer(otherKey) == false`,
 * `signer_count() == 1`. Reads are simulation-only (no signing, no funding). The
 * passkey `__check_auth` path is proven separately by transfer-e2e (payment) and
 * recovery-e2e (add/remove signer); this isolates the factory's deploy + enroll.
 *
 * Env: SOURCE_SECRET (testnet, sources the deploy). FACTORY_ID and RPC_URL
 * default to contracts/deployments.json / soroban-testnet.
 *
 * Run: SOURCE_SECRET=… FACTORY_ID=… pnpm --filter @soropass/core exec tsx scripts/factory-e2e.ts
 */
import {
  rpc,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { readFileSync } from 'node:fs';
import { factoryDeployer } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const deployments = JSON.parse(
  readFileSync(new URL('../../../contracts/deployments.json', import.meta.url), 'utf8'),
) as { testnetV02: { accountFactory: { contractId: string } } };
const FACTORY_ID = process.env.FACTORY_ID ?? deployments.testnetV02.accountFactory.contractId;
const server = new rpc.Server(RPC_URL);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const bytesArg = (b: Uint8Array) => nativeToScVal(Buffer.from(b), { type: 'bytes' });

/** Simulate a read-only account method and return its native return value. */
async function read(contractId: string, fn: string, ...args: ReturnType<typeof bytesArg>[]) {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(contractId).call(fn, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error(`${fn}: simulation failed`);
  return scValToNative(sim.result.retval) as unknown;
}

async function main(): Promise<void> {
  console.log(`factory ${FACTORY_ID} on testnet, source ${SOURCE.publicKey()}\n`);

  const priv = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(priv, false);
  const otherKey = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const credentialId = 'demo-' + Buffer.from(publicKey.slice(1, 5)).toString('hex');

  const { contractId, txHash } = await factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: SOURCE.secret(),
  }).deploy({ publicKey, credentialId });
  console.log(`✅ factory deployed account ${contractId}  (deploy tx ${txHash})\n`);

  const enrolled = await read(contractId, 'is_signer', bytesArg(publicKey));
  const foreign = await read(contractId, 'is_signer', bytesArg(otherKey));
  const count = await read(contractId, 'signer_count');
  console.log(`is_signer(founding key): ${String(enrolled)}  (expect true)`);
  console.log(`is_signer(other key):    ${String(foreign)}  (expect false)`);
  console.log(`signer_count():          ${String(count)}  (expect 1)`);

  const ok = enrolled === true && foreign === false && count === 1;
  if (ok) {
    console.log(
      '\n✅ FACTORY PROOF — deploys a working account enrolling exactly the founding key.',
    );
    console.log(`   account: https://stellar.expert/explorer/testnet/contract/${contractId}`);
  } else {
    console.error('\n❌ factory proof did not hold', { enrolled, foreign, count });
  }
  process.exit(ok ? 0 : 1);
}

void main();
