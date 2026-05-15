import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock data matching route.ts
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

// In-memory session store for testing
const testSessionStore: Map<string, any> = new Map();

// Create a test session ID
function createTestSession(): string {
  const sid = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  testSessionStore.set(sid, {
    isLead: false,
    isInPropertyFlow: false,
    isBooking: false,
    messages: [],
  });
  return sid;
}

// Helper: simulate API request with session
async function makeApiRequest(message: string, sessionId: string, baseUrl = 'http://localhost:3000') {
  const apiUrl = `${baseUrl}/api/chat`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    return {
      status: response.status,
      reply: data.reply,
      data,
    };
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

describe('Chat API - Booking Flow Integration Tests', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = createTestSession();
    
    // Set up environment
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-mini';
    process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
    process.env.SESSION_COOKIE_NAME = 'session_id';
    process.env.IMMOBOT_SESSION_SECRET = 'test-secret-key-for-testing-only';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';

    // Mock fetch for Azure OpenAI
    global.fetch = vi.fn(async (url: string | Request, init?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.url;
      
      // Mock embeddings endpoint
      if (urlString.includes('embeddings')) {
        return new Response(
          JSON.stringify({
            data: [{ embedding: Array(1536).fill(0.1) }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Mock chat completions endpoint
      if (urlString.includes('chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Die günstigste Immobilie ist die 3-Zimmer Altbauwohnung.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TEST 1: Price Query → "ja" → Booking Start (No List Reset)', () => {
    it('should transition to booking when "ja" follows cheapest query', async () => {
      // Step 1: User asks for cheapest property
      let response = await makeApiRequest('was ist deine günstigste immobilie', sessionId);
      console.log('Step 1 response:', response.reply);
      
      expect(response.status).toBe(200);
      expect(response.reply).toContain('günstigste') || expect(response.reply).toContain('€');

      // Step 2: User confirms with "ja"
      response = await makeApiRequest('ja', sessionId);
      console.log('Step 2 response:', response.reply);
      
      // ASSERTION: Should NOT show property list
      expect(response.reply).not.toMatch(/Folgende|passende|Immobilien.*:$/m);
      // ASSERTION: Should ask for booking details
      expect(response.reply).toContain('Termin') || 
        expect(response.reply).toContain('Besichtigung');
    });
  });

  describe('TEST 2: Booking + Location Mapping ("7ten Bezirk" → 1070)', () => {
    it('should handle location input during booking flow', async () => {
      // Step 1: Start booking
      let response = await makeApiRequest('termin', sessionId);
      console.log('Step 1 (termin):', response.reply);
      expect(response.status).toBe(200);
      expect(response.reply).toContain('Termin') || 
        expect(response.reply).toContain('Besichtigung');

      // Step 2: Provide location "7ten bezirk"
      response = await makeApiRequest('im 7ten bezirk', sessionId);
      console.log('Step 2 (7ten bezirk):', response.reply);
      
      // Should NOT show full property list
      expect(response.reply).not.toMatch(/Folgende.*Immobilien/);
      // Should show property OR ask for time
      expect(response.reply).toContain('Altbauwohnung') || 
        expect(response.reply).toContain('Termin');
    });
  });

  describe('TEST 3: District Mapping Validation (1070, NOT 1007)', () => {
    it('should correctly map "7ten bezirk" to postal code 1070', async () => {
      // Test the extraction logic directly
      const testCases = [
        { input: '7ten bezirk', expected: '1070' },
        { input: '7. bezirk', expected: '1070' },
        { input: 'wien 1070', expected: '1070' },
      ];

      for (const testCase of testCases) {
        const response = await makeApiRequest(`termin in ${testCase.input}`, sessionId);
        console.log(`Mapping test [${testCase.input}]:`, response.reply);
        
        // Should contain or reference the correct district
        expect(response.reply).not.toContain('1007');
        expect(response.reply).toContain('1070') || 
          expect(response.reply).toContain('Altbauwohnung');
      }
    });
  });

  describe('TEST 4: Booking NOT Interrupted by Location Filter', () => {
    it('should use location as property selection, not as filter during booking', async () => {
      // Start booking
      let response = await makeApiRequest('termin buchen', sessionId);
      console.log('Step 1:', response.reply);
      expect(response.status).toBe(200);

      // Provide location code (1070)
      response = await makeApiRequest('1070', sessionId);
      console.log('Step 2 (1070):', response.reply);
      
      // ASSERTION: Should NOT apply location filter (full list)
      expect(response.reply).not.toMatch(/Folgende.*Immobilien.*:[\s\S]*•.*•/);
      // ASSERTION: Should interpret as property selection in booking
      expect(response.reply).toContain('Altbauwohnung') || 
        expect(response.reply).toContain('Zeit');
    });
  });

  describe('TEST 5: Follow-up "ja" Does NOT Reset Booking State', () => {
    it('should remain in booking context when "ja" repeated', async () => {
      // Step 1: Query cheapest
      let response = await makeApiRequest('günstigste', sessionId);
      console.log('Step 1 (günstigste):', response.reply.substring(0, 100));

      // Step 2: First "ja" → start booking
      response = await makeApiRequest('ja', sessionId);
      console.log('Step 2 (ja #1):', response.reply.substring(0, 100));
      expect(response.reply).toContain('Termin');

      // Step 3: Second "ja" → should NOT reset
      response = await makeApiRequest('ja', sessionId);
      console.log('Step 3 (ja #2):', response.reply.substring(0, 100));
      
      // ASSERTION: No property listing
      expect(response.reply).not.toMatch(/^Folgende.*Immobilien/m);
      // ASSERTION: Still in booking context
      expect(response.reply).toContain('Immobilie') || 
        expect(response.reply).toContain('Termin');
    });
  });

  describe('TEST 6: Full Booking Flow - Property + Time + Summary', () => {
    it('should complete booking: start → property → time → summary', async () => {
      // Step 1: Initiate booking
      let response = await makeApiRequest('termin', sessionId);
      console.log('Step 1 (termin):', response.reply.substring(0, 100));
      expect(response.reply).toContain('Termin') || 
        expect(response.reply).toContain('Besichtigung');

      // Step 2: Select property
      response = await makeApiRequest('3-Zimmer Altbauwohnung mit Balkon', sessionId);
      console.log('Step 2 (property):', response.reply.substring(0, 100));
      expect(response.reply).toContain('Altbauwohnung');

      // Step 3: Provide time
      response = await makeApiRequest('morgen 10:00', sessionId);
      console.log('Step 3 (time):', response.reply.substring(0, 100));
      
      // ASSERTION: Should show summary
      expect(response.reply).toContain('Zusammenfassung') || 
        expect(response.reply).toContain('Termin') ||
        expect(response.reply).toContain('Ansprechpartner');
    });
  });

  describe('TEST 7: Edge Case - Unclear Input Fallback', () => {
    it('should provide fallback for unclear inputs during booking', async () => {
      // Start booking
      let response = await makeApiRequest('termin', sessionId);
      console.log('Step 1:', response.reply.substring(0, 100));

      // Provide unclear input
      response = await makeApiRequest('keine ahnung', sessionId);
      console.log('Step 2 (fallback):', response.reply);
      
      // ASSERTION: Should provide helpful fallback, not error
      expect(response.reply).not.toContain('Fehler');
      expect(response.reply).toContain('Immobilie') || 
        expect(response.reply).toContain('Termin') ||
        expect(response.reply).toContain('passt');
    });
  });

  describe('BONUS TEST: Most Expensive Property + Booking', () => {
    it('should handle most expensive query and transition to booking', async () => {
      // Query most expensive
      let response = await makeApiRequest('teuerste immobilie', sessionId);
      console.log('Step 1 (teuerste):', response.reply.substring(0, 100));
      expect(response.status).toBe(200);

      // Confirm booking
      response = await makeApiRequest('ja', sessionId);
      console.log('Step 2 (ja):', response.reply.substring(0, 100));
      
      // Should ask for booking details, not list
      expect(response.reply).toContain('Termin') || 
        expect(response.reply).toContain('Immobilie');
      expect(response.reply).not.toMatch(/Folgende.*Immobilien/);
    });
  });

  describe('Greeting & Intent Recognition', () => {
    it('should recognize greeting "hallo" and respond appropriately', async () => {
      const response = await makeApiRequest('hallo', sessionId);
      console.log('Greeting response:', response.reply.substring(0, 100));
      
      expect(response.status).toBe(200);
      expect(response.reply).toContain('Hallo') || 
        expect(response.reply).toContain('Tag');
    });

    it('should recognize identity question', async () => {
      const response = await makeApiRequest('wer bist du', sessionId);
      console.log('Identity response:', response.reply.substring(0, 100));
      
      expect(response.status).toBe(200);
      expect(response.reply).toContain('Immobilienberater') || 
        expect(response.reply).toContain('Berater');
    });
  });

  describe('Input Validation', () => {
    it('should reject messages exceeding 300 characters', async () => {
      const longMessage = 'a'.repeat(301);
      const response = await makeApiRequest(longMessage, sessionId);
      
      expect(response.status).toBe(400) || 
        expect(response.reply).toContain('300');
    });

    it('should handle empty messages gracefully', async () => {
      const response = await makeApiRequest('', sessionId);
      
      expect(response.status).toBe(400) || 
        expect(response.status).toBe(200);
    });
  });
});
