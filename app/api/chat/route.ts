import { NextResponse, type NextRequest } from "next/server";
import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import fitness from "@/data/fitness.json";
import faqs from "@/data/faqs.json";
import {
  buildSecurityHeaders,
  isOriginAllowed,
  sanitizeUserMessage,
  isPromptInjectionAttempt,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/security";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConversationState = {
  isLead: boolean;
  isBooking: boolean;
  selectedProperty?: string;
  selectedTime?: string;
  selectedLocation?: string;
  lastIntent?: string;
  messages: ConversationMessage[];
  lastUpdated: number;
};

type FitnessOffer = (typeof fitness)[number];

const RATE_LIMIT_WINDOW_MS = 90_000;
const RATE_LIMIT_MAX = 15;
const CONVERSATION_STATE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CONVERSATION_MESSAGES = 8;
const requestLog: Map<string, number[]> = new Map();
const conversationStateLog: Map<string, ConversationState> = new Map();

const SYSTEM_PROMPT = `Du bist ein freundlicher und professioneller Kundenberater eines Fitnessstudios.

Deine Aufgabe:
- beantworte Fragen zu unserem Fitnessstudio (Öffnungszeiten, Preise, Kurse, Anmeldung)
- nutze ausschließlich bereitgestellte Informationen
- erfinde keine Daten

Verhalten:
- kurz und klar (2–4 Sätze)
- freundlich und natürlich
- wie ein echter Mitarbeiter

WICHTIG:
1. Wenn Infos vorhanden → konkrete Antwort + nächste Aktion (Probetraining)
2. Wenn keine Infos → freundlich nach Details fragen
3. Off-Topic → zurück zum Thema Fitness lenken
4. Smalltalk → kurz + zurück zum Thema
5. Wenn Nutzer Interesse an Termin zeigt:
   → bestätigen ("vorgemerkt")
   → Hinweis auf Bestätigungsmail`;

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

  try {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "security.log");
    await mkdir(logDir, { recursive: true });
    await appendFile(logFile, `${line}\n`, "utf8");
  } catch {
    // best-effort logging only
  }
}

function checkRateLimit(bucketKey: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(bucketKey) || []).filter((time) => time > windowStart);
  recent.push(now);
  requestLog.set(bucketKey, recent);
  return recent.length <= RATE_LIMIT_MAX;
}

function trimConversationMessages(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CONVERSATION_MESSAGES);
}

function getConversationState(sessionId: string): ConversationState {
  const now = Date.now();
  const existing = conversationStateLog.get(sessionId);

  if (!existing) {
    const freshState: ConversationState = {
      isLead: false,
      isBooking: false,
      messages: [],
      lastUpdated: now,
    };

    conversationStateLog.set(sessionId, freshState);
    return freshState;
  }

  if (now - existing.lastUpdated > CONVERSATION_STATE_TTL_MS) {
    const resetState: ConversationState = {
      isLead: false,
      isBooking: false,
      messages: [],
      lastUpdated: now,
    };

    conversationStateLog.set(sessionId, resetState);
    return resetState;
  }

  return { ...existing, messages: existing.messages || [] };
}

function updateConversationState(sessionId: string, patch: Partial<ConversationState>) {
  const current = getConversationState(sessionId);
  conversationStateLog.set(sessionId, {
    ...current,
    ...patch,
    messages: patch.messages ?? current.messages,
    lastUpdated: Date.now(),
  });
}

