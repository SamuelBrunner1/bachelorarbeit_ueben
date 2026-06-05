import { readFile } from "fs/promises";
import path from "path";
import fitness from "@/data/fitness.json";
import faqs from "@/data/faqs.json";
import type { ConversationMessage } from "@/lib/services/conversation.service";
import { INTENT, type IntentAnalysis, type IntentName } from "@/lib/services/intent.service";

export const KNOWLEDGE_TOPIC = {
  PRICES: "preise",
  MEMBERSHIP: "membership",
  COURSES: "kurse",
  TRAINERS: "trainer",
  PERSONAL_TRAINING: "personal-training",
  SAUNA: "sauna",
  LOCATION: "location",
  PARKING: "parking",
  SHOWERS: "showers",
  LOCKERS: "lockers",
  FAQ: "faq",
  AGB: "agb",
  HOUSE_RULES: "hausordnung",
  EQUIPMENT: "equipment",
} as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPIC)[keyof typeof KNOWLEDGE_TOPIC];

type KnowledgeDocument = {
  topic: KnowledgeTopic | "fitness-data" | "faq-data";
  title: string;
  content: string;
};

const topicFileMap: Record<KnowledgeTopic, string> = {
  [KNOWLEDGE_TOPIC.PRICES]: "preise.md",
  [KNOWLEDGE_TOPIC.MEMBERSHIP]: "membership.md",
  [KNOWLEDGE_TOPIC.COURSES]: "kurse.md",
  [KNOWLEDGE_TOPIC.TRAINERS]: "trainer.md",
  [KNOWLEDGE_TOPIC.PERSONAL_TRAINING]: "personal-training.md",
  [KNOWLEDGE_TOPIC.SAUNA]: "sauna.md",
  [KNOWLEDGE_TOPIC.LOCATION]: "location.md",
  [KNOWLEDGE_TOPIC.PARKING]: "parking.md",
  [KNOWLEDGE_TOPIC.SHOWERS]: "showers.md",
  [KNOWLEDGE_TOPIC.LOCKERS]: "lockers.md",
  [KNOWLEDGE_TOPIC.FAQ]: "faq.md",
  [KNOWLEDGE_TOPIC.AGB]: "agb.md",
  [KNOWLEDGE_TOPIC.HOUSE_RULES]: "hausordnung.md",
  [KNOWLEDGE_TOPIC.EQUIPMENT]: "equipment.md",
};

let knowledgeCache: Promise<KnowledgeDocument[]> | null = null;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9äöüß\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function tokenize(message: string): string[] {
  return Array.from(
    new Set(
      normalizeText(message)
        .split(" ")
        .map((part) => part.trim())
        .filter((part) => part.length > 2)
    )
  );
}

function extractHeading(content: string): string {
  const firstHeading = content.split("\n").find((line) => line.trim().startsWith("#"));
  return firstHeading ? firstHeading.replace(/^#+\s*/, "").trim() : "Wissensbasis";
}

function stripMarkdown(content: string): string {
  return content
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readMarkdownDocument(topic: KnowledgeTopic): Promise<KnowledgeDocument> {
  const filePath = path.join(process.cwd(), "knowledge", topicFileMap[topic]);
  const content = await readFile(filePath, "utf8");

  return {
    topic,
    title: extractHeading(content),
    content: content.trim(),
  };
}

async function loadKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const markdownDocuments = await Promise.all(Object.values(KNOWLEDGE_TOPIC).map((topic) => readMarkdownDocument(topic)));

  const fitnessDocuments: KnowledgeDocument[] = (fitness as Array<{ id: string; title: string; price: string; location: string; description: string; available: string }>).map(
    (entry) => ({
      topic: "fitness-data",
      title: entry.title,
      content: [
        `Titel: ${entry.title}`,
        `Preis: ${entry.price}`,
        `Standort: ${entry.location}`,
        `Beschreibung: ${entry.description}`,
        `Verfügbar: ${entry.available}`,
      ].join("\n"),
    })
  );

  const faqDocuments: KnowledgeDocument[] = (faqs as Array<{ question: string; answer: string; tags?: string[] }>).map((entry) => ({
    topic: "faq-data",
    title: entry.question,
    content: [
      `Frage: ${entry.question}`,
      `Antwort: ${entry.answer}`,
      `Tags: ${(entry.tags || []).join(", ")}`,
    ].join("\n"),
  }));

  return [...markdownDocuments, ...fitnessDocuments, ...faqDocuments];
}

async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  if (!knowledgeCache) {
    knowledgeCache = loadKnowledgeDocuments();
  }

  return knowledgeCache;
}

