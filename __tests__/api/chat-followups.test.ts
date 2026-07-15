import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { updateConversationState } from "../../lib/services/conversation.service";
import { POST } from "../../app/api/chat/route";
import { getCapturedFoundryRequests, mockFoundryResponses } from "../helpers/foundry-mock";

function createMockRequest(message: string, sessionId = "followup-test-session"): NextRequest {
  const url = new URL("http://localhost:3000/api/chat");
  const request = new NextRequest(url, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    }),
    body: JSON.stringify({ message }),
  });

  Object.defineProperty(request, "cookies", {
    value: {
      get: (name: string) => (name === "session_id" ? { value: sessionId } : undefined),
    },
    writable: true,
  });

  return request;
}

async function readReply(response: Response): Promise<string> {
  const data = (await response.json()) as { reply?: string };
  return data.reply || "";
}

describe("Chat follow-up and context handling", () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    process.env.FOUNDRY_PROJECT_ENDPOINT = "https://test.foundry.azure.com";
    process.env.FOUNDRY_API_KEY = "test-foundry-key";
    process.env.FOUNDRY_AGENT_NAME = "chatbot-agent";
    process.env.SESSION_COOKIE_NAME = "session_id";
    process.env.IMMOBOT_SESSION_SECRET = "test-secret-key-followups";
    mockFoundryResponses();
  });

  it("resolves 'Ja oder nein?' to previous topic (Yoga)", async () => {
    const session = "followup-session-1";

    const res1 = await POST(createMockRequest("Habt ihr Yoga?", session));
    const reply1 = await readReply(res1);
    expect(reply1.toLowerCase()).toContain("yoga");

    const res2 = await POST(createMockRequest("Ja oder nein?", session));
    const reply2 = await readReply(res2);
    expect(reply2.toLowerCase()).toContain("ja");
    expect(reply2.toLowerCase()).toContain("yoga");

    const captured = getCapturedFoundryRequests();
    expect(captured[1]?.body.input?.some((entry) => entry.role === "assistant" && entry.content.includes("Yoga"))).toBe(true);
  });

  it("resolves 'Mit Sauna?' after a price question about Premium", async () => {
    const session = "followup-session-2";

    // ensure session state indicates prior price inquiry about Premium
    updateConversationState(session, { lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: "Premium" });

    const res2 = await POST(createMockRequest("Mit Sauna?", session));
    const reply2 = await readReply(res2);
    expect(reply2.toLowerCase()).toContain("sauna");
    expect(reply2.toLowerCase()).toContain("premium");
  });

  it("tolerates common typos like 'joga' and 'pilatese'", async () => {
    const session = "followup-session-3";

    const res1 = await POST(createMockRequest("Habt ihr joga?", session));
    const reply1 = await readReply(res1);
    expect(reply1.toLowerCase()).toContain("yoga");

    const res2 = await POST(createMockRequest("Bietet ihr pilatese an?", session));
    const reply2 = await readReply(res2);
    expect(reply2.toLowerCase()).toContain("pilates");
  });

  it("handles short replies like 'ja' and 'warum' with context", async () => {
    const session = "followup-session-4";

    const r1 = await POST(createMockRequest("Gibt es Probetraining?", session));
    const rr1 = await readReply(r1);
    expect(rr1.toLowerCase()).toContain("probetraining");

    const r2 = await POST(createMockRequest("ja", session));
    const rr2 = await readReply(r2);
    expect(rr2.toLowerCase()).toContain("ja");

    const r3 = await POST(createMockRequest("warum?", session));
    const rr3 = await readReply(r3);
    expect(rr3.length).toBeGreaterThan(3);
  });
});
