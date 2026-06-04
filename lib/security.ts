const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE_NAME = "immo_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001,http://72.62.37.25:3000,http://brunner-software.com,http://www.brunner-software.com";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  // Allow localhost and 127.0.0.1 with any port during development
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    // ignore parse errors
  }

  return false;
}

export function buildSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (isProduction()) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains";

    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",

      // Next.js Runtime / API / WebSockets
      "connect-src 'self' https: wss:",

      // Bilder
      "img-src 'self' data: blob: https:",

      // Fonts
      "font-src 'self' data: https:",

      // Tailwind / Next.js Styles
      "style-src 'self' 'unsafe-inline'",

      // Next.js benötigt oft Inline Runtime Scripts
      "script-src 'self' 'unsafe-inline'",

      // Web Worker
      "worker-src 'self' blob:",
    ].join("; ");
  }

  return headers;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSessionSecret(): string {
  return process.env.IMMOBOT_SESSION_SECRET || "dev-only-session-secret-change-me";
}

async function hmacSignature(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export type SessionPayload = {
  sid: string;
  iat: number;
  exp: number;
};

export async function createSessionToken(): Promise<string> {
  const payload: SessionPayload = {
    sid: crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };

  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSignature(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;

  const expectedSignature = await hmacSignature(payloadEncoded);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payloadJson = decoder.decode(fromBase64Url(payloadEncoded));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload?.sid || typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function sanitizeUserMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(the\s+)?prompt/i,
  /print\s+(the\s+)?instructions/i,
  /bypass\s+(all\s+)?rules/i,
  /jailbreak/i,
  /confidential\s+data/i,
  /show\s+me\s+your\s+instructions/i,
];

export function isPromptInjectionAttempt(message: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}
