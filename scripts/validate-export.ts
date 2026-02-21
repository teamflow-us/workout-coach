import "dotenv/config";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const EXPORT_PATH = resolve("data/gemini-export.txt");

console.log("=== VALID-01: Export Validation ===\n");

// --- File stats ---
let fileContent: string;
let fileSizeBytes: number;

try {
  const stat = statSync(EXPORT_PATH);
  fileSizeBytes = stat.size;
  fileContent = readFileSync(EXPORT_PATH, "utf-8");
} catch (err) {
  console.error("FAIL: Could not read export file at", EXPORT_PATH);
  console.error(
    "Make sure data/gemini-export.txt exists with your Gemini conversation export."
  );
  process.exit(1);
}

const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

console.log(`File: ${EXPORT_PATH}`);
console.log(`Size: ${fileSizeBytes} bytes (${fileSizeKB} KB / ${fileSizeMB} MB)`);

// --- Line and word count ---
const lines = fileContent.split("\n");
const lineCount = lines.length;
const wordCount = fileContent.split(/\s+/).filter(Boolean).length;

console.log(`Lines: ${lineCount}`);
console.log(`Words: ~${wordCount.toLocaleString()}`);

// --- Conversation turn detection ---
console.log("\n--- Turn Structure Detection ---");

// Pattern 1: "You said" (Gemini web export format)
const youSaidMatches = fileContent.match(/^You said$/gm);
const youSaidCount = youSaidMatches ? youSaidMatches.length : 0;

// Pattern 2: "User:" / "Model:" prefixes
const userPrefixMatches = fileContent.match(/^User:/gm);
const modelPrefixMatches = fileContent.match(/^Model:/gm);
const userPrefixCount = userPrefixMatches ? userPrefixMatches.length : 0;
const modelPrefixCount = modelPrefixMatches ? modelPrefixMatches.length : 0;

// Pattern 3: Timestamp patterns (e.g., "2025-01-09T..." or "January 9, 2025")
const timestampMatches = fileContent.match(
  /\b\d{4}-\d{2}-\d{2}T|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gm
);
const timestampCount = timestampMatches ? timestampMatches.length : 0;

console.log(`"You said" markers: ${youSaidCount}`);
console.log(`"User:" prefixes: ${userPrefixCount}`);
console.log(`"Model:" prefixes: ${modelPrefixCount}`);
console.log(`Timestamp patterns: ${timestampCount}`);

// Determine primary delimiter
let turnCount = 0;
let delimiter = "unknown";

if (youSaidCount > 5) {
  turnCount = youSaidCount;
  delimiter = '"You said" markers';
} else if (userPrefixCount > 5) {
  turnCount = userPrefixCount;
  delimiter = '"User:" prefixes';
} else if (timestampCount > 5) {
  turnCount = Math.floor(timestampCount / 2); // each turn might have a timestamp
  delimiter = "Timestamp patterns";
}

console.log(`\nDetected delimiter: ${delimiter}`);
console.log(`Estimated user messages: ${turnCount}`);

// --- First and last 500 characters ---
console.log("\n--- First 500 characters ---");
console.log(fileContent.slice(0, 500));
console.log("\n--- Last 500 characters ---");
console.log(fileContent.slice(-500));

// --- Quality assessment ---
console.log("\n--- Quality Assessment ---");

let status: "PASS" | "WARN" | "FAIL";
let reason: string;

if (fileSizeBytes < 1024) {
  status = "FAIL";
  reason = `File too small (${fileSizeBytes} bytes). Expected a full conversation export.`;
} else if (turnCount === 0) {
  status = "WARN";
  reason = `File is ${fileSizeKB} KB but no conversation turn structure detected. May need manual inspection.`;
} else {
  status = "PASS";
  reason = `File is ${fileSizeKB} KB with ${turnCount} detected user messages via ${delimiter}.`;
}

console.log(`\nVALID-01 (Export Quality): ${status}`);
console.log(`Reason: ${reason}`);

if (status === "PASS") {
  console.log(
    `\nSummary: ${turnCount} conversation turns across ${lineCount} lines (~${wordCount.toLocaleString()} words).`
  );
}
