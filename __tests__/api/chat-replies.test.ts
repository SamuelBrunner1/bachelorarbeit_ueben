import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/chat/route";

function createMockRequest(message: string, sessionId = "reply-test-session"): NextRequest {
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

describe("Chat API reply quality", () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.IMMOBOT_API_KEY;
    process.env.SESSION_COOKIE_NAME = "session_id";
    process.env.IMMOBOT_SESSION_SECRET = "test-secret-key-for-replies";
    vi.restoreAllMocks();
  });

  it("returns the Samy identity text", async () => {
    const res = await POST(createMockRequest("Wer bist du?"));
    const reply = await readReply(res);

    expect(reply).toBe(
      "Ich bin Samy, der digitale Assistent deines Fitnessstudios und helfe dir gerne bei Fragen rund um Training, Mitgliedschaften und Probetrainings."
    );
  });

  it("returns concrete membership pricing", async () => {
    const res = await POST(createMockRequest("Welche Mitgliedschaften gibt es?"));
    const reply = await readReply(res);

    expect(reply).toContain("Basic – 29€ pro Monat");
    expect(reply).toContain("Advanced – 39€ pro Monat");
    expect(reply).toContain("Premium – 49€ pro Monat");
    expect(reply).toContain("kostenlos ein Probetraining machen");
  });

  it("returns concrete personal training pricing", async () => {
    const res = await POST(createMockRequest("Gibt es Personal Training?"));
    const reply = await readReply(res);

    expect(reply).toContain("Ja, wir bieten auch Personal Training an.");
    expect(reply).toContain("ab 60€ pro Einheit");
  });

  it("returns simple probetraining wording", async () => {
    const res = await POST(createMockRequest("Ich möchte ein Probetraining"));
    const reply = await readReply(res);

    expect(reply).toContain("ohne Anmeldung für ein Probetraining vorbeikommen");
    expect(reply).toContain("vorab noch etwas zum Training oder zu unseren Angeboten erklären");
    expect(reply).not.toContain("wann passt es dir");
  });

  it("returns soft off-topic fallback", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const res = await POST(createMockRequest("Erkläre mir bitte die Raumfahrt"));
    const reply = await readReply(res);

    expect(reply).toContain("Bin mir gerade nicht ganz sicher");
    expect(reply).toContain("Preise, Kurse oder ein Probetraining");
    expect(reply).not.toContain("📞 +43 1234567");
    expect(reply).not.toContain("demo@email.com");
  });
});
