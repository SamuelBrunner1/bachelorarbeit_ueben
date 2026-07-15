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

async function callFoundryAgent(message: string, recentMessages: ConversationMessage[], state?: ConversationState): Promise<string> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT?.trim();
  const apiKey = process.env.FOUNDRY_API_KEY?.trim();
  const agentName = process.env.FOUNDRY_AGENT_NAME?.trim() || "chatbot-agent";

  if (!endpoint || !apiKey) {
    return "Der KI-Dienst ist aktuell nicht konfiguriert.";
  }

  const input = buildFoundryInput(message, recentMessages, state);
  const response = await fetch(`${endpoint.replace(/\/+$/, "")}/openai/v1/responses`, {
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
  });

  if (!response.ok) {
    return "Ich konnte gerade keine Antwort vom KI-Dienst abrufen.";
  }

  const data = (await response.json()) as FoundryResponse;
  return extractAssistantReply(data) || "Ich konnte gerade keine passende Antwort vom KI-Dienst lesen.";
}

export async function resolveStudioReply(options: {
  message: string;
  sessionId?: string;
  state?: ConversationState;
  recentMessages?: ConversationMessage[];
}): Promise<string> {
  const { message, sessionId, state, recentMessages = [] } = options;
  const reply = await callFoundryAgent(message, recentMessages.length > 0 ? recentMessages : getRecentConversationMessages(sessionId), state);

  if (sessionId) {
    appendConversationTurn(sessionId, message, reply);
  }

  return reply;
}
