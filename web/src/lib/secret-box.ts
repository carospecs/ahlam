import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.MARKETING_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("MARKETING_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function sealSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(value: string): string {
  const [version, iv, tag, ciphertext] = String(value || "").split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Stored token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
