// /lib/auth/jwt.ts
import "server-only";

export const COOKIE_NAME = process.env.COOKIE_NAME ?? "msw_m";
export const SESSION_TTL_SEC = parseInt(process.env.SESSION_TTL_SEC ?? "3600", 10);

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let str = Buffer.from(bytes).toString("base64");
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return new Uint8Array(Buffer.from(s + "=".repeat(pad), "base64"));
}

// Ensure ArrayBuffer (avoid SharedArrayBuffer typing issues)
const toAB = (v: ArrayBuffer | ArrayBufferView): ArrayBuffer => {
  if (v instanceof ArrayBuffer) return v;
  const view = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  const copy = new Uint8Array(view.length);
  copy.set(view);
  return copy.buffer;
};

let _hmacKey: CryptoKey | null = null;
async function getHmacKey(secret: string) {
  if (_hmacKey) return _hmacKey;
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) throw new Error("Web Crypto not available");
  _hmacKey = await cryptoObj.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return _hmacKey;
}

export type JwtPayload = {
  sub?: string;
  role?: string;
  hospitalId?: string;
  hospitalSlug?: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
};

const toSec = (ms: number) => Math.floor(ms / 1000);

export async function signJwt(payload: JwtPayload, opts?: { expiresInSec?: number }) {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) throw new Error("JWT_SECRET is not set");
  const key = await getHmacKey(secret);

  const header = { alg: "HS256", typ: "JWT" };
  const now = toSec(Date.now());
  const exp = opts?.expiresInSec ? now + opts.expiresInSec : undefined;
  const body: JwtPayload = { iat: now, ...(exp ? { exp } : {}), ...payload };

  const h = b64url(ENC.encode(JSON.stringify(header)));
  const p = b64url(ENC.encode(JSON.stringify(body)));
  const data = ENC.encode(`${h}.${p}`);

  const sigBuf = await crypto.subtle.sign("HMAC", key, toAB(data));
  const s = b64url(new Uint8Array(sigBuf));
  return `${h}.${p}.${s}`;
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) throw new Error("JWT_SECRET is not set");
  const key = await getHmacKey(secret);

  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new Error("Malformed JWT");

  const data = ENC.encode(`${h}.${p}`);
  const sig = b64urlDecode(s);
  const ok = await crypto.subtle.verify("HMAC", key, toAB(sig), toAB(data));
  if (!ok) throw new Error("Invalid signature");

  const payload: JwtPayload = JSON.parse(DEC.decode(b64urlDecode(p)));
  if (payload.exp && toSec(Date.now()) >= payload.exp) throw new Error("Token expired");
  return payload;
}

// ── session helpers ──
export async function signSession(payload: JwtPayload) {
  return signJwt(payload, { expiresInSec: SESSION_TTL_SEC });
}

export function sessionCookie(token: string, maxAgeSec = SESSION_TTL_SEC) {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: maxAgeSec,
    },
  };
}

export function expCookie(expUnixSec: number) {
  const now = toSec(Date.now());
  const maxAge = Math.max(0, expUnixSec - now);
  const secure = process.env.NODE_ENV === "production";
  return {
    name: "msw_exp",
    value: String(expUnixSec),
    options: {
      httpOnly: false,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge,
    },
  };
}

export function readExp(token: string): number | undefined {
  const [, p] = token.split(".");
  if (!p) return undefined;
  try {
    const payload = JSON.parse(DEC.decode(b64urlDecode(p))) as JwtPayload;
    return payload.exp;
  } catch {
    return undefined;
  }
}




