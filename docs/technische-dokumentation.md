# Technische Dokumentation

## 1. Projektstruktur

- `app/`: Next.js App Router, Seiten und API-Routen.
  - `app/api/chat/route.ts`: zentrale Chat-API.
  - `app/chatbot/page.tsx`, `app/fitness/page.tsx`, `app/immobilien/page.tsx`: Seiten, die denselben Chat-Client rendern.
- `components/`: Client-Komponenten für die Chat-Oberfläche.
  - `IndustryChat.tsx`: eigentlicher Chat-Client.
  - `ChatWidget.tsx`: schwebendes/iframe-basiertes Chat-Wrapper-UI.
- `lib/`: Logik außerhalb der UI.
  - `lib/security.ts`: Auth, CORS, Cookie-, Session- und Prompt-Injection-Schutz.
  - `lib/services/`: fachliche Chat-Services.
- `knowledge/`: Markdown-Wissensbasis für Studio-Informationen.
- `data/`: strukturierte Zusatzdaten aus JSON, z. B. `fitness.json` und `faqs.json`.
- `__tests__/`: Vitest-Tests für API, Unit- und Integrationsfälle.
- `middleware.ts`: setzt Sicherheits-Header und Session-Cookies.
- `public/`: statische Assets.
- `types/`: globale Typen.
- `logs/`: Laufzeit- bzw. Diagnoseablage.

## 2. Request Flow

1. Der Nutzer schreibt im Frontend in `IndustryChat`.
2. Der Client sendet `POST /api/chat` mit `{ message }`.
3. `app/api/chat/route.ts` prüft:
   - Origin/CORS,
   - JSON-Body,
   - Sanitizing der Eingabe,
   - Längenlimit,
   - Session-Token bzw. API-Key,
   - Rate Limit,
   - Prompt-Injection-Muster.
4. Danach wird der aktuelle Session-Status geladen und an `resolveStudioReply(...)` übergeben.
5. `response.service.ts` versucht zuerst direkte Antworten über Intent-/Regel-Logik.
6. Falls keine direkte Antwort passt, wird ein Knowledge-Kontext aufgebaut.
7. Wenn konfiguriert, wird die LLM-Antwort erzeugt und anschließend validiert.
8. Die Antwort wird als JSON `{ reply }` an das Frontend zurückgegeben.

## 3. Architektur

- `conversation.service.ts`
  - Speichert Session-Zustand und Nachrichten in-memory.
  - Enthält Rate Limiting und Zugriff auf letzte Nachrichten.
- `intent.service.ts`
  - Normalisiert Texte und erkennt Intents/Flags.
  - Liefert strukturierte Analyseobjekte für die Antwortlogik.
- `knowledge.service.ts`
  - Lädt Markdown-Dateien aus `knowledge/` sowie JSON-Daten aus `data/`.
  - Baut einen priorisierten Knowledge-Kontext für die Antwort.
- `llm.service.ts`
  - Kapselt den Azure-OpenAI-Aufruf.
  - Prüft, ob eine LLM-Antwort akzeptabel ist.
- `response.service.ts`
  - Orchestriert die Antwortauswahl.
  - Verknüpft Intent-Erkennung, Knowledge, Gesprächskontext, Coach-Antworten und LLM-Fallback.
- `security.ts`
  - Zentrale Sicherheitsfunktionen für Session, CORS, Header und Eingabeprüfung.

Kommunikation:
- `route.ts` ruft `conversation.service` und `response.service` auf.
- `response.service` nutzt `intent.service`, `knowledge.service` und `llm.service`.
- `conversation.service` wird zum Lesen und Fortschreiben des Session-Kontexts verwendet.

## 4. Intent-Erkennung

Intents werden in `intent.service.ts` über normalisierte Textmuster erkannt. Die Funktion `analyzeMessage()` erzeugt ein Analyseobjekt mit `intents` und `flags`.

Reihenfolge und Prioritäten:
- Zuerst werden sprachliche und thematische Flags bestimmt.
- Danach werden Intent-Typen gesetzt, z. B. `FAQ`, `COURSES`, `PRICE`, `OPENING_HOURS`, `SAUNA`, `TRIAL_TRAINING`, `EQUIPMENT`, `TRAINERS`, `CONTACT`, `LOCATION`.
- Einige Kombinationsfälle haben Sonderpriorität, z. B. Kurs+Preis oder Yoga+Wann.
- Wenn kein Intent passt, fällt die Analyse auf `FAQ` zurück.

Sonderfälle:
- Short Replies wie `ja`, `nein`, `warum?`, `wie?`, `wann?`, `wo?`, `wie viel?` werden als Follow-up-Flags markiert.
- Typische Tippfehler werden vor der Normalisierung korrigiert, z. B. `joga`, `pilatese`, `mitgliedschafft`, `probetraning`, `fitnesstudio`.

## 5. Conversation Memory

Gespeichert pro Session:
- `messages`: letzte Chatnachrichten als `user`/`assistant`-Paare.
- `lastIntent`
- `lastTopic`
- `lastEntity`
- Booking-bezogene Zustände wie `isBooking`, `selectedProperty`, `selectedTime`, `selectedLocation`.

