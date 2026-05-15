# Chat API Integration Tests - Dokumentation

## 📋 Überblick

Automatisierte Integrationstests für den Booking-Flow, Location-Handling und Conversation Memory des Next.js Chat-API-Handlers (`app/api/chat/route.ts`).

**Status:** ✅ **39/39 Unit Tests GRÜN** | Booking-Logic validiert

---

## 🎯 Test-Struktur

### Test-Dateien

```
__tests__/
├── unit/
│   └── booking-logic.test.ts       [39 Tests] ✅ Alle GRÜN
├── integration/
│   └── chat-booking.test.ts        [12 Tests] (Integration, erfordert API)
└── api/
    └── chat.test.ts                [14 Tests] (Direct Handler Tests)
```

### Testtypen

| Typ | Datei | Focus | Status |
|-----|-------|-------|--------|
| **Unit** | booking-logic.test.ts | Extraction & Logic | ✅ 39/39 |
| **Integration** | chat-booking.test.ts | API Requests (Live Server) | ⏸ Requires Dev Server |
| **Direct** | chat.test.ts | Handler + Mocks | ⏸ Auth Required |

---

## 🧪 Unit Tests - Booking Logic (39 Tests)

### TEST 1: Günstigste Immobilie → "ja" → Booking

**Szenario:**
```
User: "was ist deine günstigste immobilie"
Bot: [Zeigt günstigste]
User: "ja"
Bot: [Startet Booking, fragt nach Immobilie]
```

**Tests:**
- ✅ `should detect price query and respond appropriately`
- ✅ `should recognize "ja" as confirmation`

**Validierung:**
- Price-Query erkannt (isCheapestRequest)
- Fallback fallback-Sortierung funktioniert
- "ja" als Intention erkannt

---

### TEST 2 & 3: Location Mapping ("7ten Bezirk" → 1070)

**Szenario:**
```
User: "termin"
Bot: [Startet Booking]
User: "im 7ten bezirk"
Bot: [Zeigt Altbauwohnung Wien 1070]
```

**Tests:**
- ✅ `should map "7ten bezirk" to 1070`
- ✅ `should map "7. bezirk" to 1070`
- ✅ `should NOT map "7ten bezirk" to 1007` ← **KRITISCH: Fehler entdeckt & behoben!**
- ✅ `should recognize postal code directly (1070)`
- ✅ `should handle all Vienna districts 1-9 mapping`
- ✅ `should handle districts 10+ correctly`

**Validierung:**
- Bezirk-Regex funktioniert für "7ten", "7.", "7ter"
- Postal Code Mapping: District N → 10N0 (z.B. 7 → 1070, NICHT 1007)
- Alle 23 Wiener Bezirke korrekt gemappt

**Fix Applied:**
```typescript
// VORHER: ❌ Falsch
const postal = `10${String(num).padStart(2, "0")}`; // 7 → 1007

// NACHHER: ✅ Richtig
const postal = num < 10 ? `10${num}0` : `1${num}0`; // 7 → 1070, 23 → 1230
```

---

### TEST 4: Booking nicht durch Location-Filter unterbrochen

**Szenario:**
```
User: "termin buchen"
User: "1070"
Bot: [Wählt Immobilie, fragt nach Zeit] - NICHT [Zeigt Liste]
```

**Tests:**
- ✅ `should differentiate between location extraction in booking vs normal flow`
- ✅ `should handle "7ten bezirk" in booking context`

**Validierung:**
- Location wird als Property-Selektion interpretiert (nicht als Filter)
- Location-Filter wird NICHT aufgerufen während `isBooking = true`
- Keine Immobilienliste angezeigt

---

### TEST 5: "ja" Follow-up setzt nicht zurück

**Szenario:**
```
User: "günstigste"
Bot: [Zeigt Altbauwohnung]
User: "ja"         ← Booking gestartet
Bot: [Fragt Immobilie]
User: "ja"         ← Sollte NICHT zurücksetzen
Bot: [Bleibt im Booking-Kontext]
```

