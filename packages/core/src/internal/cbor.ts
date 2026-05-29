/**
 * A minimal CBOR (RFC 8949) decoder — only the major types WebAuthn needs:
 * unsigned ints, negative ints, byte strings, text strings, arrays and maps,
 * with 1/2/4-byte length prefixes. Indefinite lengths, tags, floats and
 * 8-byte lengths are intentionally unsupported (COSE keys and attestation
 * objects never use them) and throw. This keeps the SDK dependency-free while
 * staying robust — it is fully fixture-tested. It replaces passkey-kit's
 * hardcoded byte-offset scanning, which had no bounds checks.
 */
export type CborValue = number | bigint | Uint8Array | string | CborValue[] | CborMap;
export type CborMap = Map<number | string, CborValue>;

interface Decoded {
  value: CborValue;
  /** Total bytes consumed starting at the requested offset. */
  length: number;
}

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) throw new Error(`CBOR: unexpected end of input at byte ${index}`);
  return value;
}

/** Decode the first CBOR item at `offset`, returning its value and byte length. */
const MAX_DEPTH = 16; // COSE keys / attestation objects nest at most ~3 levels.

export function decodeCbor(bytes: Uint8Array, offset = 0, depth = 0): Decoded {
  if (depth > MAX_DEPTH) throw new Error('CBOR: maximum nesting depth exceeded');
  const first = byteAt(bytes, offset);
  const major = first >> 5;
  const info = first & 0x1f;
  let pos = offset + 1;

  let argument: number;
  if (info < 24) {
    argument = info;
  } else if (info === 24) {
    argument = byteAt(bytes, pos);
    pos += 1;
  } else if (info === 25) {
    argument = (byteAt(bytes, pos) << 8) | byteAt(bytes, pos + 1);
    pos += 2;
  } else if (info === 26) {
    argument =
      byteAt(bytes, pos) * 0x1000000 +
      (byteAt(bytes, pos + 1) << 16) +
      (byteAt(bytes, pos + 2) << 8) +
      byteAt(bytes, pos + 3);
    pos += 4;
  } else {
    throw new Error(`CBOR: unsupported length encoding (additional info ${info})`);
  }

  switch (major) {
    case 0: // unsigned integer
      return { value: argument, length: pos - offset };
    case 1: // negative integer
      return { value: -1 - argument, length: pos - offset };
    case 2: {
      // byte string
      const end = pos + argument;
      if (end > bytes.length) throw new Error('CBOR: byte string exceeds input');
      return { value: bytes.slice(pos, end), length: end - offset };
    }
    case 3: {
      // text string (UTF-8)
      const end = pos + argument;
      if (end > bytes.length) throw new Error('CBOR: text string exceeds input');
      return { value: new TextDecoder().decode(bytes.slice(pos, end)), length: end - offset };
    }
    case 4: {
      // array
      const items: CborValue[] = [];
      let cursor = pos;
      for (let i = 0; i < argument; i += 1) {
        const item = decodeCbor(bytes, cursor, depth + 1);
        items.push(item.value);
        cursor += item.length;
      }
      return { value: items, length: cursor - offset };
    }
    case 5: {
      // map
      const map: CborMap = new Map();
      let cursor = pos;
      for (let i = 0; i < argument; i += 1) {
        const key = decodeCbor(bytes, cursor, depth + 1);
        cursor += key.length;
        const val = decodeCbor(bytes, cursor, depth + 1);
        cursor += val.length;
        if (typeof key.value !== 'number' && typeof key.value !== 'string') {
          throw new Error('CBOR: unsupported map key type');
        }
        if (map.has(key.value)) {
          throw new Error('CBOR: duplicate map key (non-canonical)');
        }
        map.set(key.value, val.value);
      }
      return { value: map, length: cursor - offset };
    }
    default:
      throw new Error(`CBOR: unsupported major type ${major}`);
  }
}

export function decodeCborFirst(bytes: Uint8Array): CborValue {
  return decodeCbor(bytes, 0).value;
}
