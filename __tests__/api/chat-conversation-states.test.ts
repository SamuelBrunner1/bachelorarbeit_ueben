import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/chat/route";

function createMockRequest(message: string, sessionId = "conversation-state-session"): NextRequest {
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
  const payload = (await response.json()) as { reply?: string };
  return payload.reply || "";
}

describe("Chat API conversation states", () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.IMMOBOT_API_KEY;
    process.env.SESSION_COOKIE_NAME = "session_id";
    process.env.IMMOBOT_SESSION_SECRET = "test-secret-key-for-conversation-states";
    vi.restoreAllMocks();
  });

  it("uses NeedDiscovery for open studio search", async () => {
    const res = await POST(createMockRequest("Ich suche ein Fitnessstudio.", "state-1"));
    const reply = await readReply(res);

    expect(reply).toContain("Was ist dir am wichtigsten");
    expect(reply).not.toContain("Basic");
    expect(reply).not.toContain("Premium");
  });

  it("uses EmotionalSupport before prices for emotional messages", async () => {
    const res = await POST(createMockRequest("Ich schäme mich", "state-2"));
    const reply = await readReply(res);

    expect(reply).toContain("völlig okay");
    expect(reply).not.toContain("29€");
    expect(reply).not.toContain("Premium");
  });

  it("uses ObjectionHandling for price objections", async () => {
    const session = "state-3";
    await POST(createMockRequest("Was kostet Premium?", session));

    const objectionRes = await POST(createMockRequest("29 € sind teuer.", session));
    const objectionReply = await readReply(objectionRes);

    expect(objectionReply).toContain("Verstehe ich gut");
    expect(objectionReply).toContain("wirklich nutzen möchtest");
    expect(objectionReply).not.toContain("49€");
  });

  it("uses Booking state when user asks for a trial session", async () => {
    const res = await POST(createMockRequest("Ich möchte ein Probetraining.", "state-4"));
    const reply = await readReply(res);

    expect(reply).toContain("Probetraining vorbeikommen");
    expect(reply).not.toContain("Was ist dir am wichtigsten");
  });

  it("uses Closing state for goodbyes", async () => {
    const res = await POST(createMockRequest("danke dir", "state-5"));
    const reply = await readReply(res);

    expect(reply).toContain("Sehr gern");
    expect(reply).toContain("bin ich hier für dich");
  });
});
