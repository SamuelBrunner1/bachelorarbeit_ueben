import { appendConversationTurn, getRecentConversationMessages, type ConversationMessage, type ConversationState, updateConversationState } from "@/lib/services/conversation.service";
import { analyzeMessage } from "@/lib/services/intent.service";
import { buildKnowledgeContext, getKnowledgeSnippet, KNOWLEDGE_TOPIC } from "@/lib/services/knowledge.service";
import { generateFitnessReply, isAcceptableLlmReply } from "@/lib/services/llm.service";

type ConversationPhase =
  | "Greeting"
  | "NeedDiscovery"
  | "Recommendation"
  | "EmotionalSupport"
  | "PriceDiscussion"
  | "ObjectionHandling"
  | "Booking"
  | "Closing";

function formatReply(label: string, content: string): string {
  return `${label}\n${content.trim()}`;
}

function getSmalltalkReply(): string {
  const replies = [
    "Mir geht's gut, danke! Ich bin Samy vom Studio.",
    "Alles bestens, danke! Ich bin Samy von Fitness Vienna.",
    "Danke der Nachfrage. Ich helfe dir gern weiter.",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function getCasualReply(): string {
  const replies = [
    "Alles gut 😄",
    "Passt 👍",
    "Klar 😊",
    "Alles entspannt.",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function buildFallbackReply(): string {
  const replies = [
    "Klar – ich helfe dir gern bei Preisen, Kursen, Sauna oder einem Probetraining.",
    "Klar, ich antworte dir direkt zu allem rund ums Studio.",
    "Ich helfe dir bei Fitness-Fragen, Mitgliedschaften, Kursen und Sauna.",
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function buildOffTopicReply(): string {
  return buildFallbackReply();
}

function buildInterestReply(): string {
  return "Sehr gerne. Du kannst jederzeit ohne Anmeldung für ein Probetraining vorbeikommen.";
}

function buildCoachReply(message: string): string | null {
  const normalized = message.toLowerCase();

  if (/abnehmen|fett verlieren|weight loss/.test(normalized)) {
    return "Beim Abnehmen helfen regelmäßiges Training, etwas Cardio und ein klarer Startplan. Dafür passt Basic gut. Wenn du mehr Struktur willst, ist Personal Training eine gute Option.";
  }

  if (/muskeln|muskelaufbau|stärker werden/.test(normalized)) {
    return "Für Muskelaufbau brauchst du vor allem einen guten Trainingsplan und die passenden Geräte. Dafür ist unser Trainingsbereich ideal. Auf Wunsch hilft dir auch ein Trainer dabei.";
  }

  if (/anfänger|einsteiger|beginner/.test(normalized)) {
    return "Als Anfänger ist ein unkomplizierter Start am besten: Probetraining, kurze Einweisung und dann schauen, was zu dir passt.";
  }

  return null;
}

function isOpenConsultationStart(message: string): boolean {
  return /ich suche ein fitnessstudio|ich möchte trainieren|ich möchte anfangen|ich bin anfänger|ich möchte abnehmen|ich möchte muskeln aufbauen/i.test(
    message
  );
}

function buildOpenConsultationReply(message: string): string {
  const normalized = message.toLowerCase();

  if (/ich suche ein fitnessstudio|ich möchte trainieren|ich möchte anfangen/.test(normalized)) {
    return "Schön, dass du dich umschaust 😊 Was ist dir am wichtigsten: Muskelaufbau, Abnehmen oder einfach fitter werden?";
  }

  if (/ich bin anfänger/.test(normalized)) {
    return "Kein Problem 😊 Gerade am Anfang ist ein einfacher Einstieg wichtig. Was möchtest du denn erreichen?";
  }

  if (/ich möchte abnehmen/.test(normalized)) {
    return "Gutes Ziel 😊 Dabei helfen ein klarer Trainingsstart und ein Plan, der zu dir passt. Trainierst du schon regelmäßig?";
  }

  if (/ich möchte muskeln aufbauen/.test(normalized)) {
    return "Klingt gut 💪 Dafür sind vor allem ein guter Trainingsplan und passende Geräte wichtig. Trainierst du schon länger?";
  }

  return "Klar 😊 Was ist dir wichtiger: Muskelaufbau, Abnehmen oder einfach fitter werden?";
}

function detectConversationPhase(message: string, state: ConversationState | undefined, flags: ReturnType<typeof analyzeMessage>["flags"]): ConversationPhase {
  const normalized = message.toLowerCase();

  if (/tschüss|tschuess|auf wiedersehen|bis dann|danke dir|perfekt danke/.test(normalized)) {
    return "Closing";
  }

  if (/ich schäme mich|ich trau mich nicht|ich habe angst|ich bin unsicher|peinlich/.test(normalized)) {
    return "EmotionalSupport";
  }

  if (/zu teuer|teuer|29\s*€\s*sind teuer|lohnt sich das|ist mir zu viel/.test(normalized) && state?.lastIntent === "price_info") {
    return "ObjectionHandling";
  }

  if (state?.isBooking || flags.booking || flags.probetraining) {
    return "Booking";
  }

  if (flags.greeting) {
    return "Greeting";
  }

  if (isOpenConsultationStart(message)) {
    return "NeedDiscovery";
  }

  if (flags.price || flags.cheap || /preis|kosten|kostet|mitgliedschaft|premium|basic/.test(normalized)) {
    return "PriceDiscussion";
  }

  if (flags.course || flags.sauna || flags.equipment || flags.trainers || flags.location) {
    return "Recommendation";
  }

  return "NeedDiscovery";
}

function buildPhaseReply(phase: ConversationPhase, message: string): string | null {
  const normalized = message.toLowerCase();

  if (phase === "EmotionalSupport") {
    return "Danke, dass du das so offen sagst. Das ist völlig okay 😊 Wir können ganz entspannt starten. Was würde dir den Einstieg leichter machen?";
  }

  if (phase === "ObjectionHandling") {
    return "Verstehe ich gut. Wichtig ist, dass es sich für dich lohnt. Wenn du magst, schauen wir kurz, was du wirklich nutzen möchtest.";
  }

  if (phase === "Closing") {
    return "Sehr gern. Wenn du später noch Fragen hast, bin ich hier für dich 👍";
  }

  if (phase === "NeedDiscovery" && /ich suche ein fitnessstudio|ich möchte trainieren|ich möchte anfangen/.test(normalized)) {
    return "Schön, dass du dich umschaust 😊 Was ist dir am wichtigsten: Muskelaufbau, Abnehmen oder einfach fitter werden?";
  }

  return null;
}

function buildStudioInfoReply(label: string, content: string): string {
  return formatReply(label, content);
}

function buildBookingSummary(selectedProperty: string, selectedTime: string): string {
  return `Perfekt.\nAngebot: ${selectedProperty}\nTermin: ${selectedTime}\n\nIch habe den Termin vorgemerkt.`;
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
      reply: `Klar. Für ${offer} – wann passt es dir?`,
      nextState: {
        isBooking: true,
        selectedProperty: offer,
        lastIntent: "booking_waiting_for_time",
      } as Partial<ConversationState>,
    };
  }

  if (!offer && time) {
    return {
      reply: "Für welches Angebot soll ich den Termin vormerken?",
      nextState: {
        isBooking: true,
        selectedTime: time,
        lastIntent: "booking_waiting_for_property",
      } as Partial<ConversationState>,
    };
  }

  return {
    reply: "Für welchen Termin soll ich dich vormerken?",
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
  const analysis = analyzeMessage(message);
  const { flags } = analysis;
  const phase = detectConversationPhase(message, state, flags);

  const phaseReply = buildPhaseReply(phase, message);
  if (phaseReply) {
    appendReply(sessionId, message, phaseReply, { conversationPhase: phase, lastIntent: phase.toLowerCase() });
    return phaseReply;
  }

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
        const reply = "Ja 😊, Yoga-Kurse gibt es bei uns.";
        appendReply(sessionId, message, reply, { lastIntent: "courses_info", lastTopic: "YOGA", lastEntity: "Yoga" });
        return reply;
      }

      if (/sauna/i.test(String(lastTopic)) || /sauna/i.test(String(lastEntity))) {
        const reply = "Ja, Sauna ist je nach Tarif dabei. Bei Premium ist sie inklusive.";
        appendReply(sessionId, message, reply, { lastIntent: "sauna_info", lastTopic: "SAUNA", lastEntity: "Sauna" });
        return reply;
      }

      if (state?.lastIntent === "price_info" && /premium/i.test(String(lastEntity))) {
        const reply = "Ja, im Premium-Tarif ist Sauna enthalten.";
        appendReply(sessionId, message, reply, { lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: state?.lastEntity });
        return reply;
      }

      if (state?.lastIntent === "courses_info") {
        const reply = "Ja, genau.";
        appendReply(sessionId, message, reply, { lastIntent: "courses_info" });
        return reply;
      }

      // fallback to short affirmative
      if (flags.yes) {
        const reply = "Ja, genau 😊";
        appendReply(sessionId, message, reply);
        return reply;
      }

      if (normalizeFollowUpNegation(message)) {
        const reply = "Nein, so ist es nicht.";
        appendReply(sessionId, message, reply);
        return reply;
      }
    }

    // Price follow-ups like "Mit Sauna?"
    if (flags.followUpPrice) {
      if (state?.lastIntent === "price_info" && /premium/i.test(String(lastEntity))) {
        const reply = "Ja, Premium enthält Sauna.";
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
    } catch {
      // ignore and fallthrough
    }
  }

  if (flags.identity) {
    const reply = "Ich bin Samy, der digitale Assistent von Fitness Vienna.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "identity", conversationPhase: "Greeting" });
    return reply;
  }

  if (flags.capability) {
    const reply = "Klar – ich helfe dir bei Preisen, Kursen, Sauna, Mitgliedschaften oder Probetraining.";
    appendReply(sessionId, message, reply, { conversationPhase: "Recommendation" });
    return reply;
  }

  if (flags.greeting) {
    const reply = "Hallo 😊";
    appendReply(sessionId, message, reply, { conversationPhase: "Greeting" });
    return reply;
  }

  if (isOpenConsultationStart(message)) {
    const reply = buildOpenConsultationReply(message);
    appendReply(sessionId, message, reply, { lastIntent: "coach_advice", conversationPhase: "NeedDiscovery" });
    return reply;
  }

  if (flags.course && !flags.hasCoursePriceCombo && !flags.hasYogaWhenCombo) {
    const reply = formatReply("Klar – hier sind unsere Kurse:", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.COURSES));
    const entity = /yoga/i.test(message) ? "Yoga" : undefined;
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "courses_info", lastTopic: entity ? "YOGA" : "COURSES", lastEntity: entity });
    return reply;
  }

  if (flags.hasCoursePriceCombo) {
    const reply = "Bei uns gibt es Kurse wie Yoga, HIIT und Spinning. Die Mitgliedschaften starten ab 29€ pro Monat.";
    appendReply(sessionId, message, reply, { lastIntent: "courses_info", lastTopic: "COURSES" });
    return reply;
  }

  if (flags.hasPriceTimeCombo) {
    const reply = "Bei uns starten die Mitgliedschaften ab 29€ pro Monat. Du kannst jederzeit ohne Anmeldung vorbeikommen.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.hasYogaWhenCombo) {
    const reply = "Ja 😊, bei uns gibt es Yoga-Kurse. Täglich von 06:00 bis 22:00 Uhr.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "courses_info", lastTopic: "YOGA", lastEntity: "Yoga" });
    return reply;
  }

  if (flags.openingHours && !flags.hasYogaWhenCombo) {
    const reply = "Ja 😊, bei uns täglich von 06:00 bis 22:00 Uhr.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (analysis.flags.process) {
    const reply = "Klar, du kannst einfach vorbeikommen und direkt starten. Am Anfang hilft dir ein Trainer gern.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (isPersonalTrainingQuestion(message)) {
    const reply = formatReply("Ja, bei uns gibt es auch Personal Training.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.TRAINERS));
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (isWalkInQuestion(message)) {
    const reply = buildInterestReply();
    appendReply(sessionId, message, reply, { isLead: true, isBooking: true, lastIntent: "walk_in", conversationPhase: "Booking" });
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
    const reply = "Klar, du kannst jederzeit während der Öffnungszeiten vorbeikommen. Täglich von 06:00 bis 22:00 Uhr.";
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.casual) {
    const reply = getCasualReply();
    appendReply(sessionId, message, reply);
    return reply;
  }

  if (flags.cheap) {
    const reply = "Basic liegt bei 29€ pro Monat. Ein Probetraining ist jederzeit kostenlos möglich.";
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
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "probetraining_info", conversationPhase: "Booking" });
    return reply;
  }

  if (flags.interest && !state?.isBooking) {
    const reply = buildInterestReply();
    appendReply(sessionId, message, reply, { isLead: true, isBooking: true, lastIntent: "interest", conversationPhase: "NeedDiscovery" });
    return reply;
  }

  if (analysis.flags.info) {
    if (/mitgliedschaft|mitgliedschaften/i.test(message)) {
      const reply = "Klar – bei uns gibt es Basic für 29€, Advanced für 39€ und Premium für 49€ pro Monat.";
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_info", lastTopic: "MEMBERSHIP", conversationPhase: "PriceDiscussion" });
      return reply;
    }

    if (/preise|kosten|kostet|wie teuer|was kostet/i.test(message)) {
      const reply = /premium/i.test(message)
        ? "Premium liegt bei 49€ pro Monat."
        : /basic/i.test(message)
          ? "Basic liegt bei 29€ pro Monat."
          : "Klar – bei uns gibt es Basic für 29€, Advanced für 39€ und Premium für 49€ pro Monat.";
      const ent = /premium/i.test(message) ? "Premium" : /basic/i.test(message) ? "Basic" : undefined;
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_info", lastTopic: "MEMBERSHIP", lastEntity: ent, conversationPhase: "PriceDiscussion" });
      return reply;
    }

    if (/öffnungszeiten|oeffnungszeiten|wann habt ihr offen/i.test(message)) {
      const reply = formatReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.FAQ));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/kurse|yoga|hiit|spinning|pilates/i.test(message)) {
      const reply = formatReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.COURSES));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/standort|wo/i.test(message)) {
      const reply = buildStudioInfoReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.LOCATION));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/parkplatz|parken/i.test(message)) {
      const reply = buildStudioInfoReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PARKING));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/duschen|dusche/i.test(message)) {
      const reply = buildStudioInfoReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.SHOWERS));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/schließfach|schliessfach|locker/i.test(message)) {
      const reply = buildStudioInfoReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.LOCKERS));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/geräte|equipment|maschinen|freihantel|cardio/i.test(message)) {
      const reply = buildStudioInfoReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.EQUIPMENT));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    if (/personal training/i.test(message)) {
      const reply = buildStudioInfoReply("Ja, bei uns gibt es auch Personal Training.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PERSONAL_TRAINING));
      appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
      return reply;
    }

    const reply = "Gerne – ich helfe dir bei Öffnungszeiten, Preisen, Kursen oder dem Standort.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "info_question" });
    return reply;
  }

  if (state?.isBooking && !flags.booking && !flags.info) {
    updateConversationState(sessionId || "", { isBooking: false });
  }

  if (flags.booking || (state?.isBooking && flags.booking) || (state?.isBooking && flags.yes)) {
    const bookingState = resolveBookingFlow(message, state);
    appendReply(sessionId, message, bookingState.reply, { ...bookingState.nextState, conversationPhase: "Booking" });
    return bookingState.reply;
  }

  if (/günstigste|billigste|am günstigsten|am billigsten/.test(message.toLowerCase())) {
    const reply = "Basic liegt bei 29€ pro Monat.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_lowest", conversationPhase: "PriceDiscussion" });
    return reply;
  }

  if (/teuerste|am teuersten|höchster preis|höchsten preis/.test(message.toLowerCase())) {
    const reply = "Premium liegt bei 49€ pro Monat und enthält Kurse sowie Sauna.";
    appendReply(sessionId, message, reply, { isBooking: false, lastIntent: "price_highest", conversationPhase: "PriceDiscussion" });
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

const analysis = analyzeMessage(message);
  const knowledgeContext = await buildKnowledgeContext(message, analysis, recentMessages);

  // Safety fallback: if user explicitly asks about prices/memberships, return prices snippet
  if (/preise|kosten|kostet|wie teuer|premium|basic|mitgliedschaft/i.test(message)) {
    const reply = formatReply("Gerne.", await getKnowledgeSnippet(KNOWLEDGE_TOPIC.PRICES));
    if (sessionId) {
      updateConversationState(sessionId, { lastIntent: "price_info", lastTopic: "MEMBERSHIP", conversationPhase: "PriceDiscussion" });
      appendConversationTurn(sessionId, message, reply);
    }
    return reply;
  }

  if (!analysis.flags.fitnessTopic && !knowledgeContext) {
    const reply = buildOffTopicReply();
    appendReply(sessionId, message, reply, { conversationPhase: "NeedDiscovery" });
    return reply;
  }

  const llmReply = await generateFitnessReply(message, knowledgeContext, recentMessages);
  const reply = isAcceptableLlmReply(llmReply) ? llmReply : buildFallbackReply();

  if (sessionId) {
    updateConversationState(sessionId, { lastIntent: "knowledge_reply", conversationPhase: "Recommendation" });
    appendConversationTurn(sessionId, message, reply);
  }

  return reply;
}

function normalizeFollowUpNegation(message: string): boolean {
  const n = message.toLowerCase().trim();
  return /^(nein|auf keinen fall|ne|nee|nicht)$/.test(n);
}