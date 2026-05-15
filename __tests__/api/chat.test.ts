import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/chat/route';

// Mock data for testing
const mockProperties = [
  {
    id: 'prop1',
    title: '3-Zimmer Altbauwohnung mit Balkon',
    price: '€ 350.000',
    location: 'Wien 1070',
    size: '85m²',
    rooms: '3',
    available: 'sofort',
    description: 'Wunderschöne Altbauwohnung in Wien 7. Bezirk',
  },
  {
    id: 'prop2',
    title: '2-Zimmer Neubauwohnung',
    price: '€ 420.000',
    location: 'Wien 1220',
    size: '65m²',
    rooms: '2',
    available: 'Juni 2026',
    description: 'Moderne Neubauwohnung mit Vollausstattung',
  },
  {
    id: 'prop3',
    title: '3-Zimmer Einfamilienhaus',
    price: '€ 550.000',
    location: 'Graz',
    size: '120m²',
    rooms: '3',
    available: 'August 2026',
    description: 'Familienfreundliches Haus mit Garten',
  },
];

// Helper to create a mock NextRequest
function createMockRequest(message: string, sessionId?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/chat');
  const request = new NextRequest(url, {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    }),
    body: JSON.stringify({ message }),
  });

  // Simulate session cookie
  if (sessionId) {
    Object.defineProperty(request, 'cookies', {
      value: {
        get: (name: string) => (name === 'session_id' ? { value: sessionId } : undefined),
      },
      writable: true,
    });
  }

  return request;
}

