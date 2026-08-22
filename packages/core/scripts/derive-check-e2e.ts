/**
 * Proves offline `deriveAccountAddress` (v0.2, key-bound salt) equals the address
 * the on-chain factory actually deploys. This is the guarantee `getAddress` relies on.
 * Run: SOURCE_SECRET=… FACTORY_ID=… pnpm --filter @soropass/core exec tsx scripts/derive-check-e2e.ts
 */
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { readFileSync } from 'node:fs';
import { deriveAccountAddress, factoryDeployer } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const SOURCE = Keypair.fromSecret(process.env.SOURCE_SECRET ?? '');
const deployments = JSON.parse(
  readFileSync(new URL('../../../contracts/deployments.json', import.meta.url), 'utf8'),
) as { testnetV02: { accountFactory: { contractId: string } } };
const FACTORY_ID = process.env.FACTORY_ID ?? deployments.testnetV02.accountFactory.contractId;

async function main(): Promise<void> {
  const priv = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(priv, false);
  const credentialId = 'derivecheck-' + Buffer.from(publicKey.slice(1, 4)).toString('hex');

  const offline = deriveAccountAddress({
    factoryContractId: FACTORY_ID,
    credentialId: new TextEncoder().encode(credentialId),
    publicKey,
    networkPassphrase: NETWORK,
  });
  const { contractId } = await factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: SOURCE.secret(),
  }).deploy({ publicKey, credentialId });

  console.log('offline derived  :', offline);
  console.log('on-chain deployed:', contractId);
  const ok = offline === contractId;
  console.log(ok ? '✅ MATCH — deriveAccountAddress === factory-deployed address' : '❌ MISMATCH');
  process.exit(ok ? 0 : 1);
}

void main();