function scoreDocument(content: string, tokens: string[]): number {
  const normalized = normalizeText(content);
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function getTopicsForIntent(intent: IntentName): KnowledgeTopic[] {
  switch (intent) {
    case INTENT.PRICE:
    case INTENT.MEMBERSHIP:
      return [KNOWLEDGE_TOPIC.MEMBERSHIP, KNOWLEDGE_TOPIC.PRICES, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.COURSES:
      return [KNOWLEDGE_TOPIC.COURSES, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.OPENING_HOURS:
      return [KNOWLEDGE_TOPIC.FAQ];
    case INTENT.TRIAL_TRAINING:
      return [KNOWLEDGE_TOPIC.PERSONAL_TRAINING, KNOWLEDGE_TOPIC.MEMBERSHIP, KNOWLEDGE_TOPIC.PRICES, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.TRAINERS:
    case INTENT.MUSCLE_BUILDING:
    case INTENT.WEIGHT_LOSS:
      return [KNOWLEDGE_TOPIC.TRAINERS, KNOWLEDGE_TOPIC.PERSONAL_TRAINING, KNOWLEDGE_TOPIC.EQUIPMENT, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.EQUIPMENT:
      return [KNOWLEDGE_TOPIC.EQUIPMENT, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.SAUNA:
      return [KNOWLEDGE_TOPIC.SAUNA, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.CONTACT:
    case INTENT.LOCATION:
      return [KNOWLEDGE_TOPIC.LOCATION, KNOWLEDGE_TOPIC.PARKING, KNOWLEDGE_TOPIC.FAQ];
    case INTENT.FAQ:
    default:
      return [KNOWLEDGE_TOPIC.FAQ];
  }
}

export async function getKnowledgeSnippet(topic: KnowledgeTopic): Promise<string> {
  const documents = await getKnowledgeDocuments();
  const document = documents.find((entry) => entry.topic === topic);
  return document ? stripMarkdown(document.content) : "";
}

export async function buildKnowledgeContext(
  message: string,
  analysis: IntentAnalysis,
  recentMessages: ConversationMessage[] = []
): Promise<string> {
  const tokens = tokenize(message);
  const documents = await getKnowledgeDocuments();
  const boostedTopics = analysis.intents.flatMap((intent) => getTopicsForIntent(intent));

  const ranked = documents
    .map((document) => {
      const tokenScore = scoreDocument(document.content, tokens);
      const topicScore = boostedTopics.includes(document.topic as KnowledgeTopic) ? 3 : 0;
      const recentScore = recentMessages.reduce((score, entry) => score + scoreDocument(entry.content, tokens), 0);

      return {
        topic: document.topic,
        title: document.title,
        content: document.content,
        score: tokenScore + topicScore + recentScore,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((entry) => ({
      topic: entry.topic,
      title: entry.title,
      content: stripMarkdown(entry.content),
    }));

  return JSON.stringify(
    {
      query: message,
      intents: analysis.intents,
      recentConversation: recentMessages.slice(-4),
      knowledge: ranked,
    },
    null,
    2
  );
}

export function getAvailableCapabilities(): string[] {
  return [
    "Preise und Mitgliedschaften",
    "Öffnungszeiten und Feiertage",
    "Kurse und Kurszeiten",
    "Probetraining und Anmeldung",
    "Geräte, Freihantelbereich, Cardio, Duschen, Schließfächer und Parkplätze",
    "Personal Training, Muskelaufbau, Abnehmen und Anfängertraining",
  ];
}

export function getPrimaryKnowledgeTopics(analysis: IntentAnalysis): KnowledgeTopic[] {
  const topics = new Set<KnowledgeTopic>();

  for (const intent of analysis.intents) {
    for (const topic of getTopicsForIntent(intent)) {
      topics.add(topic);
    }
  }

  if (!topics.size) {
    topics.add(KNOWLEDGE_TOPIC.FAQ);
  }

  return Array.from(topics);
}