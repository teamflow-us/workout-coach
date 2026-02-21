import "dotenv/config";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";

const EXPORT_PATH = resolve("data/gemini-export.txt");
const MODEL = "gemini-2.5-flash";

console.log("=== VALID-01 (part 2) + VALID-03: Token Count & RAG Strategy ===\n");

// --- Load file ---
const fileContent = readFileSync(EXPORT_PATH, "utf-8");
const fileSizeBytes = statSync(EXPORT_PATH).size;
const wordCount = fileContent.split(/\s+/).filter(Boolean).length;

console.log(`File: ${EXPORT_PATH}`);
console.log(`Size: ${fileSizeBytes} bytes (${(fileSizeBytes / 1024).toFixed(1)} KB)`);
console.log(`Words: ~${wordCount.toLocaleString()}`);

// --- Count tokens via Gemini API ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY not set in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

console.log(`\nCounting tokens with model: ${MODEL}...`);

try {
  const result = await ai.models.countTokens({
    model: MODEL,
    contents: fileContent,
  });

  const totalTokens = result.totalTokens!;

  console.log(`\n--- Token Count Results ---`);
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Approximate words: ~${wordCount.toLocaleString()}`);
  console.log(`File size: ${(fileSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`Tokens per word: ~${(totalTokens / wordCount).toFixed(2)}`);
  console.log(`Tokens per KB: ~${(totalTokens / (fileSizeBytes / 1024)).toFixed(0)}`);

  // --- RAG Strategy Decision ---
  console.log(`\n${"=".repeat(60)}`);
  console.log("RAG STRATEGY DECISION");
  console.log("=".repeat(60));

  let recommendation: string;
  let rationale: string;

  if (totalTokens < 100_000) {
    recommendation =
      "RECOMMENDATION: Context stuffing only. Fits easily in 1M window.";
    rationale = `At ${totalTokens.toLocaleString()} tokens, the full conversation fits well within Gemini's 1M token context window. No chunking or retrieval needed. Simply pass the entire history as context.`;
  } else if (totalTokens < 200_000) {
    recommendation =
      "RECOMMENDATION: Context stuffing + caching. Still fits, use caching to reduce cost.";
    rationale = `At ${totalTokens.toLocaleString()} tokens, the conversation fits in the 1M window but is large enough that caching will significantly reduce per-request costs. Use Gemini context caching for the conversation prefix.`;
  } else if (totalTokens < 500_000) {
    recommendation =
      "RECOMMENDATION: Hybrid (context stuffing + selective RAG). Approaching accuracy degradation zone.";
    rationale = `At ${totalTokens.toLocaleString()} tokens, the conversation is approaching the zone where retrieval quality degrades with pure context stuffing. Use RAG for historical lookups, context stuffing for recent sessions.`;
  } else {
    recommendation =
      "RECOMMENDATION: Full RAG required. Too large for reliable context stuffing.";
    rationale = `At ${totalTokens.toLocaleString()} tokens, the conversation exceeds reliable context stuffing limits. Full RAG pipeline with ChromaDB chunking and retrieval is necessary.`;
  }

  console.log(`\n${recommendation}`);
  console.log(`\nRationale: ${rationale}`);
  console.log(`\n${"=".repeat(60)}`);

  console.log("\nVALID-03 (RAG Strategy): DECIDED");
} catch (err) {
  console.error("ERROR counting tokens:", err);
  process.exit(1);
}
