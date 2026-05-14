# Security Hardening für Hostinger Deployment

## ✅ Bereits umgesetzt

### 1. **Security Headers (Helmet-Pattern)**
- ✅ `X-Content-Type-Options: nosniff` — verhindert MIME-Sniffing-Attacken
- ✅ `X-Frame-Options: DENY` — blockiert Clickjacking (Seite kann nicht in iFrame eingebunden werden)
- ✅ `X-XSS-Protection: 1; mode=block` — Legacy XSS-Schutz
- ✅ `Referrer-Policy: strict-origin-when-cross-origin` — verhindert Leakage von sensiblen URLs
- ✅ `Permissions-Policy` — blockiert Zugriff auf Kamera, Mikrofon, ZahlungsAPIs
- ✅ `Strict-Transport-Security` — erzwingt HTTPS für 2 Jahre
- **Ort:** [app/api/chat/route.ts](app/api/chat/route.ts#L4-L12)

### 2. **CORS Protection (Domain-Restriction)**
- ✅ CORS auf localhost(3000, 3001) begrenzt
- ✅ OPTIONS-Preflight Handler implementiert
- ✅ CORS-Rejection für unbekannte Domains mit 403 Status
- **Ort:** [app/api/chat/route.ts](app/api/chat/route.ts#L14-L26)

### 3. **Input Validation**
- ✅ Message-Länge limitiert (300 Zeichen)
- ✅ Themenfilter implementiert (nur Immobilien-Keywords)
- ✅ Greetings zugelassen (freundliche Konversation möglich)
- **Ort:** [app/api/chat/route.ts](app/api/chat/route.ts)

### 4. **Rate Limiting**
- ✅ 5 Requests pro Minute pro IP
- ✅ Sliding-Window Algorithmus
- ⚠️ **Limitation:** Nur in-Memory (verliert Zustand bei Restart)

### 5. **Secrets Management**
- ✅ `.env.local` in `.gitignore` aufgelistet (wird nicht committed)
- ✅ `.env.example` erstellt mit Placeholders
- ⚠️ **WARNUNG:** Aktueller Azure API Key in `.env.local` sollte rotiert werden!
- **Ort:** [.env.example](.env.example)

### 6. **Dependency Audit**
- ✅ `npm audit fix` ausgeführt → 10 Packages geupdated
- ⚠️ 2 verbleibende CVEs in Next.js (CRITICAL) — optional zu updaten

---

## 📋 Empfehlungen für Hostinger Production Deployment

### CRITICAL (vor Go-Live)
1. **Azure API Key rotieren**
   - Geh zu Azure Portal → API Keys → Rotate
   - `.env.local` mit neuem Key aktualisieren
   - NICHT in Git committen!

2. **CORS Domain auf deine Production URL updaten**
   ```typescript
   // Beispiel in app/api/chat/route.ts:
   const ALLOWED_ORIGINS = [
     "https://immobot.example.com", // DEINE DOMAIN
     "https://www.immobot.example.com"
   ];
   ```

3. **Environment Variables auf Hostinger setzen**
   - Nicht `.env.local` commiten, sondern via Hostinger Panel → Environment Variables
   - Setzen: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`

### HIGH (empfohlen vor Go-Live)
4. **Rate Limiting auf Redis/Cloud Backend upgraden**
   - Aktuelle in-Memory Lösung funktioniert nur auf 1 Instanz
   - Für Production: Redis oder Upstash Serverless Redis verwenden
   ```bash
   npm install upstash-redis
   ```

5. **HTTPS & TLS erzwingen**
   - Hostinger sollte kostenloses Let's Encrypt SSL bieten
   - Stelle sicher: HTTPS redirect, HSTS enabled

6. **Logging & Monitoring aufsetzen**
   - Errors zu Sentry/Logflare schicken (kein secrets logging!)
   - Rate-Limit-Alerts einrichten

7. **Content Security Policy (CSP) erweitern** (optional, für iframe)
   - Wenn ChatWidget in iFrame, CSP Header anpassen

### MEDIUM (optional)
8. **Automated backups für `data/properties.json`**
   - Daten sind statisch, aber regelmäßige Snapshots empfohlen

9. **DDoS Protection**
   - Cloudflare vor Hostinger vorschalten (kostenlos) für zusätzlichen Schutz

10. **API Rate Limit per Endpoint-Type differenzieren**
    - z.B. Greeting: höherer Limit als komplexe Queries

---

## 🧪 Testing vor Deployment

```bash
# 1. Secrets nicht committed?
git status | grep env.local  # sollte nichts zeigen

# 2. Dependencies aktuell?
npm audit

# 3. Build & Start Production
npm run build
npm start  # oder über Hostinger Start-Command

# 4. Security Headers testen (lokal)
curl -i -X OPTIONS http://localhost:3000/api/chat \
  -H "Origin: https://example.com"

# 5. CORS Rejection Test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{"message":"hallo"}'
# sollte 403 zurückgeben
```

---

## 🚀 Deployment-Checkliste (Hostinger)

- [ ] `.env.local` mit Production Keys aktualisiert
- [ ] Azure Key rotiert
- [ ] CORS Domain auf Production gesetzt
- [ ] Environment Vars in Hostinger Panel: `AZURE_OPENAI_*` gesetzt
- [ ] `.env.local` NOT in Git
- [ ] `npm run build` erfolgreich lokal
- [ ] `npm audit` ohne kritische vulns (oder upgrades akzeptiert)
- [ ] HTTPS & Zertifikat aktiv
- [ ] Health-Check Test (z.B. `GET /` sollte 200 sein)
- [ ] Greeting + Rate-Limit-Test durchgeführt
- [ ] Logs & Monitoring konfiguriert

---

## 📞 Support für Hostinger

Falls Fragen beim Deployment:
1. Hostinger Docs: https://support.hostinger.com/en/articles/4701596-how-to-deploy-node-js-applications
2. Next.js Production: https://nextjs.org/docs/app/building-your-application/deploying
3. Azure OpenAI: https://learn.microsoft.com/en-us/azure/ai-services/openai/

---

**Zusammenfassung:** Deine App ist jetzt sicherer mit Headers, CORS, Input Validation und Secrets Protection. Für Production auf Hostinger: Key rotieren, CORS Domain updaten, Env Vars setzen, optional auf Redis upgraden.
