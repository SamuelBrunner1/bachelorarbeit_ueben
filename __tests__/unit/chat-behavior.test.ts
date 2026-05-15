import { describe, expect, it } from 'vitest';

type Property = {
  id: string;
  title: string;
  price: string;
  location: string;
  rooms: number;
  size: string;
  available: string;
};

type ConversationState = {
  isBooking: boolean;
  isInPropertyFlow: boolean;
  selectedProperty?: string;
  selectedLocation?: string;
  selectedTime?: string;
  lastIntent?: string;
};

const properties: Property[] = [
  {
    id: 'rent-1',
    title: '3-Zimmer Altbauwohnung mit Balkon',
    price: 'EUR 1.190 / Monat',
    location: 'Wien, 1070 Neubau',
    rooms: 3,
    size: '78 m²',
    available: '01.06.2026',
  },
  {
    id: 'rent-2',
    title: 'Modernes Neubau-Apartment',
    price: 'EUR 1.420 / Monat',
    location: 'Wien, 1220 Donaustadt',
    rooms: 2,
    size: '65 m²',
    available: '15.05.2026',
  },
  {
    id: 'sale-1',
    title: 'Reihenhaus mit Garten und Garage',
    price: 'EUR 689.000 Kaufpreis',
    location: 'Graz, Eggenberg',
    rooms: 3,
    size: '122 m²',
    available: 'Sofort',
  },
];

