import { Keypair, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { directSubmission } from '../adapters/direct';
import type { SubmissionAdapter, SubmitResult } from '../adapters/types';
import { signTransaction, type SignVerifyOptions, type WebAuthnSigner } from './sign';

export interface SendSmartWalletTxOptions {
  /** The single wallet-authorized invocation to run (SAC transfer, contract call, add_signer, …). */
  operation: xdr.Operation;
  networkPassphrase: string;
  rpcUrl: string;
  /**
   * Secret of the funded classic account that pays the fee + sequences the tx. The
   * passkey provides the wallet's AUTH; this only sponsors the envelope
   * (ephemeral/friendbot-funded in a demo; a relayer key otherwise).
   */
  sourceSecret: string;
  /** The wallet's passkey signer that authorizes the invocation. */
  sign: WebAuthnSigner;
  /** Where the signed tx is submitted. Defaults to `direct` (soroban-rpc). */
  submission?: SubmissionAdapter;
  /** Opt-in pre-flight validation of the authorizing assertion. */
  verify?: SignVerifyOptions;
  fee?: string;
  timeoutSeconds?: number;
  /** Ledgers ahead of `latestLedger` to expire the auth signature at (default 60). */
  signatureExpirationLedgerOffset?: number;
  allowHttp?: boolean;
}

const DEFAULT_EXPIRATION_OFFSET = 60;

/**
 * Sign and submit a single passkey-authorized smart-wallet transaction — the
 * general primitive behind every smart-wallet action (payment, contract call,
 * add/remove signer). The full dance:
 *
 *   1. recording sim → assemble (discovers the wallet's auth requirement);
 *   2. sign the wallet auth entry with the passkey (smart-wallet Signatures map),
 *      binding the expiration ledger the contract re-derives;
 *   3. enforcing re-sim of the SIGNED tx — recording auth never runs the custom
 *      account's `__check_auth`, so it misses the signer-storage reads and
 *      under-counts instructions; the enforcing pass yields the true footprint +
 *      resources, and doubles as a client-side proof the auth is accepted;
 *   4. pay the fee from the classic source and submit via the pluggable adapter.
 *
 * tx.fee + sorobanData are outside the auth preimage, so re-assembling with the
 * enforcing resources never invalidates the signature. Throws a typed KitError on
 * any simulation/validation failure.
 */
export async function sendSmartWalletTx(options: SendSmartWalletTxOptions): Promise<SubmitResult> {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  let source: Keypair;
  try {
    source = Keypair.fromSecret(options.sourceSecret);
  } catch (cause) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'invalid fee-source secret', { cause });
  }

  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: options.fee ?? '2000000',
    networkPassphrase: options.networkPassphrase,
  })
    .addOperation(options.operation)
    .setTimeout(options.timeoutSeconds ?? 120)
    .build();

  const recSim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(recSim)) {
    const detail = 'error' in recSim ? String(recSim.error) : 'unknown simulation error';
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      `smart-wallet tx simulation failed: ${detail.slice(0, 300)}`,
    );
  }
  const prepared = rpc.assembleTransaction(tx, recSim).build();

  const signatureExpirationLedger =
    (await server.getLatestLedger()).sequence +
    (options.signatureExpirationLedgerOffset ?? DEFAULT_EXPIRATION_OFFSET);
  const signedAuthXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase: options.networkPassphrase,
    sign: options.sign,
    target: 'smart-wallet',
    signatureExpirationLedger,
    verify: options.verify,
  });

  const signedTx = TransactionBuilder.fromXDR(signedAuthXdr, options.networkPassphrase);
  const enfSim = await server.simulateTransaction(signedTx);
  if (!rpc.Api.isSimulationSuccess(enfSim)) {
    const detail = 'error' in enfSim ? String(enfSim.error) : 'unknown simulation error';
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      `signed smart-wallet tx failed enforcing simulation (auth rejected?): ${detail.slice(0, 300)}`,
    );
  }

  const finalTx = rpc.assembleTransaction(signedTx, enfSim).build();
  finalTx.sign(source);
  const submission =
    options.submission ??
    directSubmission({
      rpcUrl: options.rpcUrl,
      networkPassphrase: options.networkPassphrase,
      allowHttp: options.allowHttp,
    });
  return submission.send(finalTx.toXDR());
}
