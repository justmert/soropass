import { afterEach, describe, expect, it } from 'vitest';
import {
  detectBrowserOS,
  detectCapabilities,
  probeES256Support,
  reportToMatrixRows,
  type ClientCapabilityReport,
} from './featureDetect';
import { MatrixRowSchema } from './matrixSchema';

const g = globalThis as { PublicKeyCredential?: unknown };

afterEach(() => {
  delete g.PublicKeyCredential;
});

const now = (): string => '2026-05-29';

describe('detectCapabilities', () => {
  it('degrades gracefully when WebAuthn is unavailable (e.g. Node)', async () => {
    delete g.PublicKeyCredential;
    const report = await detectCapabilities({ now });
    expect(report.source).toBe('live');
    expect(report.webauthnAvailable).toBe(false);
    expect(report.isUvpaa).toBeNull();
    expect(report.conditionalMediation).toBeNull();
    expect(report.clientCapabilities).toBeNull();
    expect(report.es256).toBe('untested');
    expect(report.pulledAt).toBe('2026-05-29');
  });

  it('maps isUVPAA / conditional mediation / getClientCapabilities', async () => {
    g.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
      isConditionalMediationAvailable: () => Promise.resolve(true),
      getClientCapabilities: () =>
        Promise.resolve({ conditionalGet: true, hybridTransport: false, relatedOrigins: true }),
    };
    const report = await detectCapabilities({ now });
    expect(report.webauthnAvailable).toBe(true);
    expect(report.isUvpaa).toBe(true);
    expect(report.conditionalMediation).toBe(true);
    expect(report.clientCapabilities).toEqual({
      conditionalGet: true,
      hybridTransport: false,
      relatedOrigins: true,
    });
  });

  it('returns null (not throw) when a probe rejects', async () => {
    g.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('boom')),
      // no isConditionalMediationAvailable, no getClientCapabilities
    };
    const report = await detectCapabilities({ now });
    expect(report.webauthnAvailable).toBe(true);
    expect(report.isUvpaa).toBeNull();
    expect(report.conditionalMediation).toBeNull();
    expect(report.clientCapabilities).toBeNull();
  });
});

describe('probeES256Support', () => {
  it('returns "supported" when create resolves', async () => {
    expect(await probeES256Support({ create: () => Promise.resolve(null) })).toBe('supported');
  });

  it('returns "unsupported" on NotSupportedError', async () => {
    const err = new Error('no ES256');
    err.name = 'NotSupportedError';
    expect(await probeES256Support({ create: () => Promise.reject(err) })).toBe('unsupported');
  });

  it('returns "untested" on other errors (e.g. NotAllowedError)', async () => {
    const err = new Error('cancelled');
    err.name = 'NotAllowedError';
    expect(await probeES256Support({ create: () => Promise.reject(err) })).toBe('untested');
  });

  it('returns "untested" when no create API is available', async () => {
    expect(await probeES256Support()).toBe('untested');
  });
});

describe('detectBrowserOS', () => {
  it('parses representative user agents', () => {
    expect(detectBrowserOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1.15')).toEqual({
      browser: 'Safari',
      os: 'iOS',
    });
    expect(
      detectBrowserOS('Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile Safari/537.36'),
    ).toEqual({ browser: 'Chrome', os: 'Android' });
    expect(detectBrowserOS('Mozilla/5.0 (Windows NT 10.0) Edg/126.0').os).toBe('Windows');
  });
});

describe('reportToMatrixRows', () => {
  it('produces schema-valid source:"live" rows keyed by detected browser+OS', () => {
    const report: ClientCapabilityReport = {
      source: 'live',
      pulledAt: '2026-05-29',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1.15',
      platform: 'iOS',
      webauthnAvailable: true,
      isUvpaa: true,
      conditionalMediation: true,
      clientCapabilities: { conditionalGet: true, hybridTransport: false },
      es256: 'supported',
    };
    const rows = reportToMatrixRows(report);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(() => MatrixRowSchema.parse(row)).not.toThrow();
      expect(row.source).toBe('live');
      expect(row.browser).toBe('Safari');
      expect(row.os).toBe('iOS');
    }
    const byFeature = (id: string) => rows.find((r) => r.feature === id);
    expect(byFeature('is_uvpaa')?.status).toBe('supported');
    expect(byFeature('hybrid_transport')?.status).toBe('unsupported');
    expect(byFeature('es256_alg')?.status).toBe('supported');
  });
});
