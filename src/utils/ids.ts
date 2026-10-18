import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 UUID from the platform CSPRNG — used as idempotency keys and sample ids. */
export const newId = (): string => Crypto.randomUUID();
