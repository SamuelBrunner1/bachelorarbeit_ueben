export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationState = {
  isLead: boolean;
  isBooking: boolean;
  conversationPhase?: string;
  selectedProperty?: string;
  selectedTime?: string;
  selectedLocation?: string;
  lastIntent?: string;
  lastTopic?: string;
  lastEntity?: string;
  messages: ConversationMessage[];
  lastUpdated: number;
};

const RATE_LIMIT_WINDOW_MS = 90_000;
const RATE_LIMIT_MAX = 30;
const CONVERSATION_STATE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CONVERSATION_MESSAGES = Number(process.env.MAX_CONVERSATION_MESSAGES) || 20; // keep recent 10-20 messages in session

const requestLog: Map<string, number[]> = new Map();
const conversationStateLog: Map<string, ConversationState> = new Map();

function createFreshState(now: number): ConversationState {
  return {
    isLead: false,
    isBooking: false,
    messages: [],
    lastUpdated: now,
  };
}

function trimConversationMessages(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CONVERSATION_MESSAGES);
}

export function checkRateLimit(bucketKey: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(bucketKey) || []).filter((time) => time > windowStart);
  recent.push(now);
  requestLog.set(bucketKey, recent);
  return recent.length <= RATE_LIMIT_MAX;
}

export function getConversationState(sessionId: string): ConversationState {
  const now = Date.now();
  const existing = conversationStateLog.get(sessionId);

  if (!existing) {
    const freshState = createFreshState(now);
    conversationStateLog.set(sessionId, freshState);
    return freshState;
  }

  if (now - existing.lastUpdated > CONVERSATION_STATE_TTL_MS) {
    const resetState = createFreshState(now);
    conversationStateLog.set(sessionId, resetState);
    return resetState;
  }

  return { ...existing, messages: existing.messages || [] };
}

export function updateConversationState(sessionId: string, patch: Partial<ConversationState>) {
  const current = getConversationState(sessionId);
  conversationStateLog.set(sessionId, {
    ...current,
    ...patch,
    messages: patch.messages ?? current.messages,
    lastUpdated: Date.now(),
  });
}

export function appendConversationTurn(
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

export function getRecentConversationMessages(sessionId?: string): ConversationMessage[] {
  if (!sessionId) return [];
  const msgs = getConversationState(sessionId).messages || [];
  return msgs.slice(-MAX_CONVERSATION_MESSAGES);
}