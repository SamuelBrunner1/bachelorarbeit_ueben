import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/chat/route";

function createMockRequest(message: string, sessionId: string): NextRequest {
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

describe("Chat API intent priority", () => {
  const sessionId = "intent-order-test-session";

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.IMMOBOT_API_KEY;
    process.env.SESSION_COOKIE_NAME = "session_id";
    process.env.IMMOBOT_SESSION_SECRET = "test-secret-key-for-intent-order";
  });

  it("answers info questions instead of continuing booking", async () => {
    const bookingStart = await POST(createMockRequest("probetraining", sessionId));
    const bookingReply = await readReply(bookingStart);

    expect(bookingReply).toContain("ohne Anmeldung für ein Probetraining vorbeikommen");

    const infoRequest = await POST(createMockRequest("was sind eure Öffnungszeiten?", sessionId));
    const infoReply = await readReply(infoRequest);

    expect(infoReply).toMatch(/06:00 bis 22:00|08:00 bis 18:00|Öffnungszeiten/i);
    expect(infoReply).not.toContain("Probetraining");
    expect(infoReply).not.toContain("Termin");
  });

  it("does not treat prices or location as booking intent", async () => {
    const priceRequest = await POST(createMockRequest("wie sind eure Preise?", sessionId));
    const priceReply = await readReply(priceRequest);

    expect(priceReply).toContain("Basic für 29€, Advanced für 39€ und Premium für 49€ pro Monat");
    expect(priceReply).not.toContain("wann passt es dir");

    const locationRequest = await POST(createMockRequest("wo ist das studio?", sessionId));
    const locationReply = await readReply(locationRequest);

    expect(locationReply).toContain("zentral in Wien");
    expect(locationReply).not.toContain("Probetraining");
  });
});
