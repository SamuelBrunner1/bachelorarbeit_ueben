import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/chat/route";

function createMockRequest(message: string, sessionId = "fitness-intent-session"): NextRequest {
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

describe("Chat API fitness intent order", () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.IMMOBOT_API_KEY;
    process.env.SESSION_COOKIE_NAME = "session_id";
    process.env.IMMOBOT_SESSION_SECRET = "test-secret-key-for-fitness-intents";
    vi.restoreAllMocks();
  });

  it("answers course questions before smalltalk", async () => {
    const response = await POST(createMockRequest("habt ihr yoga oder hiit"));
    const reply = await readReply(response);

    expect(reply).toContain("Yoga, HIIT, Spinning und Pilates");
    expect(reply).not.toContain("alles gut");
  });

  it("answers joga as a course question", async () => {
    const response = await POST(createMockRequest("habt ihr joga"));
    const reply = await readReply(response);

    expect(reply).toContain("Yoga, HIIT, Spinning und Pilates");
  });

  it("answers opening-hours questions", async () => {
    const response = await POST(createMockRequest("am wochenende offen?"));
    const reply = await readReply(response);

    expect(reply).toContain("06:00 bis 22:00 Uhr");
    expect(reply).toContain("Ja 😊");
  });

  it("answers process questions", async () => {
    const response = await POST(createMockRequest("wie läuft das ab"));
    const reply = await readReply(response);

    expect(reply).toContain("du kannst einfach vorbeikommen");
    expect(reply).toContain("Trainer gern");
  });

  it("keeps short smalltalk as smalltalk", async () => {
    const response = await POST(createMockRequest("was geht"));
    const reply = await readReply(response);

    expect(reply).toMatch(/Mir geht's gut|Alles bestens|Danke der Nachfrage/i);
  });

  it.each(["digga", "hä", "lol"])("answers casual input %s without fallback", async (message) => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const response = await POST(createMockRequest(message));
    const reply = await readReply(response);

    expect(reply).toContain("Alles gut 😄");
  });

  it.each(["bro", "bruder", "yo", "ey"])("answers extended casual input %s friendly", async (message) => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const response = await POST(createMockRequest(message));
    const reply = await readReply(response);

    expect(reply).toContain("Alles gut 😄");
  });

  it("uses soft fallback reply and avoids hard fallback text", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const response = await POST(createMockRequest("xyzabc123notaword"));
    const reply = await readReply(response);

    expect(reply).toContain("Fitness");
    expect(reply).not.toMatch(/#+\s|^\s*#|^\s*[-*]\s+/m);
  });

  it("answers combo questions for courses and prices", async () => {
    const response = await POST(createMockRequest("gibt es kurse und was kostet es"));
    const reply = await readReply(response);

    expect(reply).toContain("Yoga, HIIT und Spinning");
    expect(reply).toContain("starten ab 29€ pro Monat");
  });

  it("answers yoga plus expensive intent fully", async () => {
    const response = await POST(createMockRequest("gibts yoga und wie teuer ist das"));
    const reply = await readReply(response);

    expect(reply).toContain("Yoga, HIIT und Spinning");
    expect(reply).toContain("starten ab 29€ pro Monat");
  });

  it("answers combo questions for yoga and opening hours", async () => {
    const response = await POST(createMockRequest("habt ihr yoga und wann habt ihr offen"));
    const reply = await readReply(response);

    expect(reply).toContain("Yoga-Kurse");
    expect(reply).toContain("06:00 bis 22:00 Uhr");
  });

  it("answers sauna questions without smalltalk", async () => {
    const response = await POST(createMockRequest("habt ihr sauna"));
    const reply = await readReply(response);

    expect(reply).toContain("Aktuell haben wir keine Sauna");
    expect(reply).not.toContain("Alles gut 😄");
  });

  it("handles loose time message without fallback", async () => {
    const response = await POST(createMockRequest("morgen"));
    const reply = await readReply(response);

    expect(reply).toContain("06:00 bis 22:00 Uhr");
    expect(reply).toContain("jederzeit");
  });

  it("answers price and coming tomorrow combo", async () => {
    const response = await POST(createMockRequest("was kostet das und kann ich morgen kommen"));
    const reply = await readReply(response);

    expect(reply).toContain("29€ pro Monat");
    expect(reply).toContain("ohne Anmeldung vorbeikommen");
  });
});
