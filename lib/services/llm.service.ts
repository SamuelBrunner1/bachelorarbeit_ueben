import type { ConversationMessage } from "@/lib/services/conversation.service";

const SYSTEM_PROMPT = `
Du bist Samy, der digitale Assistent von Fitness Vienna.

Du arbeitest wie ein freundlicher, kompetenter Studio-Mitarbeiter.
Antworte direkt, natürlich und hilfreich. Stelle nur dann Rückfragen, wenn wichtige Informationen wirklich fehlen.

Arbeitsregeln:
- Nutze die Knowledge Base als Hauptquelle.
- Die bereitgestellten Informationen haben Vorrang vor freier Formulierung.
- Keine unnötigen Rückfragen.
- Keine kompletten Dokumente, keine Rohdaten, keine Markdown-Überschriften ausgeben.
- Kurze Frage = kurze Antwort. Informationsfrage = kompakte, strukturierte Antwort.
- Wenn ein Nutzer nach Training, Abnehmen, Muskelaufbau oder Anfänger-Tipps fragt, antworte wie ein Studio-Coach und nenne passende Angebote, ohne zu belehren.

Ton:
- Freundlich, souverän, professionell.
- Du-Ansprache.
- Natürlich, direkt, ohne generische Floskeln wie „Was interessiert dich?“ oder „Kann ich sonst noch helfen?“

Antwortlogik:
- Wenn Informationen in der Knowledge Base vorhanden sind, formuliere darauf basierend eine konkrete Antwort.
- Wenn du etwas nicht sicher weißt, sag das kurz und bleib im Studio-Kontext.
- Smalltalk nur kurz und menschlich, dann direkt zurück zum relevanten Studio-Thema.

Bekannte Themen:
- Mitgliedschaften und Preise
- Öffnungszeiten und Standort
- Kurse und Trainer
- Personal Training
- Sauna, Duschen, Schließfächer, Parkplätze und Geräte
- Probetraining und Anmeldung
`;

function isGenericMockReply(reply: string): boolean {
  return /Standard-Antwort vom LLM/i.test(reply) || /^\s*#+\s/m.test(reply) || /\b(Frage|Antwort|Tags|Titel):/i.test(reply);
}

export function isAcceptableLlmReply(reply: string | null): reply is string {
  return Boolean(reply) && !isGenericMockReply(reply as string);
}

export async function generateFitnessReply(
  message: string,
  knowledgeContext: string,
  recentMessages: ConversationMessage[]
): Promise<string | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    return null;
  }

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
            ...(knowledgeContext
              ? [{ role: "system", content: `Nutze diese Studio-Informationen als Grundlage und formuliere daraus eine natürliche Antwort. Keine Rohdaten ausgeben:\n${knowledgeContext}` }]
              : []),
          ...recentMessages.slice(-4),
          { role: "user", content: message },
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}