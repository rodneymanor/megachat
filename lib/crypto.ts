/**
 * Optional app-layer encryption for workspace secret columns
 * (`late_api_key_encrypted`, `ai_api_key`), controlled entirely by the
 * `ENCRYPTION_KEY` env var:
 *
 * - Unset (self-host default): `encryptSecret` is a passthrough, keys are
 *   stored plaintext exactly as before. Zero-config self-host stays
 *   zero-config.
 * - Set (recommended for hosted): AES-256-GCM, key derived by SHA-256
 *   hashing whatever string is in `ENCRYPTION_KEY` (any length/format is
 *   forgiven — there's always a valid 32-byte key underneath). Stored
 *   format is `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 *
 * Legacy plaintext fallback: `decryptSecret` returns any value that doesn't
 * start with the `enc:v1:` prefix as-is. This means existing plaintext rows
 * keep working unmodified after `ENCRYPTION_KEY` is turned on — they
 * re-encrypt naturally the next time the user saves their keys via the
 * Settings page (which always writes through `encryptSecret`).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** Encrypts `plain` when `ENCRYPTION_KEY` is set; otherwise returns it unchanged. */
export function encryptSecret(plain: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || !plain) return plain;

  const key = deriveKey(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts a value produced by `encryptSecret`. Null/empty passthrough.
 * Values without the `enc:v1:` prefix are returned as-is (legacy plaintext
 * rows, or `ENCRYPTION_KEY` never having been set). Throws if the value is
 * tagged `enc:v1:` but fails to decrypt — almost always an `ENCRYPTION_KEY`
 * mismatch (rotated, or missing on this deployment).
 */
export function decryptSecret(stored: string | null): string | null {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored;

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "Cannot decrypt stored secret: value is encrypted (enc:v1:) but ENCRYPTION_KEY is not set on this deployment."
    );
  }

  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Cannot decrypt stored secret: malformed enc:v1: payload.");
  }
  const [ivB64, tagB64, ciphertextB64] = parts;

  try {
    const key = deriveKey(encryptionKey);
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch (err) {
    throw new Error(
      `Failed to decrypt stored secret: likely an ENCRYPTION_KEY mismatch (the key used to encrypt this value differs from the current ENCRYPTION_KEY). Original error: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Like `decryptSecret`, but never throws: an `ENCRYPTION_KEY` mismatch (or
 * any other decrypt failure) is logged and reported as `null` instead of
 * blowing up the caller. Use this at call sites that would otherwise crash
 * a flow-engine/webhook run over a key rotation — treating a failed decrypt
 * the same as "no key configured" so it degrades instead of throwing.
 */
export function tryDecryptSecret(stored: string | null): string | null {
  try {
    return decryptSecret(stored);
  } catch (err) {
    console.error(
      `tryDecryptSecret: failed to decrypt stored secret, treating as unset: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return null;
  }
}