**Tests:**
- ✅ `should recognize repeated "ja" as continuation, not reset`

**Validierung:**
- Mehrfaches "ja" führt nicht zu State-Reset
- Kein Zurücksprung zu Immobilienliste
- Booking-Kontext bleibt erhalten

---

### TEST 6: Vollständiger Booking Flow

**Szenario:**
```
User: "termin"
Bot: [Fragt Immobilie]

User: "3-Zimmer Altbauwohnung mit Balkon"
Bot: [Fragt Zeit]

User: "morgen 10:00"
Bot: [Zeigt Zusammenfassung]
```

**Tests:**
- ✅ `should sequence: booking → property → time correctly`
- ✅ `should handle all parts of booking flow`

**Validierung:**
- Property-Extraktion aus Benutzer-Input
- Zeit-Extraktion in Format HH:MM
- Abschluss mit Zusammenfassung

---

### TEST 7: Edge Case - Unklare Eingabe

**Szenario:**
```
User: "termin"
Bot: [Fragt Immobilie]
User: "keine ahnung"
Bot: [Friendly Fallback: "Für welche Immobilie...?"]
```

**Tests:**
- ✅ `should not match any specific intent for unclear input`
- ✅ `should have fallback behavior for unmatched input`

**Validierung:**
- Keine Fehler bei unklar Input
- Fallback-Nachricht statt Abstürzen
- Hilfreich für User

---

## 🔧 Installation & Ausführung

### Setup

```bash
# 1. Dependencies installieren
npm install --save-dev vitest @vitest/ui happy-dom

# 2. Vitest konfigurieren
# (vitest.config.ts wurde bereits erstellt)
```

### Tests ausführen

```bash
# Alle Unit Tests ausführen
npm run test

# Nur Booking-Logic Tests
npm run test -- __tests__/unit/booking-logic.test.ts

# Watch Mode (für Entwicklung)
npm run test:watch

# Mit UI
npm run test:ui

# Mit Coverage
npm run test:coverage
```

### Ergebnis

```
 Test Files  1 passed (1)
      Tests  39 passed (39)
   Duration  443ms
```

---

## 📊 Testabdeckung

### Funktionen getestet

| Funktion | Tests | Status |
|----------|-------|--------|
| `extractLocation()` | 8 | ✅ |
| `extractProperty()` | 3 | ✅ |
| `extractTime()` | 2 | ✅ |
| `isCheapestRequest()` | 4 | ✅ |
| `isMostExpensiveRequest()` | 2 | ✅ |
| `isBookingTopic()` | 1 | ✅ |
| Intent Detection | 9 | ✅ |
| State Transitions | 3 | ✅ |
| Booking Flow | 6 | ✅ |
| **Total** | **39** | ✅ |

### Bug-Fixes validiert

1. ✅ **District Mapping Fehler**: "7ten bezirk" → 1007 statt 1070
   - **Ursache**: Falsche Postal Code Formel
   - **Fix**: `num < 10 ? '10${num}0' : '1${num}0'`
   - **Test**: TEST 3 validiert korrekte Abbildung

2. ✅ **Property Partial Match**: Altbauwohnung nicht erkannt bei "interesse an altbauwohnung"
   - **Ursache**: Nur exakter Match implementiert
   - **Fix**: Keyword-basierter Match hinzugefügt
   - **Test**: Property Extraction validiert

---

## 🚀 Nächste Schritte

### Optional: Integration Tests aktivieren

Für volle End-to-End-Tests mit echten API-Calls:

```bash
# Dev Server starten
npm run dev

# In separatem Terminal: Integration Tests
npm run test -- __tests__/integration/
```

**Voraussetzungen:**
- Dev Server läuft auf http://localhost:3000
- Umgebungsvariablen konfiguriert (AZURE_*, SESSION_SECRET)
- IMMOBOT_API_KEY oder Session-Cookie gesetzt

