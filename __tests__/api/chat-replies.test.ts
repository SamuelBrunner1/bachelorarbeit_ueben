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
      "Ich bin Samy, der digitale Assistent von Fitness Vienna."
    );
  });

  it("returns concrete membership pricing", async () => {
    const res = await POST(createMockRequest("Welche Mitgliedschaften gibt es?"));
    const reply = await readReply(res);

    expect(reply).toContain("Basic für 29€");
    expect(reply).toContain("Advanced für 39€");
    expect(reply).toContain("Premium für 49€ pro Monat");
  });

  it("returns concrete personal training pricing", async () => {
    const res = await POST(createMockRequest("Gibt es Personal Training?"));
    const reply = await readReply(res);

    expect(reply).toContain("Ja, bei uns gibt es auch Personal Training.");
    expect(reply).toContain("ab 60€ pro Einheit");
  });

  it("guides an abnehmen opener with one short question", async () => {
    const res = await POST(createMockRequest("Ich möchte abnehmen"));
    const reply = await readReply(res);

    expect(reply).toContain("Gutes Ziel");
    expect(reply).toContain("Trainierst du schon regelmäßig");
    expect(reply).not.toContain("Basic");
    expect(reply).not.toContain("Premium");
  });

  it("guides a fitness studio opener before mentioning prices", async () => {
    const res = await POST(createMockRequest("Ich suche ein Fitnessstudio."));
    const reply = await readReply(res);

    expect(reply).toContain("Schön, dass du dich umschaust");
    expect(reply).toContain("Muskelaufbau, Abnehmen oder einfach fitter werden");
    expect(reply).not.toContain("Basic");
    expect(reply).not.toContain("Premium");
  });

  it("guides an anfänger opener with reassurance", async () => {
    const res = await POST(createMockRequest("Ich bin Anfänger."));
    const reply = await readReply(res);

    expect(reply).toContain("Kein Problem");
    expect(reply).toContain("Was möchtest du denn erreichen");
    expect(reply).not.toContain("Basic");
    expect(reply).not.toContain("Membership");
  });

  it("guides a muscle-building opener without selling", async () => {
    const res = await POST(createMockRequest("Ich möchte Muskeln aufbauen."));
    const reply = await readReply(res);

    expect(reply).toContain("Klingt gut");
    expect(reply).toContain("Trainierst du schon länger");
    expect(reply).not.toContain("Premium");
    expect(reply).not.toContain("Basic");
  });

  it("returns simple probetraining wording", async () => {
    const res = await POST(createMockRequest("Ich möchte ein Probetraining"));
    const reply = await readReply(res);

    expect(reply).toContain("ohne Anmeldung für ein Probetraining vorbeikommen");
    expect(reply.length).toBeLessThan(140);
    expect(reply).not.toContain("wann passt es dir");
  });

  it("returns soft off-topic fallback", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const res = await POST(createMockRequest("Erkläre mir bitte die Raumfahrt"));
    const reply = await readReply(res);

    expect(reply).toContain("Preisen, Kursen, Sauna oder einem Probetraining");
    expect(reply).not.toContain("📞 +43 1234567");
    expect(reply).not.toContain("demo@email.com");
    expect(reply).not.toMatch(/^\s*#/m);
  });

  it("does not leak raw knowledge markdown", async () => {
    const res = await POST(createMockRequest("Was kostet Premium?"));
    const reply = await readReply(res);

    expect(reply).not.toContain("# ");
    expect(reply).not.toContain("## ");
    expect(reply).not.toContain("Frage:");
    expect(reply).not.toContain("Antwort:");
  });
});
