import "dotenv/config";
import { ChromaClient } from "chromadb";
import type { IEmbeddingFunction } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
// Note: zod-to-json-schema doesn't fully support zod v4 (empty definitions).
// Using z.toJSONSchema() from zod v4 native instead.

const CHROMA_HOST = process.env.CHROMA_HOST || "localhost";
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || "8100", 10);
const CHROMA_URL = `http://${CHROMA_HOST}:${CHROMA_PORT}`;
const TEST_COLLECTION = "coaching-history-test";
const EMBEDDING_MODEL = "gemini-embedding-001";

console.log("=== VALID-02: ChromaDB + Gemini Pipeline Test ===\n");

// --- Step 1: Check ChromaDB connectivity ---
console.log("--- Step 1: ChromaDB Connectivity ---");

try {
  const resp = await fetch(`${CHROMA_URL}/api/v2/heartbeat`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const heartbeat = await resp.json();
  console.log("ChromaDB heartbeat:", JSON.stringify(heartbeat));
  console.log("ChromaDB is running.\n");
} catch (err) {
  console.error("ERROR: ChromaDB is not reachable at", CHROMA_URL);
  console.error("Start it with: chroma run --path ./chroma-data --port 8100");
  console.error("Then re-run this script.");
  process.exit(1);
}

// --- Step 2: Create client and embedding function ---
console.log("--- Step 2: Initialize Client + Embeddings ---");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY not set in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Custom embedding function using the current @google/genai SDK
// The @chroma-core/google-gemini package bundles an old SDK that doesn't
// support the current embedding model (gemini-embedding-001).
class GeminiEmbeddingFunction implements IEmbeddingFunction {
  name = "GeminiEmbeddingFunction";

  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
      });
      const values = result.embeddings?.[0]?.values;
      if (!values) {
        throw new Error(`No embedding returned for text: "${text.slice(0, 50)}..."`);
      }
      embeddings.push(values);
    }
    return embeddings;
  }
}

const embedder = new GeminiEmbeddingFunction();

// Verify embedding works before proceeding
const testEmbed = await embedder.generate(["test"]);
console.log(`Embedding test: dimension=${testEmbed[0].length} (${EMBEDDING_MODEL})`);

const client = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT });
console.log("ChromaClient created.");
console.log(`GeminiEmbeddingFunction initialized (${EMBEDDING_MODEL}).\n`);

// --- Step 3: Create test collection and add documents ---
console.log("--- Step 3: Add Sample Documents ---");

const collection = await client.getOrCreateCollection({
  name: TEST_COLLECTION,
  embeddingFunction: embedder,
});

const sampleDocs = [
  {
    id: "workout-001",
    document:
      "Workout A: Barbell floor press 135lbs 3x10, inverted rows 4x10 at notch 25, pull-up negatives 3x5 with 10-second eccentrics. Good session, felt strong on press.",
    metadata: { date: "2026-01-15", type: "upper" },
  },
  {
    id: "workout-002",
    document:
      "Workout B: Back squat 155lbs 4x8, glute bridge 125lbs 4x15, step-ups bodyweight 3x10 each leg. Squats felt heavy on the last two sets, need to focus on bracing.",
    metadata: { date: "2026-01-17", type: "lower" },
  },
  {
    id: "workout-003",
    document:
      "Workout A: Overhead press 65lbs 3x8, barbell rows 95lbs 4x10, dips bodyweight 3x8. OHP was tough at this weight. Consider deload next week.",
    metadata: { date: "2026-01-19", type: "upper" },
  },
];

await collection.add({
  ids: sampleDocs.map((d) => d.id),
  documents: sampleDocs.map((d) => d.document),
  metadatas: sampleDocs.map((d) => d.metadata),
});

console.log(`Added ${sampleDocs.length} sample documents to "${TEST_COLLECTION}".\n`);

// --- Step 4: Query the collection ---
console.log("--- Step 4: Semantic Query ---");

const queryText = "What was my squat workout like?";
console.log(`Query: "${queryText}"`);

const results = await collection.query({
  queryTexts: [queryText],
  nResults: 2,
});

console.log("\nQuery Results:");
for (let i = 0; i < (results.documents?.[0]?.length ?? 0); i++) {
  console.log(`\n  Result ${i + 1}:`);
  console.log(`    Document: ${results.documents?.[0]?.[i]}`);
  console.log(`    Metadata: ${JSON.stringify(results.metadatas?.[0]?.[i])}`);
  console.log(`    Distance: ${results.distances?.[0]?.[i]}`);
}

const chromaDbPass =
  results.documents?.[0]?.length != null && results.documents[0].length > 0;
console.log(`\nChromaDB pipeline: ${chromaDbPass ? "PASS" : "FAIL"}`);

// --- Step 5: Clean up test collection ---
console.log("\n--- Step 5: Cleanup ---");
await client.deleteCollection({ name: TEST_COLLECTION });
console.log(`Deleted test collection "${TEST_COLLECTION}".\n`);

// --- Step 6: Test Gemini Structured JSON Output ---
console.log("--- Step 6: Gemini Structured JSON Output ---");

const WorkoutSchema = z.object({
  exercises: z.array(
    z.object({
      name: z.string(),
      sets: z.number().int(),
      reps: z.number().int(),
      weight: z.number(),
      restSeconds: z.number().int(),
    })
  ),
  notes: z.string(),
});

type Workout = z.infer<typeof WorkoutSchema>;

// Use zod v4 native toJSONSchema (zod-to-json-schema produces empty defs for v4)
const jsonSchema = z.toJSONSchema(WorkoutSchema);
console.log("Zod schema converted to JSON Schema (via z.toJSONSchema).");
console.log("Schema:", JSON.stringify(jsonSchema, null, 2));

const prompt = `Generate a realistic upper body workout for a 6'6" intermediate lifter with a home gym setup (barbell, rack, pull-up bar, dip station). Include 4 exercises. Be specific with weights in pounds.`;

console.log(`\nPrompt: "${prompt.slice(0, 80)}..."`);

// Strip $schema since Gemini API doesn't accept it
const { $schema, ...schemaForGemini } = jsonSchema as Record<string, unknown>;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: schemaForGemini,
  },
});

const rawJson = response.text!;
console.log("\nRaw JSON response:");
console.log(rawJson);

let structuredPass = false;
try {
  const parsed = JSON.parse(rawJson);
  const validated: Workout = WorkoutSchema.parse(parsed);
  console.log("\nZod validation: PASSED");
  console.log(`Exercises: ${validated.exercises.length}`);
  for (const ex of validated.exercises) {
    console.log(
      `  - ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs (${ex.restSeconds}s rest)`
    );
  }
  console.log(`Notes: ${validated.notes}`);
  structuredPass = true;
} catch (err) {
  console.error("Zod validation FAILED:", err);
}

// --- Final verdict ---
console.log("\n" + "=".repeat(40));
if (chromaDbPass && structuredPass) {
  console.log("VALID-02: PASS");
  console.log(
    "ChromaDB embedding pipeline and Gemini structured JSON output both verified."
  );
} else {
  console.log("VALID-02: FAIL");
  if (!chromaDbPass) console.log("  - ChromaDB pipeline failed");
  if (!structuredPass) console.log("  - Structured JSON output failed");
}
console.log("=".repeat(40));