function appendConversationTurn(
  sessionId: string,
  userMessage: string,
  assistantMessage: string
) {
  const current = getConversationState(sessionId);
  const nextMessages = trimConversationMessages([
    ...current.messages,
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  ]);

  conversationStateLog.set(sessionId, {
    ...current,
    messages: nextMessages,
    lastUpdated: Date.now(),
  });
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9äöüß\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function containsAny(message: string, phrases: string[]): boolean {
  const normalized = normalizeText(message);
  return phrases.some((phrase) => normalized.includes(phrase));
}

function isGreetingOnly(message: string): boolean {
  return ["hallo", "hi", "servus", "hey", "guten tag"].includes(normalizeText(message));
}

function isSmalltalkMessage(message: string): boolean {
  return containsAny(message, ["wie gehts", "wie geht es", "alles gut", "guten morgen", "guten abend"]);
}

function isIdentityQuestion(message: string): boolean {
  return containsAny(message, ["wer bist du", "wer sind sie", "was bist du", "was ist dein name", "wie heißt du", "wo bist du"]);
}




function isInfoQuestion(message: string): boolean {
  return containsAny(message, [
    "öffnungszeiten",
    "oeffnungszeiten",
    "preise",
    "kosten",
    "mitgliedschaft",
    "mitgliedschaften",
    "kurse",
    "standort",
    "personal training",
    "wo",
    "wann habt ihr offen",
  ]);
}

function isInterestIntent(message: string): boolean {
  return containsAny(message, ["interesse", "interessiert", "vormerken", "probetraining", "anmeldung", "mitmachen", "einsteigen"]);
}

function isProbetrainingRequest(message: string): boolean {
  return containsAny(message, ["ich möchte ein probetraining", "ich will ein probetraining", "probetraining", "vorbeikommen", "kann ich vorbeikommen"]);
}

function isBookingIntent(message: string): boolean {
  return containsAny(message, ["termin", "buchen"]);
}

function isYesIntent(message: string): boolean {
  return ["ja", "ja bitte", "gerne", "ok", "okay", "bitte", "klar"].includes(normalizeText(message));
}

function isFitnessTopic(message: string): boolean {
  return containsAny(message, [
    "fitness",
    "studio",
    "mitgliedschaft",
    "mitgliedschaften",
    "kurs",
    "kurse",
    "preis",
    "preise",
    "kosten",
    "öffnungszeiten",
    "oeffnungszeiten",
    "anmeldung",
    "probetraining",
    "training",
  ]);
}


function isCapabilityQuestion(message: string): boolean {
  return containsAny(message, [
    "was kannst du",
    "was kannst du machen",
    "wie kannst du helfen",
    "wobei kannst du helfen",
  ]);
}


function extractTime(message: string): string | null {
  const explicit = message.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  if (explicit) return explicit[0];

  const normalized = normalizeText(message);
  const patterns = [
    { phrase: "morgen vormittag", value: "morgen Vormittag" },
    { phrase: "morgen nachmittag", value: "morgen Nachmittag" },
    { phrase: "morgen abend", value: "morgen Abend" },
    { phrase: "übermorgen", value: "übermorgen" },
    { phrase: "uebermorgen", value: "übermorgen" },
    { phrase: "morgen", value: "morgen" },
    { phrase: "vormittag", value: "Vormittag" },
    { phrase: "nachmittag", value: "Nachmittag" },
    { phrase: "abend", value: "Abend" },
    { phrase: "heute", value: "heute" },
  ];

  const match = patterns.find((entry) => normalized.includes(entry.phrase));
  return match ? match.value : null;
}

function extractLocation(message: string): string | null {
  const normalized = normalizeText(message);
  const districtMatch = normalized.match(/\b(\d{1,2})\.?\s*(?:ten|ter)?\s*bezirk\b/);
  if (districtMatch) {
    const district = Number.parseInt(districtMatch[1], 10);
    if (!Number.isNaN(district) && district >= 1 && district <= 23) {
      return district < 10 ? `10${district}0` : `1${district}0`;
    }
  }

  const postalMatch = normalized.match(/\b1\d{3}\b/);
  if (postalMatch) return postalMatch[0];
  if (normalized.includes("wien")) return "wien";
  if (normalized.includes("graz")) return "graz";
  return null;
}

function extractPriceNumber(price: string): number {
  const digits = price.replace(/\D/g, "");
  return Number.parseInt(digits, 10) || 0;
}

function getOfferByPrice(ascending: boolean): FitnessOffer | null {
  const sorted = [...fitness].sort((left, right) => {
    const leftPrice = extractPriceNumber(left.price);
    const rightPrice = extractPriceNumber(right.price);
    return ascending ? leftPrice - rightPrice : rightPrice - leftPrice;
  });

  return sorted[0] || null;
}

function getOfferByIntent(message: string, state?: ConversationState): FitnessOffer | null {
  const normalized = normalizeText(message);

  if (state?.selectedProperty) {
    const existing = fitness.find((entry) => entry.title === state.selectedProperty);
    if (existing) return existing;
  }

  const directMatch = fitness.find((entry) => {
    const title = normalizeText(entry.title);
    return normalized.includes(title) || title.includes(normalized);
  });
  if (directMatch) return directMatch;

  if (normalized.includes("probetraining")) {
    return fitness.find((entry) => normalizeText(entry.title).includes("probetraining")) || null;
  }

  if (normalized.includes("kurs") || normalized.includes("premium")) {
    return fitness.find((entry) => normalizeText(entry.title).includes("premium")) || fitness[0] || null;
  }

  if (normalized.includes("mitgliedschaft") || normalized.includes("basic")) {
    return fitness.find((entry) => normalizeText(entry.title).includes("basic")) || fitness[0] || null;
  }

  const location = extractLocation(message);
  if (location) {
    const locationMatch = fitness.find((entry) => normalizeText(entry.location).includes(location.toLowerCase()));
    if (locationMatch) return locationMatch;
  }

  return null;
}

function buildOfferReply(offer: FitnessOffer, label: string): string {
  return `${label}\n\n• ${offer.title}\n  Preis: ${offer.price}\n  Standort: ${offer.location}\n  Beschreibung: ${offer.description}\n  Verfügbar: ${offer.available}\n\nWenn du möchtest, merke ich dir direkt ein Probetraining vor.`;
}

function buildBookingSummary(selectedProperty: string, selectedTime: string): string {
  return `Perfekt, hier die Zusammenfassung:\n\n• Angebot: ${selectedProperty}\n• Termin: ${selectedTime}\n\nIch habe den Termin für dich vorgemerkt. Eine Bestätigungsmail folgt in Kürze.`;
}

function buildInterestReply(): string {
  return "Sehr gerne! Du kannst jederzeit ohne Anmeldung für ein Probetraining vorbeikommen. Wenn du möchtest, kann ich dir vorab noch etwas zum Training oder zu unseren Angeboten erklären.";
}

function buildInfoReply(message: string): string {
  const normalized = normalizeText(message);

  if (normalized.includes("mitgliedschaft") || normalized.includes("mitgliedschaften")) {
    return "Wir bieten folgende Mitgliedschaften an:\n\n• Basic – 29€ pro Monat\n• Advanced – 39€ pro Monat\n• Premium – 49€ pro Monat\n\nDu kannst auch jederzeit kostenlos ein Probetraining machen und dir alles vor Ort anschauen.";
  }

  if (normalized.includes("öffnungszeiten") || normalized.includes("oeffnungszeiten") || normalized.includes("wann habt ihr offen")) {
    return "Wir haben Montag bis Sonntag von 06:00 bis 22:00 Uhr geöffnet. An Feiertagen sind wir von 08:00 bis 18:00 Uhr für dich da.";
  }

  if (normalized.includes("kurs")) {
    return "Unsere Kurse sind Yoga, HIIT, Spinning, Functional Training und Pilates. Kurse finden täglich vormittags und abends statt.";
  }

  if (normalized.includes("standort") || normalized.includes("wo")) {
    return "Unser Fitnessstudio befindet sich zentral in Wien und ist gut erreichbar.";
  }

  if (normalized.includes("preis") || normalized.includes("preise") || normalized.includes("kosten")) {
    return "Wir bieten folgende Mitgliedschaften an:\n\n• Basic – 29€ pro Monat\n• Advanced – 39€ pro Monat\n• Premium – 49€ pro Monat\n\nDu kannst auch jederzeit kostenlos ein Probetraining machen und dir alles vor Ort anschauen.";
  }

  if (normalized.includes("personal training")) {
    return "Ja, wir bieten auch Personal Training an. Die Preise starten ab 60€ pro Einheit. Wenn du möchtest, kann ich dir mehr dazu erzählen oder dir den Einstieg erleichtern.";
  }

  return "Gerne helfe ich dir mit Informationen zu Öffnungszeiten, Preisen, Kursen oder dem Standort weiter.";
}

function buildOffTopicReply(): string {
  return "Das kann ich dir gerade nicht genau beantworten. Melde dich gerne direkt bei uns:\n\n📞 +43 1234567\n📧 demo@email.com";
}

function buildKnowledgeContext(message: string): string {
  const normalized = normalizeText(message);
  const tokens = Array.from(
    new Set(
      normalized
        .split(" ")
        .map((part) => part.trim())
        .filter((part) => part.length > 2)
    )
  );

  const matches: Array<{ type: "faq" | "offer"; text: string; score: number }> = [];

  for (const entry of faqs as Array<{ question: string; answer: string; tags?: string[] }>) {
    const text = normalizeText(`${entry.question} ${entry.answer} ${(entry.tags || []).join(" ")}`);
    const score = tokens.reduce((current, token) => current + (text.includes(token) ? 1 : 0), 0);
    if (score > 0) {
      matches.push({ type: "faq", text: `Frage: ${entry.question}\nAntwort: ${entry.answer}`, score });
    }
  }

  for (const offer of fitness) {
    const text = normalizeText(`${offer.title} ${offer.price} ${offer.location} ${offer.description} ${offer.available}`);
    const score = tokens.reduce((current, token) => current + (text.includes(token) ? 1 : 0), 0);
    if (score > 0) {
      matches.push({ type: "offer", text: JSON.stringify(offer), score });
    }
  }

  const selected = matches.sort((left, right) => right.score - left.score).slice(0, 3);
  return selected.length ? JSON.stringify({ fitnessstudio: selected }, null, 2) : "";
}

function buildFallbackReply(message: string, knowledgeContext: string): string {
  void message;
  void knowledgeContext;
  return "Das kann ich dir gerade nicht genau beantworten. Melde dich gerne direkt bei uns:\n\n📞 +43 1234567\n📧 demo@email.com";
}

function isGenericMockReply(reply: string): boolean {
  return /Standard-Antwort vom LLM/i.test(reply);
}

async function generateFitnessReply(
  message: string,
  knowledgeContext: string,
  recentMessages: ConversationMessage[]
): Promise<string | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    return null;
  }

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(knowledgeContext ? [{ role: "system", content: `Bereitgestellte Informationen als JSON:\n${knowledgeContext}` }] : []),
          ...recentMessages.slice(-4),
          { role: "user", content: message },
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}

