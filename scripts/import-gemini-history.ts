/**
 * Import Gemini coaching history into ChromaDB.
 *
 * Parses the full Gemini export (data/gemini-export.txt), groups user-AI
 * exchanges into workout-session-level chunks, enriches with metadata,
 * and embeds into the coaching-history ChromaDB collection.
 *
 * Usage:
 *   npx tsx scripts/import-gemini-history.ts              # full import
 *   npx tsx scripts/import-gemini-history.ts --dry-run     # inspect only
 *   npx tsx scripts/import-gemini-history.ts --delay=200   # slower API calls
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getCollection } from '../src/server/lib/chroma.js'
import { extractMetadata } from '../src/server/lib/rag.js'

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const DELAY_MS = (() => {
  const flag = args.find((a) => a.startsWith('--delay='))
  return flag ? parseInt(flag.split('=')[1], 10) : 100
})()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Exchange {
  turnNumber: number
  user: string
  ai: string
}

interface Session {
  id: string
  exchanges: Exchange[]
  date: string
  label: string
  document: string
}

// ---------------------------------------------------------------------------
// 1. Parse the export into user-AI exchange pairs
// ---------------------------------------------------------------------------

function parseExport(text: string): Exchange[] {
  const exchanges: Exchange[] = []

  // Split on "## User (Turn N)" markers
  const userPattern = /^## User \(Turn (\d+)\)$/gm
  const geminiPattern = /^## Gemini$/gm
  const separatorPattern = /^---$/gm

  // Collect all user turn positions
  const userTurns: Array<{ turnNumber: number; index: number }> = []
  let match: RegExpExecArray | null
  while ((match = userPattern.exec(text)) !== null) {
    userTurns.push({ turnNumber: parseInt(match[1], 10), index: match.index })
  }

  for (let i = 0; i < userTurns.length; i++) {
    const turnStart = userTurns[i].index
    const turnEnd = i + 1 < userTurns.length ? userTurns[i + 1].index : text.length
    const turnBlock = text.slice(turnStart, turnEnd)

    // Extract user message: text between the "## User" header and "---"
    const headerEnd = turnBlock.indexOf('\n') + 1
    const firstSep = turnBlock.indexOf('\n---\n', headerEnd)
    if (firstSep === -1) continue

    const userMsg = turnBlock.slice(headerEnd, firstSep).trim()

    // Extract AI response: text between "## Gemini" and the next "---"
    const geminiStart = turnBlock.indexOf('## Gemini')
    if (geminiStart === -1) continue

    const geminiHeaderEnd = turnBlock.indexOf('\n', geminiStart) + 1
    // Find the trailing "---" that closes this Gemini block
    const lastSep = turnBlock.lastIndexOf('\n---')
    const aiMsg =
      lastSep > geminiHeaderEnd
        ? turnBlock.slice(geminiHeaderEnd, lastSep).trim()
        : turnBlock.slice(geminiHeaderEnd).trim()

    exchanges.push({
      turnNumber: userTurns[i].turnNumber,
      user: userMsg,
      ai: aiMsg,
    })
  }

  return exchanges
}

// ---------------------------------------------------------------------------
// 2. Session boundary detection
// ---------------------------------------------------------------------------

// Signals that a user message starts a NEW session
const NEW_SESSION_SIGNALS = [
  // Asking for today's workout plan
  /what('?s| is| should).*(workout|routine|session|plan).*(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /tell me about.*(workout|routine).*(today|tomorrow)/i,
  // Reporting workout completion
  /^(i |here('?s| is| are)|today i|this morning i|i just|i completed|i did|i finished|results|completed)/i,
  // Week/day references that signal a new training block
  /^week \d/i,
  /workout [ab]/i,
  // Explicitly asking for a new plan or next workout
  /^(what|give|show|create|generate|plan).*(next|new|updated).*(workout|routine|session|plan)/i,
  /^(ready|let'?s|start|begin).*(workout|next|new|session)/i,
  // Weight check-ins that start a new day
  /^(i weigh|weighed|weight|this morning.*weigh|fasted.*weigh)/i,
  /^(good morning|morning)/i,
  // Asking what to do for warm-up / stretching for today
  /warm.?up.*today/i,
  /stretch.*today/i,
  // Providing full workout results
  /\d+\s*(lbs|reps|sets|x\d)/i,
]

// Signals that a message is a FOLLOW-UP (stays in current session)
const FOLLOW_UP_SIGNALS = [
  /^(also|update|actually|one more|btw|by the way|oh and|what about|how about|should i|can i|is it|thoughts on|for the|when|any concerns|how long|how do)/i,
  /^(yes|no|yeah|nah|correct|right|ok|okay|sure|got it|understood|thanks|thank you)/i,
  // Short questions (< 80 chars) about technique
  /^(how|what|why|when|should|can|is|do|did|will|would|could)/i,
]

function isNewSession(exchange: Exchange, prevExchange: Exchange | null): boolean {
  if (!prevExchange) return true

  const msg = exchange.user.trim()

  // Short messages (<80 chars) that start with follow-up patterns => not new
  if (msg.length < 80) {
    for (const pattern of FOLLOW_UP_SIGNALS) {
      if (pattern.test(msg)) return false
    }
  }

  // Check new-session signals
  for (const pattern of NEW_SESSION_SIGNALS) {
    if (pattern.test(msg)) return true
  }

  // Long messages (>300 chars) that report results => new session
  if (msg.length > 300 && /\d+/.test(msg)) return true

  // Default: messages under 120 chars are likely follow-ups
  if (msg.length < 120) return false

  // Longer messages default to new session
  return true
}

function groupIntoSessions(exchanges: Exchange[]): Session[] {
  const sessions: Session[] = []
  let currentExchanges: Exchange[] = []
  let sessionIndex = 0

  for (let i = 0; i < exchanges.length; i++) {
    const exchange = exchanges[i]
    const prevExchange = i > 0 ? exchanges[i - 1] : null

    if (isNewSession(exchange, prevExchange) && currentExchanges.length > 0) {
      sessions.push(buildSession(currentExchanges, sessionIndex))
      sessionIndex++
      currentExchanges = []
    }

    currentExchanges.push(exchange)
  }

  // Final session
  if (currentExchanges.length > 0) {
    sessions.push(buildSession(currentExchanges, sessionIndex))
  }

  return sessions
}

// ---------------------------------------------------------------------------
// 3. Session construction with metadata
// ---------------------------------------------------------------------------

// Date patterns found in the Gemini coaching responses
const DATE_PATTERNS = [
  // "Monday, January 20th" / "Wednesday, Feb 4"
  /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/i,
  // "February 9th" / "Jan 15"
  /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/i,
  // "Feb 4" short form
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i,
]

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
  april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
  august: 7, aug: 7, september: 8, sep: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
}

function extractDate(text: string): string {
  const lower = text.toLowerCase()
  for (const pattern of DATE_PATTERNS) {
    const m = lower.match(pattern)
    if (m) {
      const dateStr = m[0]
      // Parse month and day
      const parts = dateStr.replace(/,/g, '').split(/\s+/)
      // Skip day-of-week if present
      const monthStr = parts.find((p) => MONTH_MAP[p] !== undefined)
      const dayStr = parts.find((p) => /^\d+/.test(p))
      if (monthStr && dayStr) {
        const month = MONTH_MAP[monthStr]
        const day = parseInt(dayStr.replace(/\D/g, ''), 10)
        // Export spans Jan-Feb 2026
        const year = 2026
        const dateObj = new Date(year, month, day)
        return dateObj.toISOString().split('T')[0]
      }
    }
  }
  return ''
}

// Track last known date for sessions without explicit dates
let lastKnownDate = '2026-01-09' // conversation start date

function buildSession(exchanges: Exchange[], index: number): Session {
  const fullText = exchanges
    .map((e) => `User (Turn ${e.turnNumber}):\n${e.user}\n\nCoach:\n${e.ai}`)
    .join('\n\n---\n\n')

  // Try to extract date from the AI response (more likely to have dates)
  let date = ''
  for (const e of exchanges) {
    date = extractDate(e.ai)
    if (date) break
  }
  // Also try user messages
  if (!date) {
    for (const e of exchanges) {
      date = extractDate(e.user)
      if (date) break
    }
  }
  // Fall back to last known or estimate
  if (date) {
    lastKnownDate = date
  } else {
    date = lastKnownDate
  }

  // Build a label from the first user message
  const firstMsg = exchanges[0].user.slice(0, 100)
  const label = firstMsg.length > 80 ? firstMsg.slice(0, 80) + '...' : firstMsg
  const turnRange =
    exchanges.length === 1
      ? `Turn ${exchanges[0].turnNumber}`
      : `Turns ${exchanges[0].turnNumber}-${exchanges[exchanges.length - 1].turnNumber}`

  const id = `gemini-import-${String(index).padStart(3, '0')}`

  return { id, exchanges, date, label, document: fullText }
}

// ---------------------------------------------------------------------------
// 4. Token estimation (rough: 1 token ~ 4 chars for English text)
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ---------------------------------------------------------------------------
// 5. Sub-chunking for long sessions (>1800 tokens)
// ---------------------------------------------------------------------------

const MAX_TOKENS = 1800
const OVERLAP_CHARS = 400 // ~100 tokens of context overlap

function splitLongSession(session: Session): Session[] {
  const tokens = estimateTokens(session.document)
  if (tokens <= MAX_TOKENS) return [session]

  const maxChars = MAX_TOKENS * 4 // ~7200 chars per chunk
  const stepSize = maxChars - OVERLAP_CHARS // advance by ~6800 chars
  const chunks: Session[] = []
  let start = 0
  let partIndex = 0

  while (start < session.document.length) {
    const end = Math.min(start + maxChars, session.document.length)
    const chunk = session.document.slice(start, end)

    // Skip creating tiny trailing chunks (< 200 tokens)
    if (partIndex > 0 && estimateTokens(chunk) < 200) break

    const prefix = `[${session.date}] Session continued (part ${partIndex + 1}):\n\n`

    chunks.push({
      ...session,
      id: `${session.id}-p${partIndex}`,
      document: partIndex === 0 ? chunk : prefix + chunk,
      label: `${session.label} (part ${partIndex + 1})`,
    })

    start += stepSize
    partIndex++

    // Safety: don't create infinite chunks
    if (partIndex > 20) break
  }

  return chunks
}

// ---------------------------------------------------------------------------
// 6. Coaching profile special chunk
// ---------------------------------------------------------------------------

function buildProfileChunk(): { id: string; document: string; metadata: Record<string, string> } {
  // Extracted from the end of the Gemini export (Turns 177-179)
  const profileText = `ATHLETE PROFILE & BIOMETRICS
Height: 6'6" | Current Weight: 209 lbs | Caloric Target: 2,900 kcal
Injury Status: Anterior Pelvic Tilt (APT) / Lower Back Management (Goal <= 2/10 pain).

EQUIPMENT & TOOLS LIST
Primary: Barbell, plates (2x45, 2x25, 2x15, 2x10, 2x5 = 245 lbs total), bench, 93-inch 4-post rack with multigrip pull-up bar, dip station, push-up grips.
Secondary: 5 lb dumbbells (for lateral raises/weighted deadbugs), 35 lb backpack.
Technical Aids: Yoga mat, squat rack/pins (for inverted rows), wooden box (for step-ups).

WORKOUT PERFORMANCE HISTORY
Workout A (Upper Focus):
- Barbell Floor Press: 145 lbs (2x10, 2x8). Elbows at 45 degrees, bar to mid-chest.
- Inverted Rows: Notch 25 (4x10). 1-sec hold at top, scapular retraction.
- Pull-up Negatives: 3x5 (10-sec descent). Thumbless Hook grip, elbows to back pockets.
- Tempo Pushups: 1x10, 2x8. 3-sec descent, strict core tension.

Workout B (Lower/Posterior Focus):
- Glute Bridge: 125 lbs (4x15). Heels close to glutes, short bridge range, bar on thighs.
- Step-ups: BW (3x10). 3-sec descent, grip floor with toes.
- Overhead Press: 60 lbs (3x8). Squeeze glutes to lock lumbar.
- Lateral Raises: 5 lbs (3x20). High volume focus.

CORE & RECOVERY (Posterior Pelvic Tilt Focus):
- Deadbugs: 3x15. Back pinned/snug to ground.
- RKC Plank: 3x45s. Maximum tail-tuck/glute squeeze.
- Warmup/Prehab: 90/90 Breathing (5-10 mins), Couch Stretch (2 mins/side).

TRAINING PREFERENCES:
- 42 years old, hard-gainer, trains fasted in the morning
- Prioritizes chest growth, then back, then legs
- APT correction is secondary priority
- Visceral fat reduction is tertiary priority
- Prefers safe, low-skill movements (no traditional squats/deadlifts)
- Analytical, data-driven, no-nonsense communication style`

  return {
    id: 'coaching-profile',
    document: profileText,
    metadata: {
      type: 'profile',
      date: new Date().toISOString().split('T')[0],
    },
  }
}

// ---------------------------------------------------------------------------
// 7. Main import flow
// ---------------------------------------------------------------------------

async function main() {
  const exportPath = resolve(process.cwd(), 'data/gemini-export.txt')
  console.log(`Reading export: ${exportPath}`)
  const raw = readFileSync(exportPath, 'utf-8')
  console.log(`File: ${raw.length} chars, ${raw.split('\n').length} lines\n`)

  // Parse
  console.log('--- Parsing exchanges ---')
  const exchanges = parseExport(raw)
  console.log(`Parsed ${exchanges.length} user-AI exchange pairs\n`)

  // Group into sessions
  console.log('--- Grouping into sessions ---')
  const sessions = groupIntoSessions(exchanges)
  console.log(`Grouped into ${sessions.length} sessions\n`)

  // Split long sessions
  const allChunks: Session[] = []
  for (const session of sessions) {
    const parts = splitLongSession(session)
    allChunks.push(...parts)
  }
  console.log(`After splitting long sessions: ${allChunks.length} total chunks\n`)

  // Enrich with metadata
  const enriched = allChunks.map((chunk) => {
    const meta = extractMetadata(chunk.document)
    return {
      ...chunk,
      metadata: {
        type: 'gemini-import',
        date: chunk.date,
        exercises: meta.exercises.join(', '),
        muscleGroups: meta.muscleGroups.join(', '),
        turnRange:
          chunk.exchanges.length === 1
            ? `${chunk.exchanges[0].turnNumber}`
            : `${chunk.exchanges[0].turnNumber}-${chunk.exchanges[chunk.exchanges.length - 1].turnNumber}`,
        exchangeCount: chunk.exchanges.length,
      },
    }
  })

  // Display dry-run info
  if (DRY_RUN) {
    console.log('=== DRY RUN MODE ===\n')
    for (const chunk of enriched) {
      const tokens = estimateTokens(chunk.document)
      console.log(
        `${chunk.id} | ${chunk.metadata.date} | ~${tokens} tokens | ${chunk.metadata.turnRange} turns | ` +
          `exercises: [${chunk.metadata.exercises || 'none'}] | muscles: [${chunk.metadata.muscleGroups || 'none'}]`
      )
      console.log(`  Label: ${chunk.label}`)
      console.log(`  Preview: ${chunk.document.slice(0, 120).replace(/\n/g, ' ')}...`)
      console.log()
    }
    console.log(`Total chunks: ${enriched.length}`)
    console.log(`Total estimated tokens: ${enriched.reduce((s, c) => s + estimateTokens(c.document), 0)}`)
    console.log('\nRun without --dry-run to embed and store.')
    return
  }

  // Full import
  console.log('--- Connecting to ChromaDB ---')
  const collection = await getCollection()
  const existingCount = await collection.count()
  console.log(`Current collection count: ${existingCount}`)

  // Check which IDs already exist (for resume support)
  const allIds = enriched.map((c) => c.id)
  const existingIds = new Set<string>()
  if (existingCount > 0) {
    const existing = await collection.get({ ids: allIds, include: [] })
    for (const id of existing.ids) existingIds.add(id)
    console.log(`Already imported: ${existingIds.size} chunks`)
  }

  const toImport = enriched.filter((c) => !existingIds.has(c.id))
  console.log(`Remaining to import: ${toImport.length} chunks\n`)

  // Add with retry and exponential backoff for rate limits
  async function addWithRetry(
    ids: string[],
    documents: string[],
    metadatas: Record<string, string | number | boolean>[],
    maxRetries: number = 5
  ) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await collection.add({ ids, documents, metadatas })
        return
      } catch (err: unknown) {
        const status = (err as { status?: number }).status
        if (status === 429 && attempt < maxRetries) {
          // Aggressive backoff: 15s, 30s, 60s, 120s, 240s
          const backoff = Math.pow(2, attempt) * 15_000 + Math.random() * 5000
          console.log(`  Rate limited. Waiting ${(backoff / 1000).toFixed(0)}s before retry ${attempt + 1}/${maxRetries}...`)
          await new Promise((r) => setTimeout(r, backoff))
        } else {
          throw err
        }
      }
    }
  }

  // Process one chunk at a time to minimize API calls per request
  for (let i = 0; i < toImport.length; i++) {
    const chunk = toImport[i]
    console.log(`Embedding chunk ${i + 1}/${toImport.length}: ${chunk.id}`)

    await addWithRetry(
      [chunk.id],
      [chunk.document],
      [chunk.metadata as Record<string, string | number | boolean>]
    )

    // Delay between chunks to stay under rate limits
    if (i + 1 < toImport.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  // Add coaching profile chunk (if not already present)
  if (!existingIds.has('coaching-profile')) {
    console.log('\nEmbedding coaching profile chunk...')
    const profile = buildProfileChunk()
    await addWithRetry(
      [profile.id],
      [profile.document],
      [profile.metadata]
    )
  } else {
    console.log('\nCoaching profile already imported.')
  }

  // Verify
  const finalCount = await collection.count()
  console.log(`\n--- Import complete ---`)
  console.log(`Chunks added: ${enriched.length} sessions + 1 profile = ${enriched.length + 1}`)
  console.log(`Collection count: ${finalCount}`)

  // Sample query
  console.log('\n--- Sample query: "What was my squat workout like?" ---')
  const results = await collection.query({
    queryTexts: ['What was my squat workout like?'],
    nResults: 3,
    include: ['metadatas', 'distances'],
  })
  console.log('Top 3 results:')
  for (let i = 0; i < (results.ids?.[0]?.length ?? 0); i++) {
    console.log(
      `  ${results.ids[0][i]} | distance: ${results.distances?.[0]?.[i]?.toFixed(4)} | ` +
        `date: ${results.metadatas?.[0]?.[i]?.date} | exercises: [${results.metadatas?.[0]?.[i]?.exercises}]`
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
