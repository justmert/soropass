// Synchronous, isomorphic SHA-256. We reuse @noble/hashes (already a dependency
// for p256) instead of the async crypto.subtle so the payload primitives stay
// synchronous and dependency-consistent.
import { sha256 } from '@noble/hashes/sha256';

export { sha256 };
