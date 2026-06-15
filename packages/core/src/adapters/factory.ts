import {
  rpc,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import type { AccountDeployer } from '../ceremonies/types';

export interface FactoryDeployerOptions {
  rpcUrl: string;
  networkPassphrase: string;
  /** The deployed `AccountFactory` contract id (`C…`) — see contracts/account-factory. */
  factoryContractId: string;
  /**
   * Secret of the testnet account that pays the fee + signs the deploy tx. The
   * factory's `deploy` is not auth-gated, so this just sources/sponsors the
   * transaction. In a public demo this is an ephemeral, friendbot-funded key —
   * never a key with value.
   */
  sourceSecret: string;
  allowHttp?: boolean;
  fee?: string;
}

/**
 * `AccountDeployer` backed by the on-chain `AccountFactory`: invokes
 * `factory.deploy(public_key, credential_id)`, which deploys a fresh
 * `webauthn-account` for the passkey and emits the `(deployed, credentialId)`
 * event the `eventsIndexer` resolves. Returns the new smart-account C-address.
 * This is the real "create a passkey wallet on-chain" path.
 */
export function factoryDeployer(options: FactoryDeployerOptions): AccountDeployer {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  const source = Keypair.fromSecret(options.sourceSecret);
  return {
    async deploy(input) {
      const pk = nativeToScVal(Buffer.from(input.publicKey), { type: 'bytes' });
      const cred = nativeToScVal(Buffer.from(new TextEncoder().encode(input.credentialId)), {
        type: 'bytes',
      });
      const account = await server.getAccount(source.publicKey());
      const tx = new TransactionBuilder(account, {
        fee: options.fee ?? '2000000',
        networkPassphrase: options.networkPassphrase,
      })
        .addOperation(new Contract(options.factoryContractId).call('deploy', pk, cred))
        .setTimeout(120)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (!rpc.Api.isSimulationSuccess(sim)) {
        throw new KitError('CONTRACT_AUTH_FAILED', 'factory deploy simulation failed');
      }
      const prepared = rpc.assembleTransaction(tx, sim).build();
      prepared.sign(source);

      const sent = await server.sendTransaction(prepared);
      if (sent.status === 'ERROR') {
        throw new KitError('NETWORK_ERROR', 'factory deploy submit error');
      }
      const final = await server.pollTransaction(sent.hash);
      if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new KitError('CONTRACT_AUTH_FAILED', `factory deploy ${final.status}`);
      }
      const ret = (final as { returnValue?: unknown }).returnValue;
      const contractId = ret ? String(scValToNative(ret as never)) : '';
      return { contractId, txHash: sent.hash };
    },
  };
}
