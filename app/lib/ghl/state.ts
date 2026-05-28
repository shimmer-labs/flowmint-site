/**
 * OAuth state token: CSRF protection plus a provider tag.
 *
 * The state token is sent to GHL during install and returned in the callback.
 * We sign it with HMAC-SHA256 using OAUTH_STATE_SECRET so a callback can't be
 * forged by an attacker who doesn't know the secret. Provider tag lets one
 * callback route ("/api/integrations/callback") serve multiple providers.
 *
 * Token format (URL-safe): base64url(payload).base64url(signature)
 * Payload: JSON { uid, provider, nonce, exp }
 *   - uid: FlowMint user id (so the callback can write the right row)
 *   - provider: "ghl" for now; future "notion", etc.
 *   - nonce: 16 random bytes, hex
 *   - exp: unix-seconds expiry (15 min after issuance)
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 15 * 60;

export interface StatePayload {
  uid: string;
  provider: string;
  nonce: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET not set in environment");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  // restore padding
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64");
}

function sign(payloadEncoded: string): string {
  const mac = createHmac("sha256", getSecret());
  mac.update(payloadEncoded);
  return base64UrlEncode(mac.digest());
}

/** Mint a signed state token for the given FlowMint user + provider. */
export function signState(uid: string, provider: string): string {
  const payload: StatePayload = {
    uid,
    provider,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

/**
 * Verify a state token returned by the provider's callback.
 * Returns the payload on success, throws on tamper / expiry / shape errors.
 */
export function verifyState(token: string): StatePayload {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("malformed state token");
  }
  const [payloadEncoded, providedSig] = parts;

  const expectedSig = sign(payloadEncoded);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("state signature mismatch");
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString("utf8"));
  } catch {
    throw new Error("state payload not valid JSON");
  }

  if (
    typeof payload.uid !== "string" ||
    typeof payload.provider !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("state payload shape invalid");
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("state token expired");
  }

  return payload;
}
