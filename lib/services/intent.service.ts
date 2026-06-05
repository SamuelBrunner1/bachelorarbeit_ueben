export const INTENT = {
  PRICE: "PRICE",
  COURSES: "COURSES",
  OPENING_HOURS: "OPENING_HOURS",
  MEMBERSHIP: "MEMBERSHIP",
  TRIAL_TRAINING: "TRIAL_TRAINING",
  EQUIPMENT: "EQUIPMENT",
  TRAINERS: "TRAINERS",
  MUSCLE_BUILDING: "MUSCLE_BUILDING",
  WEIGHT_LOSS: "WEIGHT_LOSS",
  CONTACT: "CONTACT",
  LOCATION: "LOCATION",
  SAUNA: "SAUNA",
  FAQ: "FAQ",
} as const;

export type IntentName = (typeof INTENT)[keyof typeof INTENT];

export type IntentFlags = {
  identity: boolean;
  capability: boolean;
  greeting: boolean;
  course: boolean;
  price: boolean;
  openingHours: boolean;
  process: boolean;
  sauna: boolean;
  looseTime: boolean;
  casual: boolean;
  cheap: boolean;
  smalltalk: boolean;
  info: boolean;
  walkIn: boolean;
  interest: boolean;
  probetraining: boolean;
  booking: boolean;
  yes: boolean;
  fitnessTopic: boolean;
  hasCoursePriceCombo: boolean;
  hasYogaWhenCombo: boolean;
  hasPriceTimeCombo: boolean;
  isShortMessage: boolean;
  requestedTime: string | null;
  muscleBuilding: boolean;
  weightLoss: boolean;
  equipment: boolean;
  trainers: boolean;
  contact: boolean;
  location: boolean;
  followUpYesNo: boolean;
  followUpClarify: boolean;
  followUpWhy: boolean;
  followUpHow: boolean;
  followUpWhen: boolean;
  followUpWhere: boolean;
  followUpPrice: boolean;
};

export type IntentAnalysis = {
  normalizedMessage: string;
  intents: IntentName[];
  flags: IntentFlags;
};

