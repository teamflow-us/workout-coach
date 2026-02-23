#!/usr/bin/env node
/**
 * Generate Supabase ANON_KEY and SERVICE_KEY JWTs from JWT_SECRET.
 *
 * Usage:
 *   node scripts/generate-supabase-keys.mjs
 *   JWT_SECRET=my-secret node scripts/generate-supabase-keys.mjs
 *
 * Reads JWT_SECRET from the environment or from .env in the project root.
 * Outputs the keys ready to paste into .env.
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load JWT_SECRET from environment or .env
// ---------------------------------------------------------------------------
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on environment
  }
}

loadEnv();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Error: JWT_SECRET is not set. Export it or add it to .env.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// JWT helpers (HS256, no external deps)
// ---------------------------------------------------------------------------
function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ];
  const signingInput = segments.join(".");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  segments.push(base64url(signature));
  return segments.join(".");
}

// ---------------------------------------------------------------------------
// Generate keys — valid for ~10 years
// ---------------------------------------------------------------------------
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 60 * 60; // +10 years

const anonKey = signJWT({ role: "anon", iss: "supabase", iat, exp }, JWT_SECRET);
const serviceKey = signJWT(
  { role: "service_role", iss: "supabase", iat, exp },
  JWT_SECRET,
);

// ---------------------------------------------------------------------------
// Also URL-encode the POSTGRES_PASSWORD if present
// ---------------------------------------------------------------------------
const pgPass = process.env.POSTGRES_PASSWORD;
const pgPassEncoded = pgPass ? encodeURIComponent(pgPass) : null;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log("\n# --- Supabase JWT Keys (add to .env) ---\n");
console.log(`SUPABASE_ANON_KEY=${anonKey}`);
console.log(`SUPABASE_SERVICE_KEY=${serviceKey}`);
if (pgPassEncoded) {
  console.log(`POSTGRES_PASSWORD_URLENCODED=${pgPassEncoded}`);
}
console.log("\n# ----------------------------------------\n");
