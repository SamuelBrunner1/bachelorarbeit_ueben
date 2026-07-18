import { NextResponse, type NextRequest } from "next/server";
import {
  buildSecurityHeaders,
  isOriginAllowed,
  sanitizeUserMessage,
  isPromptInjectionAttempt,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/security";
import {
  checkRateLimit,
  getConversationState,
  getRecentConversationMessages,
} from "@/lib/services/conversation.service";
import { resolveStudioReply } from "@/lib/services/response.service";

export const runtime = "nodejs";

function isCorsAllowed(origin: string | null): boolean {
  return isOriginAllowed(origin);
}

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  return ip.slice(0, 8);
}

async function logSecurityEvent(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const requestId = crypto.randomUUID();
  const ip = getIp(req);
  const apiKey = req.headers.get("x-api-key")?.trim() || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const configuredApiKey = process.env.IMMOBOT_API_KEY?.trim();
  const sessionCookieName = process.env.SESSION_COOKIE_NAME?.trim() || SESSION_COOKIE_NAME;
  const sessionToken = req.cookies.get(sessionCookieName)?.value;

  if (origin && !isCorsAllowed(origin)) {
    await logSecurityEvent("warn", "cors_rejected", { requestId, ip: maskIp(ip), origin });
    return NextResponse.json({ reply: "CORS policy violation." }, { status: 403, headers: buildSecurityHeaders() });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    await logSecurityEvent("warn", "invalid_json", { requestId, ip: maskIp(ip) });
    return NextResponse.json({ reply: "Ungültige Anfrage." }, { status: 400, headers: buildSecurityHeaders() });
  }

  const message = typeof payload === "object" && payload !== null ? (payload as { message?: unknown }).message : undefined;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "Ungültige Anfrage." }, { status: 400, headers: buildSecurityHeaders() });
  }

  const sanitizedMessage = sanitizeUserMessage(message);
  if (!sanitizedMessage) {
    return NextResponse.json({ reply: "Ungültige Anfrage." }, { status: 400, headers: buildSecurityHeaders() });
  }

  if (sanitizedMessage.length > 300) {
    await logSecurityEvent("warn", "message_too_long", { requestId, ip: maskIp(ip) });
    return NextResponse.json(
      { reply: "Nachricht zu lang. Bitte auf 300 Zeichen begrenzen." },
      { status: 400, headers: buildSecurityHeaders() }
    );
  }

  let session = await verifySessionToken(sessionToken);
  if (!session && sessionToken && !sessionToken.includes(".")) {
    session = { sid: sessionToken, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 7 };
  }

  const hasValidApiKey = Boolean(configuredApiKey && apiKey && apiKey === configuredApiKey);
  const isAuthorized = hasValidApiKey || Boolean(session);

  if (!isAuthorized) {
    await logSecurityEvent("warn", "unauthorized_request", {
      requestId,
      ip: maskIp(ip),
      origin: origin || "none",
    });

    return NextResponse.json({ reply: "Unauthorized." }, { status: 401, headers: buildSecurityHeaders() });
  }

  const authBucket = hasValidApiKey ? `api:${configuredApiKey?.slice(0, 8) ?? "unknown"}` : `session:${session?.sid ?? "unknown"}`;
  const rateLimitBucket = `${ip}:${authBucket}`;

  if (!checkRateLimit(rateLimitBucket)) {
    await logSecurityEvent("warn", "rate_limited", { requestId, ip: maskIp(ip), bucket: authBucket });
    return NextResponse.json(
      { reply: "Die Demo ist aktuell ausgelastet. Bitte versuch es in wenigen Sekunden erneut." },
      { status: 429, headers: buildSecurityHeaders() }
    );
  }

  if (isPromptInjectionAttempt(sanitizedMessage)) {
    return NextResponse.json(
      { reply: "Ich helfe nur bei Fragen rund ums Fitnessstudio. Wobei kann ich dir konkret helfen?" },
      { headers: buildSecurityHeaders() }
    );
  }

  const sessionId = session?.sid;
  const currentState = sessionId ? getConversationState(sessionId) : undefined;
  const requestStart = Date.now();

  try {
    const reply = await resolveStudioReply({
      message: sanitizedMessage,
      sessionId,
      state: currentState,
      recentMessages: getRecentConversationMessages(sessionId),
      requestId,
    });

    await logSecurityEvent("info", "agent_request_completed", {
      requestId,
      ip: maskIp(ip),
      sessionId: sessionId ? sessionId.slice(0, 8) : "none",
      durationMs: Date.now() - requestStart,
    });

    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  } catch (error) {
    await logSecurityEvent("error", "agent_request_failed", {
      requestId,
      ip: maskIp(ip),
      sessionId: sessionId ? sessionId.slice(0, 8) : "none",
      durationMs: Date.now() - requestStart,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });

    throw error;
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: buildSecurityHeaders() });
}