Verwendung:
- Für Follow-up-Fragen und Kontextauflösung.
- Für booking-/lead-bezogene Dialoge.
- Für die Knowledge-Kontext-Bildung über die letzten Nachrichten.

Grenzen:
- Die Speicherung ist rein in-memory.
- Es gibt keine Datenbank und keine dauerhafte Persistenz.
- Der Speicher geht bei Prozess-Neustart verloren.
- Die Nachrichtenanzahl ist begrenzt; aktuell werden die letzten bis zu 20 Nachrichten behalten.

## 6. Wissensbasis

Quellen:
- Markdown-Dateien in `knowledge/`.
- Strukturierte Daten in `data/fitness.json` und `data/faqs.json`.
- Bei Bedarf das LLM als Formulierungs- und Kontextschicht.

Reihenfolge:
1. Direkte Regelantwort aus der Response-Logik.
2. Relevante Inhalte aus der Knowledge Base.
3. LLM-Antwort auf Basis von Wissen und Gesprächskontext.
4. Fallback-Antwort, wenn keine verlässliche LLM-Antwort zurückkommt.

Markdown:
- `knowledge.service.ts` lädt die Markdown-Dateien, extrahiert Überschriften und entfernt Markdown-Markup für die Antwortformulierung.

Hardcoded:
- Einige kurze Studio-Antworten, Booking-Flows und Coach-Antworten sind direkt in `response.service.ts` fest codiert.

LLM:
- Wird erst genutzt, wenn keine direkte Antwort greift oder Wissen/Context eine freie Formulierung benötigt.

## 7. LLM

Verwendet wird Azure OpenAI über `llm.service.ts`.

Wann GPT verwendet wird:
- Bei offenen oder gemischten Fragen ohne passende Direktantwort.
- Wenn Knowledge-Kontext vorhanden ist und daraus eine natürlichere Antwort formuliert werden soll.
- Bei Kontextfragen, die nicht sauber regelbasiert beantwortet werden.

Wann nicht:
- Bei klaren Standardfällen mit direkter Regelantwort.
- Wenn keine LLM-Konfiguration gesetzt ist.
- Wenn die Antwort als generisch oder unpassend erkannt wird.

Systemprompt:
- Samy ist der digitale Assistent von Fitness Vienna.
- Er soll freundlich, kompetent, natürlich und direkt antworten.
- Die Knowledge Base hat Vorrang vor freier Formulierung.
- Keine Rohdaten, keine Markdown-Überschriften, keine unnötigen Rückfragen.

## 8. Sicherheitsmechanismen

- CORS-Prüfung über `isOriginAllowed()` und `buildSecurityHeaders()`.
- Session-Token-Signaturprüfung in `verifySessionToken()`.
- Session-Cookie wird durch `middleware.ts` gesetzt.
- CSRF-nahe Risiken werden durch Origin-Prüfung, Sessionbindung und API-Key-Option reduziert.
- Prompt-Injection-Erkennung über feste Muster in `isPromptInjectionAttempt()`.
- Eingabesanitizing entfernt HTML, Kontrollzeichen und Mehrfachleerzeichen.
- Längenlimit für Nachrichten.
- Rate Limiting pro IP und Auth-Bucket.
- Sicherheitsheader wie CSP, HSTS, X-Frame-Options, Referrer-Policy und weitere werden gesetzt.

## 9. Bekannte Schwächen

Objektiv aus dem Code ableitbar:
- Der Session- und Gesprächskontext ist nicht persistent.
- Die Knowledge Base wird in-memory gecacht und neu geladen, wenn der Prozess neu startet.
- Die Antwortlogik enthält noch einige feste Regeln und Formulierungen, die nicht aus der Knowledge Base kommen.
- `app/immobilien/page.tsx` und `app/fitness/page.tsx` rendern aktuell denselben Fitness-Chat.
- Die LLM-Nutzung ist vollständig von Umgebungsvariablen abhängig.
- Die Antworten hängen teilweise von heuristischen Textmustern ab, nicht von einem semantischen Modell.

## 10. Erweiterungspunkte

Neue Intents:
- `lib/services/intent.service.ts` für Muster und Flags.
- `lib/services/response.service.ts` für die konkrete Antwortlogik.
- `lib/services/knowledge.service.ts` falls dazu Wissen benötigt wird.

Neue Wissensquellen:
- `knowledge/` für Markdown.
- `data/` für strukturierte JSON-Quellen.
- `lib/services/knowledge.service.ts` für das Laden und Ranking.

Bessere Kontextverarbeitung:
- `lib/services/conversation.service.ts` für Speicherstruktur und Nachrichtenumfang.
- `lib/services/response.service.ts` für die Nutzung von `lastIntent`, `lastTopic`, `lastEntity`.
- `lib/services/knowledge.service.ts` für Kontext-Ranking.

Mehrsprachigkeit:
- `app/api/chat/route.ts` für Request-Weitergabe und mögliche Sprachparameter.
- `lib/services/intent.service.ts` für Sprachmuster.
- `lib/services/knowledge.service.ts` für mehrsprachige Dokumente.
- `lib/services/llm.service.ts` für den Sprach- und Prompt-Kontext.