import { appendConversationTurn, getRecentConversationMessages, type ConversationMessage, type ConversationState } from "@/lib/services/conversation.service";

type FoundryInputMessage = {
  role: "user" | "assistant";
  content: string;
};

type FoundryResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type AgentLogDetails = Record<string, unknown>;

const FOUNDry_FETCH_TIMEOUT_MS = 25_000;
const FOUNDry_FALLBACK_REPLY = "Kurze Verzögerung gerade – versuch's nochmal oder ruf uns direkt an: +43 1 2345678.";

function logAgentEvent(level: "info" | "warn" | "error", event: string, details: AgentLogDetails) {
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

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : error.cause,
    };
  }

  return { error: String(error) };
}

function getEndpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.name === "AbortError") return true;
  if (error.name === "TypeError" && error.message.toLowerCase().includes("fetch failed")) return true;

  const cause = error.cause as { code?: string; name?: string } | undefined;
  if (!cause) return false;

  return cause.code === "UND_ERR_HEADERS_TIMEOUT" || cause.code === "ECONNRESET" || cause.name === "TimeoutError";
}

function createFetchTimeoutController() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FOUNDry_FETCH_TIMEOUT_MS);
  return { controller, timeoutId };
}

type FoundryAttemptResult =
  | { ok: true; reply: string }
  | { ok: false; retryable: boolean };

async function fetchFoundryAttempt(
  url: string,
  apiKey: string,
  input: FoundryInputMessage[],
  agentName: string,
  requestId: string,
  attempt: number
): Promise<FoundryAttemptResult> {
  const attemptStart = Date.now();
  const { controller, timeoutId } = createFetchTimeoutController();

  logAgentEvent("info", "agent_fetch_start", {
    requestId,
    attempt,
    endpointHost: getEndpointHost(url),
    agentName,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        input,
        agent_reference: {
          type: "agent_reference",
          name: agentName,
        },
      }),
      signal: controller.signal,
    });

    logAgentEvent("info", "agent_fetch_complete", {
      requestId,
      attempt,
      endpointHost: getEndpointHost(url),
      agentName,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - attemptStart,
      contentType: response.headers.get("content-type") || null,
      aborted: controller.signal.aborted,
    });

    if (!response.ok) {
      logAgentEvent("error", "agent_fetch_failed", {
        requestId,
        attempt,
        endpointHost: getEndpointHost(url),
        agentName,
        elapsedMs: Date.now() - attemptStart,
        status: response.status,
        ok: response.ok,
      });
      return { ok: false, retryable: false };
    }

    try {
      const data = (await response.json()) as FoundryResponse;
      const reply = extractAssistantReply(data);

      logAgentEvent("info", "agent_response_parsed", {
        requestId,
        attempt,
        endpointHost: getEndpointHost(url),
        agentName,
        elapsedMs: Date.now() - attemptStart,
        outputCount: data.output?.length ?? 0,
        hasReply: Boolean(reply),
      });

      return { ok: true, reply: reply || FOUNDry_FALLBACK_REPLY };
    } catch (error) {
      logAgentEvent("error", "agent_response_json_failed", {
        requestId,
        attempt,
        endpointHost: getEndpointHost(url),
        agentName,
        status: response.status,
        elapsedMs: Date.now() - attemptStart,
        ...serializeError(error),
      });
      return { ok: false, retryable: false };
    }
  } catch (error) {
    logAgentEvent("error", "agent_fetch_failed", {
      requestId,
      attempt,
      endpointHost: getEndpointHost(url),
      agentName,
      elapsedMs: Date.now() - attemptStart,
      retryable: isRetryableFetchError(error),
      ...serializeError(error),
    });
    return { ok: false, retryable: isRetryableFetchError(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFoundryInput(message: string, recentMessages: ConversationMessage[], state?: ConversationState): FoundryInputMessage[] {
  const history = (recentMessages.length > 0 ? recentMessages : state?.messages ?? []).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  return [...history, { role: "user", content: message }];
}

function extractAssistantReply(payload: FoundryResponse): string | null {
  for (const item of payload.output || []) {
    if (item.type !== "message") continue;

    const textPart = item.content?.find((entry) => typeof entry.text === "string" && entry.text.trim().length > 0);
    if (textPart?.text) {
      return textPart.text.trim();
    }
  }

  return null;
}

function sanitizeAssistantReply(reply: string): string {
  return reply.replace(/【[^】]*】/g, "").replace(/\s{2,}/g, " ").trim();
}

async function callFoundryAgent(message: string, recentMessages: ConversationMessage[], state?: ConversationState, requestId?: string): Promise<string> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT?.trim();
  const apiKey = process.env.FOUNDRY_API_KEY?.trim();
  const agentName = process.env.FOUNDRY_AGENT_NAME?.trim() || "chatbot-agent";
  const startedAt = Date.now();

  if (!endpoint || !apiKey) {
    logAgentEvent("warn", "agent_not_configured", {
      requestId: requestId || "unknown",
      agentName,
    });
    return "Der KI-Dienst ist aktuell nicht konfiguriert.";
  }

  const input = buildFoundryInput(message, recentMessages, state);
  const url = `${endpoint.replace(/\/+$/, "")}/openai/v1/responses`;

  logAgentEvent("info", "agent_request_start", {
    requestId: requestId || "unknown",
    endpointHost: getEndpointHost(endpoint),
    agentName,
    messageLength: message.length,
    historyCount: input.length - 1,
  });

  const requestLabel = requestId || "unknown";
  const firstAttempt = await fetchFoundryAttempt(url, apiKey, input, agentName, requestLabel, 1);
  if (firstAttempt.ok) {
    return sanitizeAssistantReply(firstAttempt.reply);
  }

  if (firstAttempt.retryable) {
    logAgentEvent("warn", "agent_fetch_retry", {
      requestId: requestLabel,
      endpointHost: getEndpointHost(endpoint),
      agentName,
      elapsedMs: Date.now() - startedAt,
      attempt: 2,
    });

    const secondAttempt = await fetchFoundryAttempt(url, apiKey, input, agentName, requestLabel, 2);
    if (secondAttempt.ok) {
      return sanitizeAssistantReply(secondAttempt.reply);
    }
  }

  return sanitizeAssistantReply(FOUNDry_FALLBACK_REPLY);
}

export async function resolveStudioReply(options: {
  message: string;
  sessionId?: string;
  state?: ConversationState;
  recentMessages?: ConversationMessage[];
  requestId?: string;
}): Promise<string> {
  const { message, sessionId, state, recentMessages = [], requestId } = options;
  const reply = await callFoundryAgent(message, recentMessages.length > 0 ? recentMessages : getRecentConversationMessages(sessionId), state, requestId);

  if (sessionId) {
    appendConversationTurn(sessionId, message, reply);
  }

  return reply;
}
