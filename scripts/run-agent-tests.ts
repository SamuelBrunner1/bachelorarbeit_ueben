import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveStudioReply } from "../lib/services/response.service";

type TestCase = {
  id: number;
  category: string;
  question: string;
};

type TestResult = TestCase & {
  answer: string;
  responseTimeMs: number;
};

function applyEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const equalsIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || process.env[key]) continue;

      let value = trimmed.slice(equalsIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch {
    // ignore missing env file
  }
}

function readTestCases(): TestCase[] {
  const testCasePath = path.resolve(process.cwd(), "data/testcases.json");
  const raw = readFileSync(testCasePath, "utf8");
  return JSON.parse(raw) as TestCase[];
}

function csvEscape(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ");
  if (/[",;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function toCsv(rows: TestResult[]): string {
  const header = ["id", "category", "question", "answer", "responseTimeMs"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push([
      row.id,
      csvEscape(row.category),
      csvEscape(row.question),
      csvEscape(row.answer),
      row.responseTimeMs,
    ].join(","));
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const rootDir = process.cwd();
  applyEnvFile(path.join(rootDir, ".env.local"));

  const testCases = readTestCases();
  const results: TestResult[] = [];
  const totalStart = Date.now();

  console.log(`Anzahl Tests: ${testCases.length}`);

  for (const testCase of testCases) {
    const sessionId = `agent-test-${testCase.id}`;
    const testStart = Date.now();

    console.log(`Aktueller Test: ${testCase.id}/${testCases.length} [${testCase.category}] ${testCase.question}`);

    let answer = "";
    try {
      answer = await resolveStudioReply({
        message: testCase.question,
        sessionId,
        requestId: `agent-test-${testCase.id}`,
      });
    } catch (error) {
      answer = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }

    const responseTimeMs = Date.now() - testStart;
    results.push({ ...testCase, answer, responseTimeMs });

    console.log(`Antwortzeit: ${responseTimeMs} ms`);
  }

  const resultsDir = path.join(rootDir, "results");
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(path.join(resultsDir, "results.csv"), toCsv(results), "utf8");

  console.log(`Gesamtdauer: ${Date.now() - totalStart} ms`);
  console.log(`CSV gespeichert: ${path.join("results", "results.csv")}`);
}

void main();