function normalizeText(value: string): string {
  // apply common typo corrections first
  const corrected = correctTypos(value);
  return corrected.toLowerCase().replace(/[^a-z0-9äöüß\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function correctTypos(value: string): string {
  const map: Record<string, string> = {
    joga: "yoga",
    pilatese: "pilates",
    mitgliedschafft: "mitgliedschaft",
    probetraning: "probetraining",
    fitnesstudio: "fitnessstudio",
    "wie viel": "wieviel",
  };

  let out = value;
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(k, "gi");
    out = out.replace(re, v);
  }
  return out;
}

function containsAny(message: string, phrases: string[]): boolean {
  const normalizedMessage = normalizeText(message);
  return phrases.some((phrase) => normalizedMessage.includes(normalizeText(phrase)));
}

function isGreetingOnly(message: string): boolean {
  return ["hallo", "hi", "servus", "hey", "guten tag"].includes(normalizeText(message));
}

function isIdentityQuestion(message: string): boolean {
  return containsAny(message, ["wer bist du", "wer sind sie", "was bist du", "was ist dein name", "wie heißt du", "wo bist du"]);
}

function isCapabilityQuestion(message: string): boolean {
  return containsAny(message, ["was kannst du", "was kannst du machen", "wie kannst du helfen", "wobei kannst du helfen"]);
}

function isCourseQuestion(message: string): boolean {
  return containsAny(message, ["kurs", "kurse", "yoga", "joga", "hiit", "spinning", "pilates"]);
}

function isOpeningHoursQuestion(message: string): boolean {
  return containsAny(message, ["wann offen", "öffnungszeiten", "wochenende", "geöffnet", "offen"]);
}

function isProcessQuestion(message: string): boolean {
  return containsAny(message, ["wie läuft das", "wie funktioniert", "ablauf", "wie geht das"]);
}

function isSaunaQuestion(message: string): boolean {
  return message.includes("sauna");
}

function isLooseTimeMessage(message: string): boolean {
  return ["morgen", "heute", "übermorgen", "uebermorgen"].includes(normalizeText(message));
}

function isCasualMessage(message: string): boolean {
  return containsAny(message, ["bro", "bruder", "digga", "hä", "lol", "wtf", "yo", "ey", "aha", "ok", "okay"]);
}

function isCheapRequest(message: string): boolean {
  return containsAny(message, ["günstig", "billig", "unter", "preiswert", "wenig geld"]);
}

function isInfoQuestion(message: string): boolean {
  return containsAny(message, [
    "öffnungszeiten",
    "oeffnungszeiten",
    "preise",
    "kosten",
    "mitgliedschaft",
    "mitgliedschaften",
    "kurse",
    "standort",
    "personal training",
    "wo",
    "wann habt ihr offen",
  ]);
}

function isWalkInQuestion(message: string): boolean {
  return containsAny(message, ["einfach kommen", "vorbeikommen", "ohne anmeldung"]);
}

function isInterestIntent(message: string): boolean {
  return containsAny(message, ["interesse", "interessiert", "vormerken", "probetraining", "anmeldung", "mitmachen", "einsteigen"]);
}

function isProbetrainingRequest(message: string): boolean {
  return containsAny(message, ["ich möchte ein probetraining", "ich will ein probetraining", "probetraining", "vorbeikommen", "kann ich vorbeikommen"]);
}

function isBookingIntent(message: string): boolean {
  return containsAny(message, ["termin", "buchen"]);
}

function isYesIntent(message: string): boolean {
  return ["ja", "ja bitte", "gerne", "ok", "okay", "bitte", "klar"].includes(normalizeText(message));
}

function isFollowUpYesNo(message: string): boolean {
  const normalized = normalizeText(message);
  return ["ja", "nein", "ja oder nein", "oder ja oder nein"].some((p) => normalized === p || normalized.includes(p));
}

function isFollowUpClarify(message: string): boolean {
  const normalized = normalizeText(message);
  return ["echt", "sicher", "wirklich", "wirklich?", "sicher?"].some((p) => normalized.includes(p));
}

function isFollowUpWhy(message: string): boolean {
  return normalizeText(message).includes("warum");
}

function isFollowUpHow(message: string): boolean {
  return normalizeText(message).startsWith("wie") || normalizeText(message).includes("wie ");
}

function isFollowUpWhen(message: string): boolean {
  return normalizeText(message).includes("wann");
}

function isFollowUpWhere(message: string): boolean {
  return normalizeText(message).includes("wo") || normalizeText(message).includes("wohin");
}

function isFollowUpPrice(message: string): boolean {
  const n = normalizeText(message);
  return n.includes("wie viel") || n.includes("wieviel") || n.includes("wie teuer") || n.includes("mit sauna");
}

function isSmalltalkMessage(message: string): boolean {
  return containsAny(message, ["wie gehts", "wie geht es", "alles gut", "was geht", "na", "hi", "hallo", "hey"]);
}

function isFitnessTopic(message: string): boolean {
  const m = message.toLowerCase();

  return [
    "preis",
    "kost",
    "mitglied",
    "abo",
    "tarif",
    "gebühr",
    "training",
    "trainieren",
    "kurs",
    "kurse",
    "yoga",
    "hiit",
    "fitness",
    "studio",
    "probetraining",
    "anmelden",
    "anmeldung",
    "mitglied werden",
    "beitreten",
    "wann",
    "zeit",
    "uhr",
    "offen",
    "geöffnet",
    "öffnung",
    "öffnet",
    "wo",
    "standort",
    "adresse",
    "günstig",
    "billig",
    "teuer",
    "unter",
    "angebot",
    "rabatt",
    "student",
    "trainer",
    "personal training",
    "geräte",
    "equipment",
    "dusche",
    "schließfach",
    "schliessfach",
    "parkplatz",
    "abnehmen",
    "muskelaufbau",
    "sauna",
  ].some((k) => m.includes(k));
}

function extractTime(message: string): string | null {
  const explicit = message.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  if (explicit) return explicit[0];

  const normalized = normalizeText(message);
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

export function analyzeMessage(message: string): IntentAnalysis {
  const normalizedMessage = normalizeText(message);
  const requestedTime = extractTime(message);
  const identity = isIdentityQuestion(message);
  const capability = isCapabilityQuestion(message);
  const greeting = isGreetingOnly(message);
  const course = isCourseQuestion(message);
  const price = containsAny(normalizedMessage, ["preis", "preise", "kosten", "kostet", "wie teuer", "was kostet"]);
  const openingHours = isOpeningHoursQuestion(message);
  const process = isProcessQuestion(message);
  const sauna = isSaunaQuestion(message);
  const looseTime = isLooseTimeMessage(message);
  const casual = isCasualMessage(message);
  const cheap = isCheapRequest(message);
  const smalltalk = isSmalltalkMessage(message);
  const info = isInfoQuestion(message);
  const walkIn = isWalkInQuestion(message);
  const interest = isInterestIntent(message);
  const probetraining = isProbetrainingRequest(message);
  const booking = isBookingIntent(message);
  const yes = isYesIntent(message);
  const muscleBuilding = containsAny(normalizedMessage, ["muskelaufbau", "muskeln aufbauen", "stärker werden", "stärke aufbauen"]);
  const weightLoss = containsAny(normalizedMessage, ["abnehmen", "fett verlieren", "weight loss", "kalorien"]);
  const equipment = containsAny(normalizedMessage, ["geräte", "equipment", "maschinen", "freihantel", "cardio"]);
  const trainers = containsAny(normalizedMessage, ["trainer", "coach", "personal training", "pt"]);
  const contact = containsAny(normalizedMessage, ["kontakt", "telefon", "mail", "email", "erreichen"]);
  const location = containsAny(normalizedMessage, ["standort", "adresse", "anreise", "parkplatz", "wo seid ihr"]);

  const followUpYesNo = isFollowUpYesNo(message);
  const followUpClarify = isFollowUpClarify(message);
  const followUpWhy = isFollowUpWhy(message);
  const followUpHow = isFollowUpHow(message);
  const followUpWhen = isFollowUpWhen(message);
  const followUpWhere = isFollowUpWhere(message);
  const followUpPrice = isFollowUpPrice(message);

  const hasCoursePriceCombo =
    (normalizedMessage.includes("yoga") || normalizedMessage.includes("kurs")) &&
    (normalizedMessage.includes("kost") || normalizedMessage.includes("teuer") || normalizedMessage.includes("preis"));
  const hasYogaWhenCombo = normalizedMessage.includes("yoga") && normalizedMessage.includes("wann");
  const hasPriceTimeCombo = normalizedMessage.includes("kost") && (normalizedMessage.includes("morgen") || normalizedMessage.includes("kommen"));
  const isShortMessage = normalizedMessage.length < 20;
  const fitnessTopic = isFitnessTopic(message);
  const intents: IntentName[] = [];

  if (identity || capability || greeting || process || info) intents.push(INTENT.FAQ);
  if (course) intents.push(INTENT.COURSES);
  if (price) intents.push(INTENT.PRICE);
  if (openingHours) intents.push(INTENT.OPENING_HOURS);
  if (sauna) intents.push(INTENT.SAUNA);
  if (cheap) intents.push(INTENT.PRICE);
  if (interest || probetraining || booking) intents.push(INTENT.TRIAL_TRAINING);
  if (muscleBuilding) intents.push(INTENT.MUSCLE_BUILDING);
  if (weightLoss) intents.push(INTENT.WEIGHT_LOSS);
  if (equipment) intents.push(INTENT.EQUIPMENT);
  if (trainers) intents.push(INTENT.TRAINERS);
  if (contact) intents.push(INTENT.CONTACT);
  if (location) intents.push(INTENT.LOCATION);

  if (!intents.length) {
    intents.push(INTENT.FAQ);
  }

  return {
    normalizedMessage,
    intents,
    flags: {
      identity,
      capability,
      greeting,
      course,
      price,
      openingHours,
      process,
      sauna,
      looseTime,
      casual,
      cheap,
      smalltalk,
      info,
      walkIn,
      interest,
      probetraining,
      booking,
      yes,
      fitnessTopic,
      hasCoursePriceCombo,
      hasYogaWhenCombo,
      hasPriceTimeCombo,
      isShortMessage,
      requestedTime,
      muscleBuilding,
      weightLoss,
      equipment,
      trainers,
      contact,
      location,
      followUpYesNo,
      followUpClarify,
      followUpWhy,
      followUpHow,
      followUpWhen,
      followUpWhere,
      followUpPrice,
    },
  };
}