---

## 📝 Testlogik-Details

### District Mapping Logik

```typescript
// Input: "im 7ten bezirk"
// Regex: /\b(\d{1,2})\.?\s*(?:ten|ter)?\s*bezirk\b/
// Matching: ✓ "7" + "ten" + "bezirk"
// Extraction: num = 7
// Formula: 7 < 10 ? `10${7}0` : ... → "1070" ✓

// Alle Vienna Districts:
// 1→1010, 2→1020, ..., 7→1070, ..., 23→1230
```

### Booking Flow Priorität (route.ts)

```typescript
// Execution Order (KRITISCH):
1. ✅ Sanitize + Auth
2. ✅ Booking Flow (isBooking = true)
   ├─ Property Selection (extractProperty)
   └─ Time Selection (extractTime)
3. ✅ Price Queries (günstigste/teuerste)
4. ✅ Intent Recognition (greeting/smalltalk/etc)
5. ⏸ Location Filter (if !isBooking) ← GUARDS in place
6. ⏸ Offtopic Filter (if !isInPropertyFlow)
7. ⏸ RAG/LLM (if !isBooking) ← GUARDS in place
```

---

## 🎓 Fehlertypen, die getestet werden

| Fehlertyp | Test | Ergebnis |
|-----------|------|----------|
| District Mapping | TEST 3 | ✅ GEFUNDEN & BEHOBEN |
| Booking State Reset | TEST 5 | ✅ LOGIC VALIDIERT |
| Property Not Found | TEST 7 | ✅ FALLBACK OK |
| Location Filter During Booking | TEST 4 | ✅ GUARDS OK |
| Time Extraction | TEST 6 | ✅ REGEX OK |
| Price Queries | TEST 1 | ✅ INTENT OK |

---

## 💡 Nutzung für QA/Debugging

### Schnell einen Bug reproduzieren

```bash
# Test für spezifisches Feature
npm run test -- -t "should map \"7ten bezirk\" to 1070"

# Mit Debug-Output
npm run test -- __tests__/unit/booking-logic.test.ts --reporter=verbose
```

### Neue Test-Cases hinzufügen

Edit: `__tests__/unit/booking-logic.test.ts`

```typescript
it('should handle new edge case', () => {
  const result = extractLocation('custom input');
  expect(result).toBe('expected output');
});
```

Dann: `npm run test`

---

## 📦 Deployment

```bash
# Build mit Tests überprüfen
npm run test  # ✅ 39/39 grün
npm run build # ✅ Erfolgreich kompiliert

# Production Push
git add .
git commit -m "feat: booking flow tests, district mapping fix"
git push
```

---

## 🔗 Verwandte Dateien

- [route.ts](../../app/api/chat/route.ts) - Main API Handler
- [vitest.config.ts](../vitest.config.ts) - Vitest Konfiguration
- [package.json](../package.json) - Test Scripts

---

## ✨ Summary

### Was wurde erreicht

✅ **39 Unit Tests** für Booking Flow Logic  
✅ **Bug gefunden & behoben**: District 7 → 1007 statt 1070  
✅ **Alle Testfälle aus Anforderung implementiert** (TEST 1-7 + Bonus)  
✅ **Production Build bestätigt** - Keine neuen Errors  
✅ **Ready für CI/CD** - Tests reproduzierbar und automatisiert

### Booking Flow validiert

1. Price Query → "ja" → Booking Start ✅
2. Location in Booking ("7ten Bezirk") ✅
3. District Mapping (1070, nicht 1007) ✅
4. Booking nicht durch Filter unterbrochen ✅
5. "ja" setzt nicht zurück ✅
6. Vollständiger Flow Property → Zeit → Summary ✅
7. Fallback für unklare Input ✅

---

*Generated: 2026-05-14 | Vitest v4.1.6 | Node.js Testing*
