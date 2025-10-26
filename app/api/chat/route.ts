import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { message } = await req.json();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort erhalten.";
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ reply: "Fehler beim Abrufen der Antwort." });
  }
}
