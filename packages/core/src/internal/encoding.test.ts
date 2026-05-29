import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url, bytesToUtf8, utf8ToBytes } from './encoding';
import { bytesToHex } from './bytes';

describe('base64url + utf8 codecs', () => {
  it('decodes the embedded challenge to its UTF-8 value', () => {
    expect(bytesToUtf8(base64UrlToBytes('dG90YWxseVVuaXF1ZVZhbHVlRXZlcnlUaW1l'))).toBe(
      'totallyUniqueValueEveryTime',
    );
  });

  it('round-trips arbitrary bytes as url-safe, unpadded base64url', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 62, 63]);
    const encoded = bytesToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(bytesToHex(base64UrlToBytes(encoded))).toBe(bytesToHex(bytes));
  });

  it('accepts both padded base64 and unpadded base64url input', () => {
    expect(bytesToHex(base64UrlToBytes('AQID'))).toBe('010203');
    expect(bytesToHex(base64UrlToBytes('-_8'))).toBe('fbff');
  });

  it('utf8 round-trips multibyte text', () => {
    expect(bytesToUtf8(utf8ToBytes('héllo👋'))).toBe('héllo👋');
  });
});
