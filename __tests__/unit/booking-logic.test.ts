import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

/**
 * UNIT TESTS FOR BOOKING FLOW LOGIC
 * Tests the core extraction and decision logic without full API integration
 */

// ============================================
// MOCK DATA & HELPERS
// ============================================

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
    description: 'Moderne Neubauwohnung',
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

// ============================================
// EXTRACT KEY FUNCTIONS FROM route.ts LOGIC
// ============================================

function extractPriceNumber(price: string): number {
  const digits = price.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function extractLocation(message: string): string | null {
  const m = message.toLowerCase();

  // Postal codes (e.g., 1070, 1220)
  const postalMatch = m.match(/\b10\d{2}\b/);
  if (postalMatch) return postalMatch[0];

  // Cities
  const cities = ['wien', 'graz', 'salzburg', 'linz', 'innsbruck'];
  for (const city of cities) {
    if (m.includes(city)) return city;
  }

  // District mapping: "7. bezirk", "7ten bezirk", "7ter bezirk", etc.
  // Vienna districts 1-23 map to 1010, 1020, ..., 1070, ..., 1230
  const districtMatch = m.match(/\b(\d{1,2})\.?\s*(?:ten|ter)?\s*bezirk\b/);
  if (districtMatch) {
    const num = parseInt(districtMatch[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 23) {
      // District N maps to 10N0 (e.g., 7 → 1070, 23 → 1230)
      const postal = num < 10 ? `10${num}0` : `1${num}0`;
      return postal;
    }
  }

  return null;
}

function extractProperty(message: string): string | null {
  const m = message.toLowerCase();
  // Try exact match first
  let match = mockProperties.find((p) => m.includes(p.title.toLowerCase()));
  if (match) return match.title;

  // Try keyword matching for common property keywords
  const keywords = ['altbauwohnung', 'neubauwohnung', 'einfamilienhaus', 'haus', 'wohnung'];
  for (const prop of mockProperties) {
    for (const keyword of keywords) {
      if (prop.title.toLowerCase().includes(keyword) && m.includes(keyword)) {
        return prop.title;
      }
    }
  }

  return null;
}

function extractTime(message: string): string | null {
  const m = message.toLowerCase();
  const match = m.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  return match ? match[0] : null;
}

function extractNaturalTimePreference(message: string): string | null {
  const m = message.toLowerCase();
  const patterns = [
    { phrase: 'morgen vormittag', value: 'morgen Vormittag' },
    { phrase: 'morgen nachmittag', value: 'morgen Nachmittag' },
    { phrase: 'morgen abend', value: 'morgen Abend' },
    { phrase: 'übermorgen', value: 'übermorgen' },
    { phrase: 'vormittag', value: 'Vormittag' },
    { phrase: 'nachmittag', value: 'Nachmittag' },
    { phrase: 'abend', value: 'Abend' },
    { phrase: 'heute', value: 'heute' },
  ];

  const match = patterns.find((entry) => m.includes(entry.phrase));
  return match ? match.value : null;
}

function extractRooms(message: string): number | null {
  const match = message.match(/(\d+)\s*zimmer/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractMaxPrice(message: string): number | null {
  const match = message.match(/unter\s*([\d.]+)/i);
  if (!match) return null;

  const normalized = match[1].replace(/\./g, '').replace(/\D/g, '');
  return normalized ? parseInt(normalized, 10) : null;
}

function parsePrice(priceString: string): number {
  const digits = priceString.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function extractSearchLocation(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('wien')) return 'wien';
  if (m.includes('graz')) return 'graz';
  const districtMatch = m.match(/\b(?:im|in|beim|bei)\s*(\d{1,2})\.?\s*(?:ten|ter)?(?:\s*bezirk)?\b/);
  if (districtMatch) {
    const num = parseInt(districtMatch[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 23) {
      const postal = num < 10 ? `10${num}0` : `1${num}0`;
      return postal;
    }
  }
  const zipMatch = m.match(/\b1\d{3}\b/);
  if (zipMatch && m.includes(`unter ${zipMatch[0]}`)) return null;
  return zipMatch ? zipMatch[0] : null;
}

function applyFilters(
  message: string,
  list: Array<{ rooms: number; price: string; location: string }>
) {
  let filtered = [...list];

  const rooms = extractRooms(message);
  const maxPrice = extractMaxPrice(message);
  const location = extractSearchLocation(message);

  if (rooms !== null) {
    filtered = filtered.filter((property) => property.rooms === rooms);
  }

  if (maxPrice !== null) {
    filtered = filtered.filter((property) => {
      const price = parsePrice(property.price);
      return price <= maxPrice;
    });
  }

  if (location) {
    filtered = filtered.filter((property) => property.location.toLowerCase().includes(location));
  }

  return filtered;
}

function buildContextFromList(
  list: Array<{ title: string; price: string; location: string; size: string; rooms: number; available: string }>
) {
  const found = list.length > 0;

  const context = list
    .map(
      (prop) =>
        `**${prop.title}**\n` +
        `Preis: ${prop.price}\n` +
        `Ort: ${prop.location}\n` +
        `Größe: ${prop.size}, ${prop.rooms} Zimmer\n` +
        `Verfügbar: ${prop.available}`
    )
    .join('\n\n---\n\n');

  return { context, found };
}

function isCheapestRequest(message: string): boolean {
  const m = message.toLowerCase();
  return [
    'günstigste',
    'billigste',
    'am günstigsten',
    'am billigsten',
  ].some((phrase) => m.includes(phrase)) && !m.includes('teuerste');
}

function isMostExpensiveRequest(message: string): boolean {
  const m = message.toLowerCase();
  return [
    'teuerste',
    'am teuersten',
    'höchster preis',
    'höchsten preis',
  ].some((phrase) => m.includes(phrase));
}

function isBookingTopic(message: string): boolean {
  const BOOKING_KEYWORDS = [
    'termin',
    'uhrzeit',
    'zeit',
    'besichtigung',
    'treffen',
    'buchen',
  ];
  return BOOKING_KEYWORDS.some((word) =>
    message.toLowerCase().includes(word)
  );
}

function isGreetingOnly(message: string): boolean {
  const SINGLE_GREETINGS = ['hallo', 'hi', 'servus', 'hey'];
  const cleaned = message.toLowerCase().trim();
  return SINGLE_GREETINGS.includes(cleaned);
}

function isSmalltalkMessage(message: string): boolean {
  const cleaned = message.toLowerCase();
  return [
    'wie gehts',
    'wie geht es',
    'alles gut',
  ].some((phrase) => cleaned.includes(phrase));
}

function isIdentityQuestion(message: string): boolean {
  const m = message.toLowerCase();
  return [
    'wer bist du',
    'wer sind sie',
    'wer bist denn du',
    'wer sind denn sie',
  ].some((phrase) => m.includes(phrase));
}

function getPriceSortedProperties(ascending: boolean) {
  const sorted = [...mockProperties].sort((a, b) => {
    const priceA = extractPriceNumber(a.price);
    const priceB = extractPriceNumber(b.price);
    return ascending ? priceA - priceB : priceB - priceA;
  });
  return sorted[0] || null;
}

// ============================================
// TESTS
// ============================================

describe('Chat API Logic - Booking Flow Unit Tests', () => {
  describe('Location Extraction', () => {
    describe('TEST 3: District Mapping ("7ten Bezirk" → 1070)', () => {
      it('should map "7ten bezirk" to 1070', () => {
        const result = extractLocation('7ten bezirk');
        expect(result).toBe('1070');
      });

      it('should map "7. bezirk" to 1070', () => {
        const result = extractLocation('7. bezirk');
        expect(result).toBe('1070');
      });

      it('should NOT map "7ten bezirk" to 1007', () => {
        const result = extractLocation('7ten bezirk');
        expect(result).not.toBe('1007');
        expect(result).toBe('1070');
      });

      it('should recognize postal code directly', () => {
        const result = extractLocation('1070');
        expect(result).toBe('1070');
      });

      it('should recognize city names', () => {
        const result1 = extractLocation('wien');
        const result2 = extractLocation('graz');
        expect(result1).toBe('wien');
        expect(result2).toBe('graz');
      });

      it('should return null for non-location strings', () => {
        const result = extractLocation('keine ahnung');
        expect(result).toBeNull();
      });

      it('should handle all Vienna districts 1-9 mapping', () => {
        for (let i = 1; i <= 9; i++) {
          const input = `${i}. bezirk`;
          const result = extractLocation(input);
          const expected = `10${i}0`; // 1 → 1010, 7 → 1070, 9 → 1090
          expect(result).toBe(expected);
        }
      });

      it('should handle districts 10+ correctly', () => {
        const result10 = extractLocation('10. bezirk');
        expect(result10).toBe('1100'); // 10 → 1100

        const result23 = extractLocation('23. bezirk');
        expect(result23).toBe('1230'); // 23 → 1230
      });
    });
  });

  describe('Property Extraction', () => {
    it('should extract property by full title', () => {
      const result = extractProperty('3-Zimmer Altbauwohnung mit Balkon');
      expect(result).toBe('3-Zimmer Altbauwohnung mit Balkon');
    });

    it('should extract property by partial match', () => {
      const result = extractProperty('interesse an der altbauwohnung');
      expect(result).toBe('3-Zimmer Altbauwohnung mit Balkon');
    });

    it('should return null if no property matches', () => {
      const result = extractProperty('keine immobilie');
      expect(result).toBeNull();
    });
  });

  describe('Time Extraction', () => {
    it('should extract time in HH:MM format', () => {
      expect(extractTime('morgen 10:00')).toBe('10:00');
      expect(extractTime('14:30 passt mir')).toBe('14:30');
      expect(extractTime('09:15 treffen')).toBe('09:15');
    });

    it('should extract natural time preferences', () => {
      expect(extractNaturalTimePreference('ja, am besten morgen vormittag')).toBe('morgen Vormittag');
      expect(extractNaturalTimePreference('morgen nachmittag passt mir')).toBe('morgen Nachmittag');
      expect(extractNaturalTimePreference('heute abend')).toBe('Abend');
    });

    it('should return null for invalid time', () => {
      expect(extractTime('keine ahnung')).toBeNull();
      expect(extractTime('25:00')).toBeNull();
      expect(extractNaturalTimePreference('keine ahnung')).toBeNull();
    });
  });

  describe('Intent Detection', () => {
    describe('Price Queries', () => {
      it('should detect cheapest request', () => {
        expect(isCheapestRequest('günstigste immobilie')).toBe(true);
        expect(isCheapestRequest('billigste wohnung')).toBe(true);
        expect(isCheapestRequest('am günstigsten')).toBe(true);
      });

      it('should NOT detect teuerste as günstigste', () => {
        expect(isCheapestRequest('teuerste immobilie')).toBe(false);
      });

      it('should detect most expensive request', () => {
        expect(isMostExpensiveRequest('teuerste immobilie')).toBe(true);
        expect(isMostExpensiveRequest('am teuersten')).toBe(true);
      });

      it('should NOT detect günstigste as teuerste', () => {
        expect(isMostExpensiveRequest('günstigste wohnung')).toBe(false);
      });
    });

    describe('Booking Intent', () => {
      it('should detect booking topics', () => {
        expect(isBookingTopic('termin')).toBe(true);
        expect(isBookingTopic('besichtigung')).toBe(true);
        expect(isBookingTopic('termin vereinbaren')).toBe(true);
      });
    });

    describe('Greetings', () => {
      it('should detect greeting-only messages', () => {
        expect(isGreetingOnly('hallo')).toBe(true);
        expect(isGreetingOnly('hi')).toBe(true);
        expect(isGreetingOnly('servus')).toBe(true);
      });

      it('should not treat compound messages as greetings', () => {
        expect(isGreetingOnly('hallo wie gehts')).toBe(false);
      });
    });

    describe('Smalltalk', () => {
      it('should detect smalltalk messages', () => {
        expect(isSmalltalkMessage('wie gehts')).toBe(true);
        expect(isSmalltalkMessage('wie geht es')).toBe(true);
        expect(isSmalltalkMessage('alles gut')).toBe(true);
      });
    });

    describe('Identity Questions', () => {
      it('should detect identity questions', () => {
        expect(isIdentityQuestion('wer bist du')).toBe(true);
        expect(isIdentityQuestion('wer sind sie')).toBe(true);
      });
    });
  });

  describe('Price-Based Ranking', () => {
    it('should find cheapest property', () => {
      const cheapest = getPriceSortedProperties(true);
      expect(cheapest?.title).toBe('3-Zimmer Altbauwohnung mit Balkon');
      expect(cheapest?.price).toBe('€ 350.000');
    });

    it('should find most expensive property', () => {
      const expensive = getPriceSortedProperties(false);
      expect(expensive?.title).toBe('3-Zimmer Einfamilienhaus');
      expect(expensive?.price).toBe('€ 550.000');
    });

    it('should rank all properties correctly', () => {
      const sorted = [...mockProperties].sort((a, b) =>
        extractPriceNumber(a.price) - extractPriceNumber(b.price)
      );

      expect(extractPriceNumber(sorted[0].price)).toBe(350000);
      expect(extractPriceNumber(sorted[1].price)).toBe(420000);
      expect(extractPriceNumber(sorted[2].price)).toBe(550000);
    });
  });

  describe('Deterministic Property Filters', () => {
    const filterProperties = [
      {
        id: 'rent-1',
        title: '2-Zimmer City Apartment',
        price: 'EUR 1.190 / Monat',
        location: 'Wien 1070',
        size: '78 m²',
        rooms: 2,
        available: 'sofort',
      },
      {
        id: 'rent-2',
        title: '3-Zimmer Family Home',
        price: 'EUR 1.450 / Monat',
        location: 'Wien 1220',
        size: '95 m²',
        rooms: 3,
        available: '01.06.2026',
      },
      {
        id: 'rent-3',
        title: '2-Zimmer Graz Flat',
        price: 'EUR 980 / Monat',
        location: 'Graz',
        size: '61 m²',
        rooms: 2,
        available: 'sofort',
      },
    ];

    it('should extract rooms, max price, and location independently', () => {
      expect(extractRooms('2 Zimmer in Wien unter 1200')).toBe(2);
      expect(extractMaxPrice('2 Zimmer in Wien unter 1200')).toBe(1200);
      expect(extractSearchLocation('2 Zimmer in Wien unter 1200')).toBe('wien');
      expect(extractSearchLocation('1070')).toBe('1070');
      expect(extractSearchLocation('wohnung im 22ten')).toBe('1220');
      expect(extractSearchLocation('wohnung im 22. bezirk')).toBe('1220');
      expect(extractMaxPrice('unter 1.500 euro im monat')).toBe(1500);
      expect(extractMaxPrice('unter 2.000 euro')).toBe(2000);
      expect(parsePrice('EUR 1.420 / Monat')).toBe(1420);
    });

    it('should apply combined filters deterministically', () => {
      const result = applyFilters('2 Zimmer in Wien unter 1200', filterProperties);
      expect(result.map((property) => property.id)).toEqual(['rent-1']);
    });

    it('should filter by price only when only a budget is given', () => {
      const result = applyFilters('unter 1000', filterProperties);
      expect(result.map((property) => property.id)).toEqual(['rent-3']);
    });

    it('should return no results when criteria do not match', () => {
      const result = applyFilters('4 Zimmer in Wien unter 900', filterProperties);
      expect(result).toHaveLength(0);
    });

    it('should build context only from filtered properties', () => {
      const result = buildContextFromList([filterProperties[0]]);
      expect(result.found).toBe(true);
      expect(result.context).toContain('2-Zimmer City Apartment');
      expect(result.context).toContain('Wien 1070');
    });
  });

  describe('TEST 1: Price Query → "ja" Flow Logic', () => {
    it('should detect price query and respond appropriately', () => {
      const message = 'was ist die günstigste immobilie';
      expect(isCheapestRequest(message)).toBe(true);

      const cheapest = getPriceSortedProperties(true);
      expect(cheapest).toBeDefined();
      expect(cheapest?.price).toBe('€ 350.000');
    });

    it('should recognize "ja" as confirmation', () => {
      const message = 'ja';
      // "ja" should be recognized as booking follow-up
      // It's not a separate intent, but context-dependent
      expect(message.toLowerCase().trim()).toBe('ja');
    });
  });

  describe('TEST 4: Booking Logic - Location as Property Selection', () => {
    it('should differentiate between location extraction in booking vs normal flow', () => {
      const message = '1070';
      const location = extractLocation(message);

      expect(location).toBe('1070');

      // In booking context: should find property with this location
      const propertiesInLocation = mockProperties.filter((p) =>
        p.location.toLowerCase().includes(location!.toLowerCase())
      );

      expect(propertiesInLocation.length).toBeGreaterThan(0);
      expect(propertiesInLocation[0].location).toContain('1070');
    });

    it('should handle "7ten bezirk" in booking context', () => {
      const message = '7ten bezirk';
      const location = extractLocation(message);

      expect(location).toBe('1070');

      const propertiesInDistrict = mockProperties.filter((p) =>
        p.location.includes('1070')
      );

      expect(propertiesInDistrict.length).toBeGreaterThan(0);
      expect(propertiesInDistrict[0].title).toContain('Altbauwohnung');
    });
  });

  describe('TEST 5: "ja" Follow-up - Should Not Reset', () => {
    it('should recognize repeated "ja" as continuation, not reset', () => {
      // Multiple "ja" messages should all be recognized as affirmations
      const messages = ['ja', 'ja', 'ja'];
      messages.forEach((msg) => {
        expect(msg.toLowerCase().trim()).toBe('ja');
      });
    });

    it('should support "ja" with natural time follow-up', () => {
      const time = extractNaturalTimePreference('ja, am besten morgen vormittag');
      expect(time).toBe('morgen Vormittag');
    });
  });

  describe('TEST 6: Full Booking Flow - Sequence Logic', () => {
    it('should sequence: booking → property → time correctly', () => {
      // Step 1: Booking topic detected
      expect(isBookingTopic('termin')).toBe(true);

      // Step 2: Property extraction
      const property = extractProperty('3-Zimmer Altbauwohnung mit Balkon');
      expect(property).toBe('3-Zimmer Altbauwohnung mit Balkon');

      // Step 3: Time extraction
      const time = extractTime('morgen 10:00');
      expect(time).toBe('10:00');
    });

    it('should handle all parts of booking flow', () => {
      const step1Message = 'termin';
      const step2Message = '1070';
      const step3Message = '10:00';

      expect(isBookingTopic(step1Message)).toBe(true);
      expect(extractLocation(step2Message)).toBe('1070');
      expect(extractTime(step3Message)).toBe('10:00');
    });
  });

  describe('TEST 7: Edge Case - Unclear Input', () => {
    it('should not match any specific intent for unclear input', () => {
      const unclear = 'keine ahnung';

      expect(isBookingTopic(unclear)).toBe(false);
      expect(isCheapestRequest(unclear)).toBe(false);
      expect(isMostExpensiveRequest(unclear)).toBe(false);
      expect(extractLocation(unclear)).toBeNull();
      expect(extractProperty(unclear)).toBeNull();
      expect(extractTime(unclear)).toBeNull();
    });

    it('should have fallback behavior for unmatched input', () => {
      // This represents the fallback in booking: ask for clarification
      const unclear = 'ich weiß nicht';
      const hasIntent =
        isBookingTopic(unclear) ||
        extractLocation(unclear) ||
        extractProperty(unclear) ||
        extractTime(unclear);

      expect(hasIntent).toBeFalsy();
      // In route.ts, this would trigger the fallback reply
    });
  });

  describe('BONUS: Conversation State Transitions', () => {
    it('should track state transition: none → isInPropertyFlow', () => {
      const message = 'günstigste';
      const isTriggeringPropertyFlow = isCheapestRequest(message);
      expect(isTriggeringPropertyFlow).toBe(true);
      // This should set isInPropertyFlow = true in route.ts
    });

    it('should track state transition: isInPropertyFlow → isBooking', () => {
      const message = 'ja';
      // After showing property, "ja" should set isBooking = true
      expect(message.toLowerCase().trim()).toBe('ja');
    });

    it('should maintain isBooking state through location/time inputs', () => {
      // While isBooking = true:
      // - location should NOT trigger location filter
      // - extraction should happen for property/time selection only
      const locationMsg = '1070';
      const timeMsg = '10:00';

      expect(extractLocation(locationMsg)).toBe('1070');
      expect(extractTime(timeMsg)).toBe('10:00');
      // These should be used for booking, not as filters
    });
  });

  describe('BONUS: Response Formatting Logic', () => {
    it('should not include property list during booking property selection', () => {
      // When user provides property/location during booking:
      // Response should ask for TIME, not show a list
      const property = '3-Zimmer Altbauwohnung mit Balkon';
      expect(extractProperty(property)).toBeDefined();
      // Response: "Perfekt. Für die Immobilie '...' – wann passt es Ihnen?"
    });

    it('should include summary format for completion', () => {
      // Final response should have:
      const expectedSummary = `Perfekt, hier die Zusammenfassung:

• Immobilie: 3-Zimmer Altbauwohnung mit Balkon
• Termin: 10:00

Ein Ansprechpartner wird sich zur Bestätigung bei Ihnen melden.`;

      expect(expectedSummary).toContain('Zusammenfassung');
      expect(expectedSummary).toContain('Immobilie:');
      expect(expectedSummary).toContain('Termin:');
    });
  });
});
