import { vi } from "vitest";

type FoundryInputMessage = {
  role: "user" | "assistant";
  content: string;
};

type FoundryRequestBody = {
  input?: FoundryInputMessage[];
  agent_reference?: {
    name?: string;
    type?: string;
  };
};

export type CapturedFoundryRequest = {
  url: string;
  body: FoundryRequestBody;
};

const capturedRequests: CapturedFoundryRequest[] = [];

function textFromInput(body: FoundryRequestBody): string {
  const input = body.input || [];
  const lastUser = [...input].reverse().find((entry) => entry.role === "user");
  return lastUser?.content?.toLowerCase().trim() || "";
}

function historyContains(body: FoundryRequestBody, needle: string): boolean {
  return (body.input || []).some((entry) => entry.content.toLowerCase().includes(needle));
}

function replyForMessage(body: FoundryRequestBody): string {
  const message = textFromInput(body);

  if (/wer bist du/.test(message)) return "Ich bin Samy, der digitale Assistent von Fitness Vienna.";
  if (/mitgliedschaft|mitgliedschaften/.test(message)) return "Klar – bei uns gibt es Basic für 29€, Advanced für 39€ und Premium für 49€ pro Monat.";
  if (/personal training/.test(message)) return "Ja, bei uns gibt es auch Personal Training. ab 60€ pro Einheit";
  if (/ich möchte abnehmen/.test(message)) return "Gutes Ziel 😊 Dabei helfen ein klarer Trainingsstart und ein Plan, der zu dir passt. Trainierst du schon regelmäßig?";
  if (/ich suche ein fitnessstudio/.test(message)) return "Schön, dass du dich umschaust 😊 Was ist dir am wichtigsten: Muskelaufbau, Abnehmen oder einfach fitter werden?";
  if (/ich bin anfänger/.test(message)) return "Kein Problem 😊 Gerade am Anfang ist ein einfacher Einstieg wichtig. Was möchtest du denn erreichen?";
  if (/ich möchte muskeln aufbauen/.test(message)) return "Klingt gut 💪 Dafür sind vor allem ein guter Trainingsplan und passende Geräte wichtig. Trainierst du schon länger?";
  if (/ich möchte ein probetraining/.test(message) || /probetraining/.test(message)) return "Sehr gerne. Du kannst jederzeit ohne Anmeldung für ein Probetraining vorbeikommen.";
  if (/erkläre mir bitte die raumfahrt/.test(message)) return "Klar – ich helfe dir gern bei Preisen, Kursen, Sauna oder einem Probetraining.";
  if (/was kostet premium/.test(message)) return "Gerne. Premium liegt bei 49€ pro Monat.";
  if (/ja oder nein/.test(message) && historyContains(body, "yoga")) return "Ja, genau 😊, Yoga-Kurse gibt es bei uns.";
  if (/mit sauna/.test(message) && historyContains(body, "premium")) return "Ja, Premium enthält Sauna.";
  if (/joga/.test(message)) return "Ja, bei uns gibt es Yoga, HIIT, Spinning und Pilates.";
  if (/pilatese/.test(message)) return "Ja, bei uns gibt es Yoga, HIIT, Spinning und Pilates.";
  if (/wie sind eure preise|preise/.test(message)) return "Klar – bei uns gibt es Basic für 29€, Advanced für 39€ und Premium für 49€ pro Monat.";
  if (/wo ist das studio|wo ist/.test(message)) return "Unser Studio ist zentral in Wien gelegen.";
  if (/was sind eure öffnungszeiten|am wochenende offen|öffnungszeiten|oeffnungszeiten/.test(message)) return "Ja 😊, bei uns täglich von 06:00 bis 22:00 Uhr.";
  if (/wie läuft das ab|wie läuft es ab/.test(message)) return "Klar, du kannst einfach vorbeikommen und direkt starten. Am Anfang hilft dir ein Trainer gern.";
  if (/was geht/.test(message)) return "Mir geht's gut, danke! Ich bin Samy vom Studio.";
  if (/^yo$/.test(message)) return "Alles gut 😄";
  if (/^(digga|hä|lol|bro|bruder|ey)$/.test(message)) return "Alles gut 😄";
  if (/habt ihr yoga oder hiit|gibt es kurse|gibts yoga und wie teuer ist das|habt ihr yoga und wann habt ihr offen|habt ihr yoga/.test(message)) return "Yoga-Kurse: Yoga, HIIT, Spinning und Pilates. Yoga, HIIT und Spinning gibt es bei uns auch. Die Mitgliedschaften starten ab 29€ pro Monat. Täglich von 06:00 bis 22:00 Uhr.";
  if (/habt ihr sauna/.test(message)) return "Aktuell haben wir keine Sauna.";
  if (/mit sauna/.test(message)) return "Ja, Premium enthält Sauna.";
  if (/morgen$/.test(message)) return "Ja 😊, jederzeit während der Öffnungszeiten von 06:00 bis 22:00 Uhr.";
  if (/was kostet das und kann ich morgen kommen/.test(message)) return "Basic liegt bei 29€ pro Monat. Du kannst jederzeit ohne Anmeldung vorbeikommen.";
  if (/ich schäme mich/.test(message)) return "Danke, dass du das so offen sagst. Das ist völlig okay 😊 Wir können ganz entspannt starten. Was würde dir den Einstieg leichter machen?";
  if (/29 € sind teuer/.test(message)) return "Verstehe ich gut. Wichtig ist, dass es sich für dich lohnt. Wenn du magst, schauen wir kurz, was du wirklich nutzen möchtest.";
  if (/danke dir/.test(message)) return "Sehr gern. Wenn du später noch Fragen hast, bin ich hier für dich 👍";

  if (historyContains(body, "probe") && /ja/.test(message)) return "Ja, genau 😊";
  if (historyContains(body, "günstigste") && /ja/.test(message)) return "Für welchen Termin soll ich dich vormerken?";
  if (historyContains(body, "termin") && /im 7ten bezirk|7ten bezirk|1070/.test(message)) return "Klar. Ich habe dir die passende Immobilie vorgemerkt.";
  if (historyContains(body, "termin") && /keine ahnung/.test(message)) return "Für welche Immobilie soll ich den Termin vormerken?";
  if (historyContains(body, "teuerste") && /ja/.test(message)) return "Für welchen Termin soll ich dich vormerken?";

  if (/hallo/.test(message)) return "Hallo 😊";

  return "Klar – ich helfe dir gern rund ums Fitnessstudio bei Preisen, Kursen, Sauna oder einem Probetraining.";
}

export function mockFoundryResponses() {
  capturedRequests.length = 0;

  vi.stubGlobal("fetch", vi.fn(async (url: string | Request, init?: RequestInit) => {
    const bodyText = typeof init?.body === "string" ? init.body : "{}";
    const parsedBody = JSON.parse(bodyText) as FoundryRequestBody;
    const requestUrl = typeof url === "string" ? url : url.url;

    if (requestUrl.includes("/openai/v1/responses")) {
      capturedRequests.push({ url: requestUrl, body: parsedBody });

      return new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: replyForMessage(parsedBody) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({}), { status: 404, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch);
}

export function getCapturedFoundryRequests(): CapturedFoundryRequest[] {
  return [...capturedRequests];
}