function resolveBookingFlow(message: string, state?: ConversationState) {
  const offer = getOfferByIntent(message, state);
  const time = extractTime(message) || state?.selectedTime || null;

  if (offer && time) {
    return {
      reply: buildBookingSummary(offer.title, time),
      nextState: {
        isBooking: false,
        selectedProperty: offer.title,
        selectedLocation: offer.location,
        selectedTime: time,
        lastIntent: "booking_completed",
      } as Partial<ConversationState>,
    };
  }

  if (offer && !time) {
    return {
      reply: `Perfekt. Für das Angebot "${offer.title}" – wann passt es dir?`,
      nextState: {
        isBooking: true,
        selectedProperty: offer.title,
        selectedLocation: offer.location,
        lastIntent: "booking_waiting_for_time",
      } as Partial<ConversationState>,
    };
  }

  if (!offer && time) {
    return {
      reply: "Für welches Angebot möchtest du den Termin eintragen?",
      nextState: {
        isBooking: true,
        selectedTime: time,
        lastIntent: "booking_waiting_for_property",
      } as Partial<ConversationState>,
    };
  }

  return {
    reply: "Für welchen Termin möchtest du dich vormerken?",
    nextState: {
      isBooking: true,
      lastIntent: "booking_started",
    } as Partial<ConversationState>,
  };
}