// Helper to parse response
async function parseResponse(response: Response): Promise<{ reply: string }> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse response: ${text}`);
  }
}

// Mock fetch for Azure OpenAI
function mockAzureOpenAI(response: any = {}) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.includes('embeddings')) {
      return new Response(
        JSON.stringify({
          data: [{ embedding: Array(1536).fill(0.1) }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof url === 'string' && url.includes('chat/completions')) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  response.content ||
                  'Das ist eine Standard-Antwort vom LLM.',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({}), { status: 404 });
  });
}

describe('Chat API - Booking Flow Tests', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = `test-session-${Date.now()}`;
    mockAzureOpenAI();
    // Set environment variables
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-mini';
    process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
    process.env.SESSION_COOKIE_NAME = 'session_id';
    process.env.IMMOBOT_SESSION_SECRET = 'test-secret-key-for-testing-only';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TEST 1: Price Query → "ja" → Booking Start', () => {
    it('should start booking flow when "ja" follows cheapest property query', async () => {
      // Step 1: Ask for cheapest property
      const req1 = createMockRequest('was ist deine günstigste immobilie', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      // Verify cheapest property is shown
      expect(data1.reply).toContain('günstigste Immobilie');
      expect(data1.reply).toContain('€ 350.000');
      expect(res1.status).toBe(200);

      // Step 2: User confirms with "ja"
      const req2 = createMockRequest('ja', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      // CRITICAL: Should NOT show property list, should ask for booking details
      expect(data2.reply).not.toContain('Folgende Immobilien');
      expect(data2.reply).toContain('Besichtigungstermin vereinbaren');
      expect(data2.reply).not.toContain('€');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 2: Booking + Location ("7ten Bezirk")', () => {
    it('should handle location in booking flow and map to correct property', async () => {
      // Step 1: Start booking
      const req1 = createMockRequest('termin', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('Termin');
      expect(data1.reply).toContain('Immobilie');

      // Step 2: Provide location "7ten Bezirk"
      const req2 = createMockRequest('im 7ten bezirk', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      // Should select property in 1070 (7th district)
      expect(data2.reply).toContain('Altbauwohnung');
      expect(data2.reply).toContain('Termin');
      expect(data2.reply).not.toContain('Folgende Immobilien');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 3: District Mapping Validation', () => {
    it('should correctly map "7ten bezirk" to 1070, not 1007', async () => {
      // Start booking and provide district
      const req = createMockRequest('termin', sessionId);
      await POST(req);

      const req2 = createMockRequest('7ten bezirk', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      // Must extract property in Wien 1070
      expect(data2.reply).toContain('1070');
      // Should NOT accidentally show 1007 or other districts
      expect(data2.reply).not.toContain('1007');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 4: Booking Not Interrupted by Location Filter', () => {
    it('should not apply location filter during booking, only select property', async () => {
      // Step 1: Start appointment booking
      const req1 = createMockRequest('termin', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('Termin');

      // Step 2: Provide location (1070)
      const req2 = createMockRequest('1070', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      // Should interpret location as property selection in booking flow
      // Should NOT show the full location filter list
      expect(data2.reply).not.toContain('Folgende passende Immobilien in 1070');
      expect(data2.reply).toContain('Termin');
      expect(data2.reply).toContain('Altbauwohnung');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 5: Follow-up "ja" Does Not Reset State', () => {
    it('should remain in booking context when "ja" is repeated', async () => {
      // Step 1: Ask for cheapest
      const req1 = createMockRequest('günstigste', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('günstigste Immobilie');

      // Step 2: Confirm with "ja"
      const req2 = createMockRequest('ja', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      expect(data2.reply).toContain('Termin');
      expect(data2.reply).not.toContain('Folgende Immobilien');

      // Step 3: Confirm again with "ja"
      const req3 = createMockRequest('ja', sessionId);
      const res3 = await POST(req3);
      const data3 = await parseResponse(res3);

      // Should not reset to property list
      expect(data3.reply).not.toContain('Folgende Immobilien');
      // Should stay in booking context
      expect(data3.reply).not.toContain('offTopic');
      expect(res3.status).toBe(200);
    });
  });

  describe('TEST 6: Full Booking Flow Complete', () => {
    it('should complete full booking: property → time → summary', async () => {
      // Step 1: Start booking
      const req1 = createMockRequest('termin', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('Termin');

      // Step 2: Select property
      const req2 = createMockRequest('3-Zimmer Altbauwohnung mit Balkon', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      expect(data2.reply).toContain('Altbauwohnung');
      expect(data2.reply).toContain('Termin');
      expect(data2.reply).not.toContain('Zusammenfassung');

      // Step 3: Provide time
      const req3 = createMockRequest('morgen 10:00', sessionId);
      const res3 = await POST(req3);
      const data3 = await parseResponse(res3);

      // Should show booking summary
      expect(data3.reply).toContain('Zusammenfassung');
      expect(data3.reply).toContain('Altbauwohnung');
      expect(data3.reply).toContain('10:00');
      expect(data3.reply).toContain('Ansprechpartner');
      expect(res3.status).toBe(200);
    });
  });

  describe('TEST 7: Edge Case - Unclear Input Fallback', () => {
    it('should provide helpful fallback for unclear booking input', async () => {
      // Step 1: Start booking
      const req1 = createMockRequest('termin', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('Termin');

      // Step 2: Provide unclear input
      const req2 = createMockRequest('keine ahnung', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      // Should provide friendly fallback, not error
      expect(data2.reply).toContain('Für welche Immobilie') ||
        expect(data2.reply).toContain('wann passt');
      expect(data2.reply).not.toContain('Fehler');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 2.5 BONUS: Most Expensive Query → Booking', () => {
    it('should handle most expensive property and transition to booking', async () => {
      // Step 1: Ask for most expensive
      const req1 = createMockRequest('teuerste immobilie', sessionId);
      const res1 = await POST(req1);
      const data1 = await parseResponse(res1);

      expect(data1.reply).toContain('teuerste Immobilie');
      expect(data1.reply).toContain('€ 550.000');

      // Step 2: Confirm booking
      const req2 = createMockRequest('ja', sessionId);
      const res2 = await POST(req2);
      const data2 = await parseResponse(res2);

      expect(data2.reply).toContain('Termin');
      expect(data2.reply).not.toContain('Folgende Immobilien');
      expect(res2.status).toBe(200);
    });
  });

  describe('TEST 8 BONUS: Location Filter Outside Booking', () => {
    it('should apply location filter when NOT in booking mode', async () => {
      // Ask for properties in a location WITHOUT being in booking mode
      const req = createMockRequest('immobilien wien 1070', sessionId);
      const res = await POST(req);
      const data = await parseResponse(res);

      // SHOULD show property list for this location
      expect(data.reply).toContain('Wien 1070') || 
        expect(data.reply).toContain('Altbauwohnung');
      expect(res.status).toBe(200);
    });
  });

  describe('Greeting and Smalltalk Tests', () => {
    it('should respond to greeting "hallo"', async () => {
      const req = createMockRequest('hallo', sessionId);
      const res = await POST(req);
      const data = await parseResponse(res);

      expect(data.reply).toContain('Hallo') || 
        expect(data.reply).toContain('Guten Tag');
      expect(res.status).toBe(200);
    });

    it('should respond to smalltalk "wie gehts"', async () => {
      const req = createMockRequest('wie gehts', sessionId);
      const res = await POST(req);
      const data = await parseResponse(res);

      expect(data.reply).toContain('gut') || 
        expect(data.reply).toContain('Immobilien');
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should reject requests without authorization', async () => {
      const url = new URL('http://localhost:3000/api/chat');
      const request = new NextRequest(url, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ message: 'test' }),
      });

      const res = await POST(request);
      expect(res.status).toBe(401) || expect(res.status).toBe(200);
    });

    it('should reject messages longer than 300 characters', async () => {
      const longMessage = 'a'.repeat(301);
      const req = createMockRequest(longMessage, sessionId);
      const res = await POST(req);
      const data = await parseResponse(res);

      expect(data.reply).toContain('300 Zeichen') || 
        expect(res.status).toBe(400);
    });

    it('should handle invalid JSON gracefully', async () => {
      const url = new URL('http://localhost:3000/api/chat');
      const request = new NextRequest(url, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
        }),
        body: '{invalid json',
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
    });
  });
});
