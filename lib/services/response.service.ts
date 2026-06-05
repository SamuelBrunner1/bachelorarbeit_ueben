import { appendConversationTurn, getRecentConversationMessages, type ConversationMessage, type ConversationState, updateConversationState } from "@/lib/services/conversation.service";
import { analyzeMessage } from "@/lib/services/intent.service";
import { buildKnowledgeContext, getAvailableCapabilities, getKnowledgeSnippet, KNOWLEDGE_TOPIC } from "@/lib/services/knowledge.service";
import { generateFitnessReply, isAcceptableLlmReply } from "@/lib/services/llm.service";

function formatReply(label: string, content: string): string {
  return `${label}\n\n${content.trim()}`;
}

function getSmalltalkReply(): string {
  const replies = [
    "Mir geht's gut, danke! Ich bin Samy vom Kundenservice — wie kann ich dir helfen?",
    "Alles bestens, und bei dir? Ich bin Samy, dein Ansprechpartner fürs Studio 😊",
    "Danke der Nachfrage — ich bin bereit zu helfen! Was möchtest du wissen?",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function getCasualReply(): string {
  const replies = [
    "Haha 😄 alles gut – was möchtest du wissen?",
    "Alles entspannt 😄 Wobei kann ich dir helfen?",
    "Alles gut 👍 Was interessiert dich – Training, Kurse oder Preise?",
    "Haha 😄 alles klar – was möchtest du wissen?",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function buildFallbackReply(): string {
  const replies = [
    "Ich helfe dir am besten bei Preisen, Kursen, Sauna, Mitgliedschaften oder Probetraining.",
    "Wenn es um unser Studio geht, kann ich dir direkt zu Preisen, Training oder Kursen antworten.",
    "Ich bin für Fitness-Themen da: Mitgliedschaften, Kurse, Training, Sauna oder Probetraining.",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function buildOffTopicReply(): string {
  return buildFallbackReply();
}

function buildInterestReply(): string {
  return "Sehr gerne! Du kannst jederzeit ohne Anmeldung für ein Probetraining vorbeikommen. Wenn du möchtest, kann ich dir vorab noch etwas zum Training oder zu unseren Angeboten erklären.";
}

function buildCoachReply(message: string): string | null {
  const normalized = message.toLowerCase();

  if (/abnehmen|fett verlieren|weight loss/.test(normalized)) {
    return "Wenn dein Ziel Abnehmen ist, ist eine Mischung aus regelmäßigem Training, etwas Cardio und einer passenden Mitgliedschaft sinnvoll. Für einen einfachen Start eignet sich Basic, und mit Personal Training bekommst du zusätzlich eine klare Begleitung.";
  }

  if (/muskeln|muskelaufbau|stärker werden/.test(normalized)) {
    return "Für Muskelaufbau brauchst du vor allem einen guten Trainingsplan, genug Kontinuität und die passenden Geräte. Dafür eignen sich unser Trainingsbereich und auf Wunsch auch Personal Training besonders gut.";
  }

  if (/anfänger|einsteiger|beginner/.test(normalized)) {
    return "Als Anfänger ist ein unkomplizierter Start am besten: kostenloses Probetraining, kurze Einweisung und dann schauen, welche Mitgliedschaft zu dir passt. Wenn du magst, kann ich dir die passende Option direkt nennen.";
  }

  return null;
}

function buildStudioInfoReply(label: string, content: string): string {
  return formatReply(label, content);
}

function buildBookingSummary(selectedProperty: string, selectedTime: string): string {
  return `Perfekt, hier die Zusammenfassung:\n\n• Angebot: ${selectedProperty}\n• Termin: ${selectedTime}\n\nIch habe den Termin für dich vorgemerkt. Eine Bestätigungsmail folgt in Kürze.`;
}

function appendReply(sessionId: string | undefined, userMessage: string, reply: string, patch?: Partial<ConversationState>) {
  if (!sessionId) return;

  if (patch) {
    updateConversationState(sessionId, patch);
  }

  appendConversationTurn(sessionId, userMessage, reply);
}

function extractTime(message: string): string | null {
  const explicit = message.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  if (explicit) return explicit[0];

  const normalized = message.toLowerCase();
  const patterns = [
    { phrase: "morgen vormittag", value: "morgen Vormittag" },
    { phrase: "morgen nachmittag", value: "morgen Nachmittag" },
    { phrase: "morgen abend", value: "morgen Abend" },
    { phrase: "übermorgen", value: "übermorgen" },
    { phrase: "uebermorgen", value: "übermorgen" },
    { phrase: "morgen", value: "morgen" },
    { phrase: "vormittag", value: "Vormittag" },
    { phrase: "nachmittag", value: "Nachmittag" },
    { phrase: "abend", value: "Abend" },
    { phrase: "heute", value: "heute" },
  ];

  const match = patterns.find((entry) => normalized.includes(entry.phrase));
  return match ? match.value : null;
}

function isPersonalTrainingQuestion(message: string): boolean {
  return /personal training|trainer|coach/i.test(message);
}

function isWalkInQuestion(message: string): boolean {
  return /einfach kommen|vorbeikommen|ohne anmeldung/i.test(message);
}

function resolveBookingFlow(message: string, state?: ConversationState) {
  const offer = state?.selectedProperty || null;
  const time = extractTime(message) || state?.selectedTime || null;

  if (offer && time) {
    return {
      reply: buildBookingSummary(offer, time),
      nextState: {
        isBooking: false,
        selectedProperty: offer,
        selectedTime: time,
        lastIntent: "booking_completed",
      } as Partial<ConversationState>,
    };
  }

  if (offer && !time) {
    return {
      reply: `Perfekt. Für das Angebot "${offer}" – wann passt es dir?`,
      nextState: {
        isBooking: true,
        selectedProperty: offer,
        lastIntent: "booking_waiting_for_time",
      } as Partial<ConversationState>,
    };
  }

  if (!offer && time) {
    return {
      reply: "Für welches Angebot möchtest du den Termin eintragen?",
      nextState: {
        isBooking: true,
        selectedTime: time,
        lastIntent: "booking_waiting_for_property",
      } as Partial<ConversationState>,
    };
  }

  return {
    reply: "Für welchen Termin möchtest du dich vormerken?",
    nextState: {
      isBooking: true,
      lastIntent: "booking_started",
    } as Partial<ConversationState>,
  };
}

async function getDirectReply(
  message: string,
  sessionId: string | undefined,
  state: ConversationState | undefined
): Promise<string | null> {
  const analysis = analyzeMessage(message, state);
  const { flags } = analysis;

  // Follow-up resolution: short replies referring to last question/answer
  if (
    (flags.followUpYesNo || flags.followUpClarify || flags.followUpWhy || flags.followUpHow || flags.followUpWhen || flags.followUpWhere || flags.followUpPrice) &&
    (state?.lastIntent || state?.lastTopic || state?.lastEntity)
  ) {
    // Simple deterministic follow-ups first
    const lastTopic = state?.lastTopic || "";
    const lastEntity = state?.lastEntity || "";

    if (flags.followUpYesNo) {
      // Common known topics
      if (/yoga/i.test(String(lastTopic)) || /yoga/i.test(String(lastEntity))) {
        const reply = "Ja 😊, wir bieten Yoga-Kurse an.";
        appendReply(sessionId, message, reply, { lastIntent: "courses_info", lastTopic: "YOGA", lastEntity: "Yoga" });
        return reply;
      }

      if (/sauna/i.test(String(lastTopic)) || /sauna/i.test(String(lastEntity))) {
        const reply = "Ja, Sauna ist in manchen Tarifen enthalten. Bei Premium ist die Sauna inklusive.";
        appendReply(sessionId, message, reply, { lastIntent: "sauna_info", lastTopic: "SAUNA", lastEntity: "Sauna" });
        return reply;
      }

      if (state?.lastIntent === "price_info" && /premium/i.test(String(lastEntity))) {
        const reply = "Ja, Sauna ist im Premium-Tarif enthalten.";
        appendReply(sessionId, message, reply, { lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: state?.lastEntity });
        return reply;
      }

      if (state?.lastIntent === "courses_info") {
        const reply = "Ja, genau — das bieten wir an.";
        appendReply(sessionId, message, reply, { lastIntent: "courses_info" });
        return reply;
      }

      // fallback to short affirmative
      if (flags.yes) {
        const reply = "Ja, das stimmt 😊";
        appendReply(sessionId, message, reply);
        return reply;
      }

      if (normalizeFollowUpNegation(message)) {
        const reply = "Nein — so ist das nicht, lass mich kurz erklären:";
        appendReply(sessionId, message, reply);
        return reply;
      }
    }

    // Price follow-ups like "Mit Sauna?"
    if (flags.followUpPrice) {
      if (state?.lastIntent === "price_info" && /premium/i.test(String(lastEntity))) {
        const reply = "Ja, der Premium-Tarif enthält Sauna.";
        appendReply(sessionId, message, reply, { lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: state?.lastEntity });
        return reply;
      }
    }

    // For why/how/when/where: delegate to LLM with context if available
    try {
      const recent = state ? getRecentConversationMessages(sessionId) : [];
      const analysisForLlm = analysis; // reuse
      const knowledgeContext = await buildKnowledgeContext(message, analysisForLlm, recent);
      const llmReply = await generateFitnessReply(message, knowledgeContext, recent);
      if (isAcceptableLlmReply(llmReply)) {
        appendReply(sessionId, message, llmReply);
        return llmReply;
      }
    } catch (e) {
      // ignore and fallthrough
    }
  }

  if (flags.identity) {
    const reply = "Ich bin Samy, der digitale Assistent deines Fitnessstudios und helfe dir gerne bei Fragen rund um Training, Mitgliedschaften und Probetrainings.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "identity" });
    return reply;
  }

  if (flags.capability) {
    const reply = `Ich helfe dir gerne bei allem rund ums Fitnessstudio – zum Beispiel bei ${getAvailableCapabilities().join(", ")}.`;
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.greeting) {
    const reply = "Hallo! Wie kann ich dir bei Fitness, Preisen oder einem Probetraining helfen?";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.course && !flags.hasCoursePriceCombo && !flags.hasYogaWhenCombo) {
    const reply = formatReply("Unsere Kurse im Überblick:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.COURSES));
    const entity = /yoga/i.test(message) ? "Yoga" : undefined;
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "courses_info", lastTopic: entity ? "YOGA" : "COURSES", lastEntity: entity });
    return reply;
  }

  if (flags.hasCoursePriceCombo) {
    const reply = "Wir bieten Kurse wie Yoga, HIIT und Spinning an. Die Mitgliedschaften starten ab 29€ pro Monat.";
    appendReply(sessionId, message, reply, { lastIntent: "courses_info", lastTopic: "COURSES" });
    return reply;
  }

  if (flags.hasPriceTimeCombo) {
    const reply = "Unsere Mitgliedschaften starten ab 29€ pro Monat. Du kannst jederzeit ohne Anmeldung vorbeikommen und direkt starten 😊";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.hasYogaWhenCombo) {
    const reply = "Wir bieten Yoga-Kurse an. Wir haben täglich von 06:00 bis 22:00 Uhr geöffnet.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "courses_info", lastTopic: "YOGA", lastEntity: "Yoga" });
    return reply;
  }

  if (flags.openingHours && !flags.hasYogaWhenCombo) {
    const reply = "Wir haben Montag bis Sonntag von 06:00 bis 22:00 Uhr geöffnet. Am Wochenende also ganz normal 😊";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (analysis.flags.process) {
    const reply = "Du kannst einfach vorbeikommen, dich kurz anmelden und direkt starten. Ein Trainer hilft dir am Anfang gerne.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (isPersonalTrainingQuestion(message)) {
    const reply = formatReply("Ja, wir bieten auch Personal Training an.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.TRAINERS));
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (isWalkInQuestion(message)) {
    const reply = buildInterestReply();
    appendReply(sessionId, message, reply, { isLead: true, isBooking: true, lastIntent: "walk_in" });
    return reply;
  }

  if (flags.sauna) {
    const reply = await getKnowledgeSnippet(KNOWLEDGE_TOPIC.SAUNA);
    appendReply(sessionId, message, reply);
    return reply;
  }

  const coachReply = buildCoachReply(message);
  if (coachReply) {
    appendReply(sessionId, message, coachReply, { lastIntent: "coach_advice" });
    return coachReply;
  }

  if (flags.looseTime) {
    const reply = "Du kannst jederzeit während unserer Öffnungszeiten vorbeikommen 😊 Wir haben täglich von 06:00 bis 22:00 Uhr geöffnet.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.casual) {
    const reply = getCasualReply();
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.cheap) {
    const reply = "Unsere günstigste Mitgliedschaft ist:\n\n• Basic – 29€ pro Monat  \n\nDu kannst auch jederzeit kostenlos ein Probetraining machen und dir alles anschauen.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: "Basic" });
    return reply;
  }

  if (flags.smalltalk && flags.isShortMessage) {
    const reply = getSmalltalkReply();
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.probetraining) {
    const reply = buildInterestReply();
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "probetraining_info" });
    return reply;
  }

  if (flags.interest && !state?.isBooking) {
    const reply = buildInterestReply();
    appendReply(sessionId, message, reply, { isLead: true, isBooking: true, lastIntent: "interest" });
    return reply;
  }

  if (analysis.flags.info) {
    if (/mitgliedschaft|mitgliedschaften/i.test(message)) {
      const reply = buildStudioInfoReply("Hier sind unsere Mitgliedschaften:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.MEMBERSHIP));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_info", lastTopic: "MEMBERSHIP" });
      return reply;
    }

    if (/preise|kosten|kostet|wie teuer|was kostet/i.test(message)) {
      const reply = formatReply("Hier sind unsere Mitgliedschaften:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PRICES));
      const ent = /premium/i.test(message) ? "Premium" : /basic/i.test(message) ? "Basic" : undefined;
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: ent });
      return reply;
    }

    if (/öffnungszeiten|oeffnungszeiten|wann habt ihr offen/i.test(message)) {
      const reply = await getKnowledgeSnippet(KNOWLEDGE_TOPIC.FAQ);
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/kurse|yoga|hiit|spinning|pilates/i.test(message)) {
      const reply = formatReply("Unsere Kurse im Überblick:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.COURSES));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/standort|wo/i.test(message)) {
      const reply = buildStudioInfoReply("Standort:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.LOCATION));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/parkplatz|parken/i.test(message)) {
      const reply = buildStudioInfoReply("Parken:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PARKING));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/duschen|dusche/i.test(message)) {
      const reply = buildStudioInfoReply("Duschen:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.SHOWERS));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/schließfach|schliessfach|locker/i.test(message)) {
      const reply = buildStudioInfoReply("Schließfächer:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.LOCKERS));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/geräte|equipment|maschinen|freihantel|cardio/i.test(message)) {
      const reply = buildStudioInfoReply("Geräte und Bereiche:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.EQUIPMENT));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/personal training/i.test(message)) {
      const reply = buildStudioInfoReply("Ja, wir bieten auch Personal Training an.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PERSONAL_TRAINING));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    const reply = "Gerne helfe ich dir mit Informationen zu Öffnungszeiten, Preisen, Kursen oder dem Standort weiter.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
    return reply;
  }

  if (state?.isBooking && !flags.booking && !flags.info) {
    updateConversationState(sessionId || "", { isBooking: false });
  }

  if (flags.booking || (state?.isBooking && flags.booking) || (state?.isBooking && flags.yes)) {
    const bookingState = resolveBookingFlow(message, state);
    appendReply(sessionId, message, bookingState.reply, bookingState.nextState);
    return bookingState.reply;
  }

  if (/günstigste|billigste|am günstigsten|am billigsten/.test(message.toLowerCase())) {
    const reply = "Unsere günstigste Mitgliedschaft ist Basic für 29€ pro Monat. Wenn du willst, erkläre ich dir auch den Unterschied zu Advanced und Premium.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_lowest" });
    return reply;
  }

  if (/teuerste|am teuersten|höchster preis|höchsten preis/.test(message.toLowerCase())) {
    const reply = "Unsere Premium-Mitgliedschaft liegt bei 49€ pro Monat und enthält Kurse, Sauna und flexible Check-ins.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_highest" });
    return reply;
  }

  return null;
}

export async function resolveStudioReply(options: {
  message: string;
  sessionId?: string;
  state?: ConversationState;
  recentMessages?: ConversationMessage[];
}): Promise<string> {
  const { message, sessionId, state, recentMessages = [] } = options;
  const directReply = await getDirectReply(message, sessionId, state);

  if (directReply) {
    return directReply;
  }

  const analysis = analyzeMessage(message, state);
  // debug: log analysis for tricky queries during tests
  // eslint-disable-next-line no-console
  // console.log("[resolveStudioReply] analysis:", analysis);
  const knowledgeContext = await buildKnowledgeContext(message, analysis, recentMessages);

  // Safety fallback: if user explicitly asks about prices/memberships, return prices snippet
  if (/preise|kosten|kostet|wie teuer|premium|basic|mitgliedschaft/i.test(message)) {
    const reply = formatReply("Hier sind unsere Mitgliedschaften:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PRICES));
    if (sessionId) {
      updateConversationState(sessionId, { lastIntent: "price_info", lastTopic: "MEMBERSHIP" });
      appendConversationTurn(sessionId, message, reply);
    }
    return reply;
  }

  if (!analysis.flags.fitnessTopic && !knowledgeContext) {
    const reply = buildOffTopicReply();
    appendReply(sessionId, message, reply);
    return reply;
  }

  const llmReply = await generateFitnessReply(message, knowledgeContext, recentMessages);
  const reply = isAcceptableLlmReply(llmReply) ? llmReply : buildFallbackReply();

  if (sessionId) {
    updateConversationState(sessionId, { lastIntent: "knowledge_reply" });
    appendConversationTurn(sessionId, message, reply);
  }

  return reply;
}

function normalizeFollowUpNegation(message: string): boolean {
  const n = message.toLowerCase().trim();
  return /^(nein|auf keinen fall|ne|nee|nicht)$/.test(n);
}