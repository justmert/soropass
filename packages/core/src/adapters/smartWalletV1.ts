import { Address, Keypair, Operation, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { sha256 } from '@noble/hashes/sha256';
import { KitError } from '../errors';
import { hexToBytes } from '../internal/bytes';
import { decodeChallenge } from '../webauthn/clientData';
import { buildSecp256r1Signer } from '../soroban/signer';
import { buildSignerKeyScVal } from '../soroban/smartWallet';
import { deriveSmartWalletAddress } from '../soroban/address';
import { collectEventsToTip } from './eventsPaging';
import type { AccountDeployer } from '../ceremonies/types';
import type { IndexerAdapter, ResolvedAccount } from './types';

/** The canonical audited v1 smart-wallet wasm hash on testnet (kalepail #32). */
export const SMART_WALLET_V1_WASM_HASH =
  '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';

export interface SmartWalletV1DeployerOptions {
  rpcUrl: string;
  networkPassphrase: string;
  /**
   * Secret of the funded classic account that deploys + pays. It must be STABLE so
   * the deployed address stays offline-derivable via {@link deriveSmartWalletAddress}
   * (the deployer is part of the contract-id preimage). In a demo this is a fixed
   * friendbot-funded key; in production a wallet team's deployer/relayer.
   */
  deployerSecret: string;
  /** v1 smart-wallet wasm hash (hex). Defaults to the canonical testnet hash. */
  wasmHash?: string;
  allowHttp?: boolean;
  fee?: string;
}

/**
 * `AccountDeployer` for the passkey-kit **v1 smart-wallet**: deploys a fresh wallet
 * from the audited wasm via `createCustomContract`, salted by
 * `sha256(rawCredentialId)` from a fixed deployer — so the address is deterministic
 * and offline-derivable. The contract's first `add_signer` (from `__constructor`)
 * is unauthenticated, so the deploy is a plain source-signed transaction. Pair with
 * {@link deriveSmartWalletAddress} for `getAddress` and {@link smartWalletV1Indexer}
 * for recovery.
 */
export function smartWalletV1Deployer(options: SmartWalletV1DeployerOptions): AccountDeployer {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  const source = Keypair.fromSecret(options.deployerSecret);
  const wasmHash = options.wasmHash ?? SMART_WALLET_V1_WASM_HASH;
  return {
    async deploy(input) {
      const raw = decodeChallenge(input.credentialId);
      const contractId = deriveSmartWalletAddress({
        deployer: source.publicKey(),
        credentialId: input.credentialId,
        networkPassphrase: options.networkPassphrase,
      });
      const op = Operation.createCustomContract({
        address: Address.fromString(source.publicKey()),
        wasmHash: hexToBytes(wasmHash),
        salt: sha256(raw),
        constructorArgs: [buildSecp256r1Signer({ credentialId: raw, publicKey: input.publicKey })],
      });
      const account = await server.getAccount(source.publicKey());
      const tx = new TransactionBuilder(account, {
        fee: options.fee ?? '10000000',
        networkPassphrase: options.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(120)
        .build();
      const sim = await server.simulateTransaction(tx);
      if (!rpc.Api.isSimulationSuccess(sim)) {
        throw new KitError('CONTRACT_AUTH_FAILED', 'smart-wallet v1 deploy simulation failed');
      }
      const prepared = rpc.assembleTransaction(tx, sim).build();
      prepared.sign(source);
      const sent = await server.sendTransaction(prepared);
      if (sent.status === 'ERROR') {
        throw new KitError('NETWORK_ERROR', 'smart-wallet v1 deploy submit error');
      }
      const final = await server.pollTransaction(sent.hash);
      if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new KitError('CONTRACT_AUTH_FAILED', `smart-wallet v1 deploy ${final.status}`);
      }
      return { contractId, txHash: sent.hash };
    },
  };
}

const LEDGERS_PER_DAY = 17_280; // ~5s ledgers

export interface SmartWalletV1IndexerOptions {
  rpcUrl: string;
  /** Ledger to scan from; defaults to ~1 day back. The events RPC retains a limited window. */
  startLedger?: number;
  allowHttp?: boolean;
}

/**
 * `IndexerAdapter` for the v1 smart-wallet: resolves a credential id → wallet
 * address from the on-chain `signer_added` events. Schema confirmed empirically
 * against the deployed v0.13.0 wasm (`scripts/v1-events-probe.ts`):
 * `topic[0]=Symbol("signer_added")`, `topic[1]=SignerKey::Secp256r1(rawCredId)`,
 * and the wallet is the EMITTING contract. Works for BOTH the founding credential
 * (deploy emits `signer_added`) and signers added later via `add_signer`.
 *
 * A single `getEvents` call only scans a bounded ledger slice from `startLedger`
 * (not the whole window) and returns a cursor, so a naive one-shot query misses
 * events near the tip — the exact reason recovery of a just-created wallet found
 * nothing. We therefore PAGINATE by cursor from `startLedger` to the tip,
 * accumulating every wallet the credential signs for. soroban-rpc retains only a
 * limited window, so this is the zero-infra default for recent wallets; use a
 * persistent indexer (Mercury) for older ones.
 */
export function smartWalletV1Indexer(options: SmartWalletV1IndexerOptions): IndexerAdapter {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  return {
    async resolveByCredential(credentialId: string): Promise<ResolvedAccount[]> {
      const raw = decodeChallenge(credentialId);
      // Filter directly on the two topics: the event name + this credential's SignerKey.
      const filters = [
        {
          type: 'contract' as const,
          topics: [
            [
              xdr.ScVal.scvSymbol('signer_added').toXDR('base64'),
              buildSignerKeyScVal(raw).toXDR('base64'),
            ],
          ],
        },
      ];
      const startLedger =
        options.startLedger ??
        Math.max(1, (await server.getLatestLedger()).sequence - LEDGERS_PER_DAY);

      const events = await collectEventsToTip(server, filters, startLedger);
      const seen = new Set<string>();
      const accounts: ResolvedAccount[] = [];
      for (const event of events) {
        const contractId = event.contractId?.toString();
        if (contractId && !seen.has(contractId)) {
          seen.add(contractId);
          accounts.push({ contractId });
        }
      }
      return accounts;
    },
  };
}
