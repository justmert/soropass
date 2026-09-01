/**
 * Shared helper for the e2e scripts: rebuild a v1 envelope with an inflated
 * Soroban instruction budget + resource fee. Simulation runs before the auth
 * entries carry real signatures, so it under-budgets the expensive
 * secp256r1_verify; these margins make the signed run fit. stellar-sdk 17 XDR
 * values are immutable, so the bump is a rebuild, not an in-place mutation.
 */
import { xdr } from '@stellar/stellar-sdk';

export function bumpSorobanFees(
  envelope: xdr.TransactionEnvelope,
  opts: { resourceFee: bigint; txFee: number },
): xdr.TransactionEnvelope {
  if (envelope.type !== 'envelopeTypeTx') throw new Error('expected a v1 envelope');
  const tx = envelope.v1.tx;
  if (tx.ext.type !== 'sorobanData') return envelope;
  const sd = tx.ext.sorobanData;
  const res = sd.resources;
  return xdr.TransactionEnvelope.envelopeTypeTx(
    new xdr.TransactionV1Envelope({
      tx: new xdr.Transaction({
        sourceAccount: tx.sourceAccount,
        fee: opts.txFee,
        seqNum: tx.seqNum,
        cond: tx.cond,
        memo: tx.memo,
        operations: tx.operations,
        ext: xdr.TransactionExt.sorobanData(
          new xdr.SorobanTransactionData({
            ext: sd.ext,
            resources: new xdr.SorobanResources({
              footprint: res.footprint,
              instructions: Math.min(100_000_000, res.instructions * 5 + 30_000_000),
              diskReadBytes: res.diskReadBytes,
              writeBytes: res.writeBytes,
            }),
            resourceFee: opts.resourceFee,
          }),
        ),
      }),
      signatures: envelope.v1.signatures,
    }),
  );
}