function getRecentConversationMessages(sessionId?: string): ConversationMessage[] {
  if (!sessionId) return [];
  return getConversationState(sessionId).messages.slice(-6);
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
  const requestedTime = extractTime(sanitizedMessage);
  const bookingContinuation = Boolean(currentState?.isBooking);
  const identityQuestion = isIdentityQuestion(sanitizedMessage);
  const infoQuestion = isInfoQuestion(sanitizedMessage);
  const explicitBookingIntent = isBookingIntent(sanitizedMessage) || isYesIntent(sanitizedMessage) || Boolean(requestedTime);
  const simpleProbetrainingIntent = isProbetrainingRequest(sanitizedMessage) || (isYesIntent(sanitizedMessage) && !bookingContinuation);
  const capabilityQuestion = isCapabilityQuestion(sanitizedMessage);

  if (identityQuestion) {
    const reply = "Ich bin Samy, der digitale Assistent deines Fitnessstudios und helfe dir gerne bei Fragen rund um Training, Mitgliedschaften und Probetrainings.";
    if (sessionId) {
      updateConversationState(sessionId, { isBooking: false, lastIntent: "identity" });
      appendConversationTurn(sessionId, sanitizedMessage, reply);
    }

    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (capabilityQuestion) {
  const reply =
    "Ich helfe dir gerne bei allem rund ums Fitnessstudio – zum Beispiel bei Preisen, Mitgliedschaften, Kursen oder einem kostenlosen Probetraining.";

  if (sessionId) {
    appendConversationTurn(sessionId, sanitizedMessage, reply);
  }

  return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
}

  if (isGreetingOnly(sanitizedMessage)) {
    const reply = "Hallo! Wie kann ich dir bei Fitness, Preisen oder einem Probetraining helfen?";
    if (sessionId) appendConversationTurn(sessionId, sanitizedMessage, reply);
    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (isSmalltalkMessage(sanitizedMessage)) {
    const reply = "Danke der Nachfrage, alles gut. Wobei kann ich dir bei unserem Fitnessstudio helfen?";
    if (sessionId) appendConversationTurn(sessionId, sanitizedMessage, reply);
    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (simpleProbetrainingIntent) {
    const reply = buildInterestReply();
    if (sessionId) {
      updateConversationState(sessionId, { isBooking: false, lastIntent: "probetraining_info" });
      appendConversationTurn(sessionId, sanitizedMessage, reply);
    }

    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (isInterestIntent(sanitizedMessage) && !explicitBookingIntent && !bookingContinuation) {
    const reply = buildInterestReply();
    if (sessionId) {
      updateConversationState(sessionId, { isLead: true, isBooking: true, lastIntent: "interest" });
      appendConversationTurn(sessionId, sanitizedMessage, reply);
    }

    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (infoQuestion) {
    const reply = buildInfoReply(sanitizedMessage);
    if (sessionId) {
      updateConversationState(sessionId, { isBooking: false, lastIntent: "info_question" });
      appendConversationTurn(sessionId, sanitizedMessage, reply);
    }

    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  if (explicitBookingIntent || (bookingContinuation && !infoQuestion)) {
    const bookingState = resolveBookingFlow(sanitizedMessage, currentState);
    if (sessionId) {
      updateConversationState(sessionId, bookingState.nextState);
      appendConversationTurn(sessionId, sanitizedMessage, bookingState.reply);
    }

    return NextResponse.json({ reply: bookingState.reply }, { headers: buildSecurityHeaders() });
  }

  if (/günstigste|billigste|am günstigsten|am billigsten/.test(normalizeText(sanitizedMessage))) {
    const cheapest = getOfferByPrice(true);
    if (cheapest) {
      const reply = buildOfferReply(cheapest, "Das günstigste Angebot ist:");
      if (sessionId) {
        updateConversationState(sessionId, {
          isBooking: false,
          selectedProperty: cheapest.title,
          selectedLocation: cheapest.location,
          lastIntent: "offer_shown",
        });
        appendConversationTurn(sessionId, sanitizedMessage, reply);
      }

      return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
    }
  }

  if (/teuerste|am teuersten|höchster preis|höchsten preis/.test(normalizeText(sanitizedMessage))) {
    const mostExpensive = getOfferByPrice(false);
    if (mostExpensive) {
      const reply = buildOfferReply(mostExpensive, "Das teuerste Angebot ist:");
      if (sessionId) {
        updateConversationState(sessionId, {
          isBooking: false,
          selectedProperty: mostExpensive.title,
          selectedLocation: mostExpensive.location,
          lastIntent: "offer_shown",
        });
        appendConversationTurn(sessionId, sanitizedMessage, reply);
      }

      return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
    }
  }

  const knowledgeContext = buildKnowledgeContext(sanitizedMessage);
  if (!isFitnessTopic(sanitizedMessage) && !knowledgeContext) {
    const reply = buildOffTopicReply();
    if (sessionId) appendConversationTurn(sessionId, sanitizedMessage, reply);
    return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
  }

  const recentMessages = getRecentConversationMessages(sessionId);
  const llmReply = await generateFitnessReply(sanitizedMessage, knowledgeContext, recentMessages);
  const reply = llmReply && !isGenericMockReply(llmReply) ? llmReply : buildFallbackReply(sanitizedMessage, knowledgeContext);

  if (sessionId) {
    updateConversationState(sessionId, { lastIntent: "knowledge_reply" });
    appendConversationTurn(sessionId, sanitizedMessage, reply);
  }

  return NextResponse.json({ reply }, { headers: buildSecurityHeaders() });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: buildSecurityHeaders() });
}