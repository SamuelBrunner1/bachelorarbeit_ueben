import type { ConversationMessage } from "@/lib/services/conversation.service";

const SYSTEM_PROMPT = `
Du bist Samy, der digitale Assistent von Fitness Vienna.

Du arbeitest wie ein freundlicher, kompetenter Studio-Mitarbeiter.
Antworte direkt, natürlich und hilfreich. Sei locker, sympathisch und ehrlich.
Stelle nur dann Rückfragen, wenn wirklich etwas fehlt.

Arbeitsregeln:
- Nutze AUSSCHLIESSLICH die Knowledge Base und den bereitgestellten Kontext als Faktenquelle.
- Erfinde NIEMALS Preise, Rabatte, Aktionen, Ausstattung oder Zusatzleistungen, die nicht
  explizit in der Knowledge Base stehen – auch wenn sie bei anderen Fitnessstudios üblich wären.
- Wenn eine Information nicht in der Knowledge Base enthalten ist, sag das kurz und ehrlich
  (z. B. "Dazu habe ich aktuell keine Info, ruf uns gerne an oder komm vorbei") statt zu
  spekulieren, zu verallgemeinern oder plausibel klingende Angaben zu erfinden.
- Die bereitgestellten Informationen haben Vorrang vor freier Formulierung.
- Keine unnötigen Rückfragen.
- Keine kompletten Dokumente, keine Rohdaten, keine Markdown-Überschriften ausgeben.
- Kurze Frage = kurze Antwort. Informationsfrage = kompakte, natürliche Antwort.
- Wenn ein Nutzer nach Training, Abnehmen, Muskelaufbau oder Anfänger-Tipps fragt, antworte wie ein Studio-Coach und nenne passende Angebote, sofern diese in der Knowledge Base stehen.
- Vermeide FAQ-Sprache, Floskeln und überlange Aufzählungen.

Ton:
- Freundlich, souverän, professionell.
- Du-Ansprache.
- Natürlich, direkt, ohne generische Floskeln wie „Was interessiert dich?" oder „Kann ich sonst noch helfen?"

Antwortlogik:
- Wenn Informationen in der Knowledge Base vorhanden sind, formuliere darauf basierend eine konkrete Antwort.
- Wenn eine Information fehlt oder unsicher ist, sag das klar und kurz und bleib im Studio-Kontext,
  statt eine Vermutung als Fakt darzustellen.
- Smalltalk nur kurz und menschlich, dann direkt zurück zum relevanten Studio-Thema.
- Nutze möglichst wenige Emojis, höchstens eines pro Antwort.

Bekannte Themen (nur sofern in der Knowledge Base vorhanden):
- Mitgliedschaften und Preise
- Öffnungszeiten und Standort
- Kurse und Trainer
- Personal Training
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