function parsePrice(priceString: string): number {
  const digits = priceString.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function extractRooms(message: string): number | null {
  const match = message.match(/(\d+)\s*zimmer/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractMaxPrice(message: string): number | null {
  const match = message.match(/(?:unter|bis|max(?:imal)?(?:preis)?(?:\s*von)?)\s*([\d.]+)/i);
  if (!match) return null;
  return parseInt(match[1].replace(/\./g, ''), 10) || null;
}

function extractLocation(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('wien')) return 'wien';
  if (m.includes('graz')) return 'graz';

  const districtMatch = m.match(/\b(?:im|in|beim|bei)\s*(\d{1,2})\.?\s*(?:ten|ter)?(?:\s*bezirk)?\b/);
  if (districtMatch) {
    const num = parseInt(districtMatch[1], 10);
    return num < 10 ? `10${num}0` : `1${num}0`;
  }

  const zipMatch = m.match(/\b1\d{3}\b/);
  return zipMatch ? zipMatch[0] : null;
}

function isSmalltalk(message: string): boolean {
  const m = message.toLowerCase();
  return ['wie gehts dir', 'wie gehts', 'hallo', 'hi', 'servus', 'hey'].some((phrase) => m.includes(phrase));
}

function isYesIntent(message: string): boolean {
  const m = message.toLowerCase().trim();
  return ['ja', 'ja bitte', 'gerne', 'ok', 'okay', 'möchte ich', 'moechte ich'].includes(m);
}

function isTimeIntent(message: string): boolean {
  const m = message.toLowerCase();
  return ['morgen', 'vormittag', 'nachmittag', 'abend', '10:00', 'uhrzeit', 'termin'].some((phrase) => m.includes(phrase));
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
    { phrase: 'morgen', value: 'morgen' },
    { phrase: 'vormittag', value: 'Vormittag' },
    { phrase: 'nachmittag', value: 'Nachmittag' },
    { phrase: 'abend', value: 'Abend' },
    { phrase: 'heute', value: 'heute' },
  ];

  const match = patterns.find((entry) => m.includes(entry.phrase));
  return match ? match.value : null;
}

function extractBookingTimePreference(message: string): string | null {
  const explicitTime = extractTime(message);
  const naturalTime = extractNaturalTimePreference(message);

  if (explicitTime && naturalTime) {
    return `${naturalTime} ${explicitTime}`;
  }

  return explicitTime || naturalTime;
}

function extractPropertyOrdinal(message: string): number | null {
  const m = message.toLowerCase();
  if (m.includes('erste') || m.includes('1.')) return 0;
  if (m.includes('zweite') || m.includes('2.')) return 1;
  if (m.includes('dritte') || m.includes('3.')) return 2;
  return null;
}

function resolveBookingProperty(message: string, state?: ConversationState): Property | null {
  const m = message.toLowerCase();

  if (state?.selectedProperty) {
    const existing = properties.find((entry) => entry.title === state.selectedProperty);
    if (existing) return existing;
  }

  const direct = properties.find((entry) => m.includes(entry.title.toLowerCase()));
  if (direct) return direct;

  const ordinal = extractPropertyOrdinal(message);
  if (ordinal !== null && properties[ordinal]) return properties[ordinal];

  const location = extractLocation(message);
  if (location) {
    const matches = properties.filter((entry) => entry.location.toLowerCase().includes(location));
    if (matches.length > 0) return matches[0];
  }

  if (m.includes('wohnung in wien')) {
    return properties.find((entry) => entry.location.toLowerCase().includes('wien')) || null;
  }

  return null;
}

function buildBookingConfirmationReply(selectedProperty: string, selectedTime: string): string {
  return `Perfekt, hier die Zusammenfassung:\n\n• Immobilie: ${selectedProperty}\n• Termin: ${selectedTime}\n\nIch habe den Termin für Sie vorgemerkt. Ein Ansprechpartner meldet sich in Kürze zur finalen Bestätigung.`;
}

function hasExplicitBookingIntent(message: string): boolean {
  const m = message.toLowerCase();
  return [
    'termin',
    'besichtigung',
    'besichtigen',
    'vereinbaren',
    'vorbeikommen',
    'anschauen',
    'schauen',
  ].some((phrase) => m.includes(phrase));
}

function sortPropertiesByPrice(list: Property[], ascending: boolean): Property[] {
  return [...list].sort((left, right) => {
    const priceLeft = parsePrice(left.price);
    const priceRight = parsePrice(right.price);
    return ascending ? priceLeft - priceRight : priceRight - priceLeft;
  });
}

function pickCombinedIntentProperty(message: string, list: Property[]): Property | null {
  if (/günstig|preiswert|billig|unter/i.test(message)) {
    return sortPropertiesByPrice(list, true)[0] || null;
  }

  if (list.length === 1) {
    return list[0];
  }

  const location = extractLocation(message);
  if (location) {
    const byLocation = list.filter((entry) => entry.location.toLowerCase().includes(location));
    if (byLocation.length === 1) return byLocation[0];
  }

  return null;
}

function buildCombinedIntentReply(message: string, list: Property[], requestedTime: string | null): string {
  const explicitBookingIntent = hasExplicitBookingIntent(message);
  const selectedProperty = pickCombinedIntentProperty(message, list);

  if (selectedProperty && explicitBookingIntent && requestedTime) {
    return buildBookingConfirmationReply(selectedProperty.title, requestedTime);
  }

  const intro = selectedProperty
    ? 'Die günstigste passende Immobilie ist:'
    : 'Ich habe folgende passende Immobilien für Sie:';
  const shown = selectedProperty ? [selectedProperty] : list;
  const timePrompt = requestedTime
    ? `Besichtigungen sind möglich. Möchten Sie einen Termin für ${requestedTime} festlegen?`
    : explicitBookingIntent
      ? 'Besichtigungen sind möglich. Wann passt es Ihnen für die Besichtigung?'
      : 'Besichtigungen sind möglich. Möchten Sie einen Termin vereinbaren?';

  return `${intro}\n\n${formatList(shown)}\n\n${timePrompt}`;
}

function isDetailQuestion(message: string): boolean {
  const m = message.toLowerCase();
  return ['was kostet die', 'wie groß ist die', 'wie gross ist die', 'ist die noch verfügbar', 'ist die noch verfuegbar'].some((phrase) => m.includes(phrase));
}

function applyFilters(message: string, list: Property[]): Property[] {
  let filtered = [...list];
  const rooms = extractRooms(message);
  const maxPrice = extractMaxPrice(message);
  const location = extractLocation(message);

  if (rooms !== null) {
    filtered = filtered.filter((property) => property.rooms === rooms);
  }

  if (maxPrice !== null) {
    filtered = filtered.filter((property) => parsePrice(property.price) <= maxPrice);
  }

  if (location) {
    filtered = filtered.filter((property) => property.location.toLowerCase().includes(location));
  }

  return filtered;
}

function formatList(list: Property[]): string {
  return list
    .map(
      (property) =>
        `• ${property.title}\n` +
        `Ort: ${property.location}\n` +
        `Preis: ${property.price}\n` +
        `Größe: ${property.size}, ${property.rooms} Zimmer\n` +
        `Verfügbar: ${property.available}`
    )
    .join('\n\n');
}

function runConversation(messages: string[]) {
  const state: ConversationState = {
    isBooking: false,
    isInPropertyFlow: false,
  };

  const replies: string[] = [];

  for (const rawMessage of messages) {
    const message = rawMessage.trim();

    if (isSmalltalk(message)) {
      state.lastIntent = 'smalltalk';
      replies.push('Mir geht’s gut, danke 😊 Wie kann ich Ihnen bei einer Immobilie helfen?');
      continue;
    }

    if (state.isBooking && isTimeIntent(message)) {
      state.lastIntent = 'time_intent';
      replies.push('Alles klar. Ich habe den Termin vorgemerkt. Möchten Sie das bestätigen?');
      continue;
    }

    if (state.selectedProperty && isDetailQuestion(message)) {
      state.lastIntent = 'detail_question';
      const property = properties.find((entry) => entry.title === state.selectedProperty) || null;
      replies.push(
        property
          ? `Gerne. Hier die Details zur Immobilie:\n\n• ${property.title}\n  Ort: ${property.location}\n  Preis: ${property.price}\n  Größe: ${property.size}, ${property.rooms} Zimmer\n  Verfügbar: ${property.available}`
          : 'Meinen Sie die zuvor genannte Immobilie oder möchten Sie eine andere auswählen?'
      );
      continue;
    }

    if (state.isInPropertyFlow && !state.isBooking && isYesIntent(message)) {
      state.isBooking = true;
      state.lastIntent = 'booking_started_via_affirmation';
      replies.push('Perfekt. Wann passt es Ihnen für die Besichtigung?');
      continue;
    }

    if (message.toLowerCase().includes('günstigste')) {
      state.isInPropertyFlow = true;
      state.selectedProperty = '3-Zimmer Altbauwohnung mit Balkon';
      state.lastIntent = 'price_query';
      replies.push(
        'Die günstigste Immobilie ist:\n\n• 3-Zimmer Altbauwohnung mit Balkon\n  Ort: Wien, 1070 Neubau\n  Preis: EUR 1.190 / Monat\n  Größe: 78 m², 3 Zimmer\n  Verfügbar: 01.06.2026\n\nMöchten Sie einen Besichtigungstermin vereinbaren?'
      );
      continue;
    }

    if (message.toLowerCase().includes('termin')) {
      state.isBooking = true;
      state.isInPropertyFlow = true;
      state.lastIntent = 'booking_started';
      replies.push('Gerne. Für welche Immobilie möchten Sie einen Besichtigungstermin vereinbaren?');
      continue;
    }

    const filtered = applyFilters(message, properties);
    if (/zimmer|unter|wien|graz|bezirk|wohnung|immobilie/i.test(message)) {
      state.isInPropertyFlow = true;
      state.lastIntent = 'search_filter';
      if (filtered.length === 0) {
        replies.push('Leider habe ich aktuell keine passenden Immobilien für diese Kriterien. Möchten Sie die Suche etwas anpassen (z. B. Budget oder Zimmeranzahl)?');
      } else {
        replies.push(
          `Ich habe folgende passende Immobilien für Sie:\n\n${formatList(filtered)}\n\nMöchten Sie einen Besichtigungstermin vereinbaren?`
        );
      }
      continue;
    }

    state.lastIntent = 'fallback';
    replies.push('Ich helfe Ihnen gerne bei der Immobiliensuche. Nennen Sie mir z. B. Ort, Budget oder Zimmeranzahl.');
  }

  return { replies, state };
}

function runBookingConversation(messages: string[], initialState: Partial<ConversationState> = {}) {
  const state: ConversationState = {
    isBooking: false,
    isInPropertyFlow: true,
    ...initialState,
  };

  const replies: string[] = [];

  for (const rawMessage of messages) {
    const message = rawMessage.trim();
    const lower = message.toLowerCase();
    const bookingTrigger = isYesIntent(message) || lower.includes('besichtigung');

    if (state.isBooking || (state.isInPropertyFlow && bookingTrigger)) {
      const resolvedProperty = resolveBookingProperty(message, state);
      const nextSelectedProperty = resolvedProperty?.title || state.selectedProperty;
      const nextSelectedLocation = resolvedProperty?.location || state.selectedLocation;
      const nextSelectedTime = state.selectedTime || extractBookingTimePreference(message);

      if (!nextSelectedProperty && nextSelectedTime) {
        state.isBooking = true;
        state.selectedTime = nextSelectedTime;
        state.lastIntent = 'booking_waiting_for_property';
        replies.push('Für welche Immobilie möchten Sie den Termin vereinbaren?');
        continue;
      }

      if (nextSelectedProperty && !nextSelectedTime) {
        state.isBooking = true;
        state.selectedProperty = nextSelectedProperty;
        state.selectedLocation = nextSelectedLocation;
        state.lastIntent = state.isBooking ? 'booking_started' : 'booking_started_via_affirmation';
        replies.push(`Perfekt. Für die Immobilie "${nextSelectedProperty}" – wann passt es Ihnen für die Besichtigung?`);
        continue;
      }

      if (!nextSelectedProperty) {
        state.isBooking = true;
        state.lastIntent = state.isBooking ? 'booking_started' : 'booking_started_via_affirmation';
        replies.push('Für welche Immobilie möchten Sie den Termin vereinbaren?');
        continue;
      }

      state.isBooking = false;
      state.selectedProperty = nextSelectedProperty;
      state.selectedLocation = nextSelectedLocation;
      state.selectedTime = nextSelectedTime || undefined;
      state.lastIntent = 'booking_completed';
      replies.push(buildBookingConfirmationReply(nextSelectedProperty, nextSelectedTime || ''));
      continue;
    }

    if (message.toLowerCase().includes('günstigste')) {
      state.isInPropertyFlow = true;
      state.selectedProperty = '3-Zimmer Altbauwohnung mit Balkon';
      state.selectedLocation = 'Wien, 1070 Neubau';
      state.lastIntent = 'price_query';
      replies.push('Die günstigste Immobilie ist:\n\n• 3-Zimmer Altbauwohnung mit Balkon\n  Ort: Wien, 1070 Neubau\n  Preis: EUR 1.190 / Monat\n  Größe: 78 m², 3 Zimmer\n  Verfügbar: 01.06.2026\n\nMöchten Sie einen Besichtigungstermin vereinbaren?');
      continue;
    }

    if (message.toLowerCase().includes('termin')) {
      state.isBooking = true;
      state.isInPropertyFlow = true;
      state.lastIntent = 'booking_started';
      replies.push('Gerne. Für welche Immobilie möchten Sie einen Besichtigungstermin vereinbaren?');
      continue;
    }

    if (state.isBooking) {
      replies.push('Für welche Immobilie möchten Sie den Termin vereinbaren?');
      continue;
    }

    replies.push('Ich helfe Ihnen gerne bei der Immobiliensuche. Nennen Sie mir z. B. Ort, Budget oder Zimmeranzahl.');
  }

  return { replies, state };
}

function runMultiIntentConversation(message: string) {
  const requestedTime = extractBookingTimePreference(message);
  const hasPropertyIntent = /günstig|wohnung|haus|immobilie|zimmer|unter|wien|graz|bezirk/i.test(message);
  const hasExplicitBooking = hasExplicitBookingIntent(message);
  const filtered = applyFilters(message, properties);
  const list = filtered.length > 0 ? filtered : properties;

  if (hasPropertyIntent && (hasExplicitBooking || requestedTime)) {
    return buildCombinedIntentReply(message, list, requestedTime);
  }

  return 'no-match';
}

describe('Chat Behavior', () => {
  it('filter by rooms', () => {
    const filtered = applyFilters('2 zimmer', properties);
    expect(filtered.every((property) => property.rooms === 2)).toBe(true);
    expect(filtered).toHaveLength(1);
  });

  it('filter by price', () => {
    const filtered = applyFilters('unter 1.500', properties);
    expect(filtered.every((property) => parsePrice(property.price) <= 1500)).toBe(true);
    expect(filtered.map((property) => property.title)).toContain('3-Zimmer Altbauwohnung mit Balkon');
    expect(filtered.map((property) => property.title)).toContain('Modernes Neubau-Apartment');
  });

  it('combined filters', () => {
    const filtered = applyFilters('2 zimmer in wien unter 1500', properties);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Modernes Neubau-Apartment');
  });

  it('detail question uses selected property', () => {
    const convo = ['günstigste wohnung', 'was kostet die'];
    const run = runConversation(convo);

    expect(run.replies[1]).toContain('EUR 1.190 / Monat');
    expect(run.replies[1]).not.toContain('Modernes Neubau-Apartment');
    expect(run.state.selectedProperty).toBe('3-Zimmer Altbauwohnung mit Balkon');
    expect(run.state.lastIntent).toBe('detail_question');
  });

  it('yes triggers booking', () => {
    const convo = ['günstigste wohnung', 'ja'];
    const run = runConversation(convo);

    expect(run.replies[1]).toContain('Wann passt es Ihnen');
    expect(run.state.isBooking).toBe(true);
    expect(run.state.lastIntent).toBe('booking_started_via_affirmation');
  });

  it('time in booking does not show list', () => {
    const convo = ['günstigste wohnung', 'ja', 'morgen'];
    const run = runConversation(convo);

    expect(run.replies[2]).toContain('Termin vorgemerkt');
    expect(run.replies[2]).not.toContain('•');
    expect(run.state.isBooking).toBe(true);
    expect(run.state.lastIntent).toBe('time_intent');
  });

  it('nonsense input does not crash', () => {
    const run = runConversation(['asdf']);
    expect(run.replies[0]).toContain('Immobiliensuche');
    expect(run.state.lastIntent).toBe('fallback');
  });

  it('smalltalk works', () => {
    const run = runConversation(['wie gehts dir']);
    expect(run.replies[0]).toContain('Wie kann ich Ihnen bei einer Immobilie helfen?');
    expect(run.state.lastIntent).toBe('smalltalk');
  });

  it('booking flow completes with property and combined time', () => {
    const run = runBookingConversation(['günstigste', 'ja', 'morgen 8:00']);

    expect(run.replies[0]).toContain('günstigste Immobilie');
    expect(run.replies[1]).toContain('wann passt es Ihnen für die Besichtigung');
    expect(run.replies[2]).toBe(
      'Perfekt, hier die Zusammenfassung:\n\n• Immobilie: 3-Zimmer Altbauwohnung mit Balkon\n• Termin: morgen 8:00\n\nIch habe den Termin für Sie vorgemerkt. Ein Ansprechpartner meldet sich in Kürze zur finalen Bestätigung.'
    );
    expect(run.state.selectedProperty).toBe('3-Zimmer Altbauwohnung mit Balkon');
    expect(run.state.selectedTime).toBe('morgen 8:00');
    expect(run.state.isBooking).toBe(false);
  });

  it('asks for property when only time is given', () => {
    const run = runBookingConversation(['morgen 8:00'], { isBooking: true, selectedProperty: undefined });

    expect(run.replies[0]).toBe('Für welche Immobilie möchten Sie den Termin vereinbaren?');
    expect(run.state.selectedTime).toBe('morgen 8:00');
    expect(run.state.isBooking).toBe(true);
  });

  it('asks for time when only property is given', () => {
    const run = runBookingConversation(['im 7ten bezirk'], { isBooking: true });

    expect(run.replies[0]).toContain('Altbauwohnung');
    expect(run.replies[0]).toContain('wann passt es Ihnen für die Besichtigung');
    expect(run.state.selectedProperty).toBe('3-Zimmer Altbauwohnung mit Balkon');
    expect(run.state.selectedLocation).toBe('Wien, 1070 Neubau');
  });

  it('does not fall back to a listing after booking confirmation', () => {
    const run = runBookingConversation(['günstigste', 'ja', 'morgen 8:00', 'ja']);

    expect(run.replies[2]).toContain('Zusammenfassung');
    expect(run.replies[3]).toContain('Zusammenfassung');
    expect(run.replies[3]).not.toContain('Folgende Immobilien');
  });

  it('final confirmation is formatted exactly', () => {
    const reply = buildBookingConfirmationReply('3-Zimmer Altbauwohnung mit Balkon', 'morgen 8:00');

    expect(reply).toBe(
      'Perfekt, hier die Zusammenfassung:\n\n• Immobilie: 3-Zimmer Altbauwohnung mit Balkon\n• Termin: morgen 8:00\n\nIch habe den Termin für Sie vorgemerkt. Ein Ansprechpartner meldet sich in Kürze zur finalen Bestätigung.'
    );
  });

  it('multi-intent without explicit booking offers tomorrow instead of re-asking time', () => {
    const reply = runMultiIntentConversation('hast du was günstiges und kann ich morgen schauen?');

    expect(reply).toContain('Zusammenfassung');
    expect(reply).toContain('3-Zimmer Altbauwohnung mit Balkon');
    expect(reply).toContain('morgen');
    expect(reply).toContain('finalen Bestätigung');
  });

  it('multi-intent with explicit booking and time confirms directly', () => {
    const reply = runMultiIntentConversation('wohnung im 7ten und termin morgen?');

    expect(reply).toContain('Zusammenfassung');
    expect(reply).toContain('3-Zimmer Altbauwohnung mit Balkon');
    expect(reply).toContain('morgen');
    expect(reply).toContain('finalen Bestätigung');
  });

  it('multi-intent with filters and booking intent offers one clear next step', () => {
    const reply = runMultiIntentConversation('unter 1200 und wann kann ich besichtigen?');

    expect(reply).toContain('Die günstigste passende Immobilie ist:');
    expect(reply).toContain('3-Zimmer Altbauwohnung mit Balkon');
    expect(reply).toContain('Besichtigungen sind möglich. Wann passt es Ihnen für die Besichtigung?');
  });
});
