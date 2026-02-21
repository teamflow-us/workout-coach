/**
 * Backfill the SQLite messages table with the full Gemini export history.
 *
 * Parses data/gemini-export.txt, extracts every user-AI exchange pair,
 * estimates dates from message content (same logic as import-gemini-history),
 * and inserts them in order so the chat UI displays the full conversation.
 *
 * Usage:
 *   npx tsx scripts/backfill-messages.ts              # run
 *   npx tsx scripts/backfill-messages.ts --dry-run     # preview only
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ---------------------------------------------------------------------------
// 1. Parse the export into user-AI exchange pairs
// ---------------------------------------------------------------------------

interface Exchange {
  turnNumber: number
  user: string
  ai: string
}

function parseExport(text: string): Exchange[] {
  const exchanges: Exchange[] = []
  const userPattern = /^## User \(Turn (\d+)\)$/gm

  const userTurns: Array<{ turnNumber: number; index: number }> = []
  let match: RegExpExecArray | null
  while ((match = userPattern.exec(text)) !== null) {
    userTurns.push({ turnNumber: parseInt(match[1], 10), index: match.index })
  }

  for (let i = 0; i < userTurns.length; i++) {
    const turnStart = userTurns[i].index
    const turnEnd = i + 1 < userTurns.length ? userTurns[i + 1].index : text.length
    const turnBlock = text.slice(turnStart, turnEnd)

    const headerEnd = turnBlock.indexOf('\n') + 1
    const firstSep = turnBlock.indexOf('\n---\n', headerEnd)
    if (firstSep === -1) continue

    const userMsg = turnBlock.slice(headerEnd, firstSep).trim()

    const geminiStart = turnBlock.indexOf('## Gemini')
    if (geminiStart === -1) continue

    const geminiHeaderEnd = turnBlock.indexOf('\n', geminiStart) + 1
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
// 2. Date extraction (same as import-gemini-history.ts)
// ---------------------------------------------------------------------------

const DATE_PATTERNS = [
  /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/i,
  /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/i,
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
      const parts = dateStr.replace(/,/g, '').split(/\s+/)
      const monthStr = parts.find((p) => MONTH_MAP[p] !== undefined)
      const dayStr = parts.find((p) => /^\d+/.test(p))
      if (monthStr && dayStr) {
        const month = MONTH_MAP[monthStr]
        const day = parseInt(dayStr.replace(/\D/g, ''), 10)
        const year = 2026
        const dateObj = new Date(year, month, day)
        return dateObj.toISOString().split('T')[0]
      }
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// 3. Assign timestamps — spread exchanges across extracted dates
// ---------------------------------------------------------------------------

function assignTimestamps(exchanges: Exchange[]): string[] {
  let lastKnownDate = '2026-01-09'
  const dates: string[] = []

  for (const ex of exchanges) {
    const dateFromAi = extractDate(ex.ai)
    const dateFromUser = extractDate(ex.user)
    const found = dateFromAi || dateFromUser
    if (found) lastKnownDate = found
    dates.push(lastKnownDate)
  }

  // For each date group, space messages 2 minutes apart starting at 08:00
  const timestamps: string[] = []
  let prevDate = ''
  let minuteOffset = 0

  for (let i = 0; i < exchanges.length; i++) {
    const date = dates[i]
    if (date !== prevDate) {
      minuteOffset = 0
      prevDate = date
    }

    const hours = 8 + Math.floor(minuteOffset / 60)
    const mins = minuteOffset % 60
    const ts = `${date} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
    timestamps.push(ts)
    minuteOffset += 2
  }

  return timestamps
}

// ---------------------------------------------------------------------------
// 4. Insert into SQLite
// ---------------------------------------------------------------------------

function main() {
  const exportPath = resolve(process.cwd(), 'data/gemini-export.txt')
  console.log(`Reading export: ${exportPath}`)
  const raw = readFileSync(exportPath, 'utf-8')

  const exchanges = parseExport(raw)
  console.log(`Parsed ${exchanges.length} exchange pairs (${exchanges.length * 2} messages)`)

  const timestamps = assignTimestamps(exchanges)

  if (DRY_RUN) {
    console.log('\n=== DRY RUN ===\n')
    for (let i = 0; i < Math.min(exchanges.length, 10); i++) {
      console.log(`Turn ${exchanges[i].turnNumber} @ ${timestamps[i]}`)
      console.log(`  User: ${exchanges[i].user.slice(0, 80)}...`)
      console.log(`  AI:   ${exchanges[i].ai.slice(0, 80)}...`)
      console.log()
    }
    console.log(`... and ${Math.max(0, exchanges.length - 10)} more exchanges`)
    console.log(`\nTotal messages to insert: ${exchanges.length * 2}`)
    return
  }

  const dbPath = resolve(process.cwd(), 'workout.db')
  const db = new Database(dbPath)

  // Check current count
  const before = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count
  console.log(`Current message count: ${before}`)

  const insert = db.prepare(
    'INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)'
  )

  const insertAll = db.transaction(() => {
    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i]
      const ts = timestamps[i]

      // User message — timestamp as-is
      insert.run('user', ex.user, ts)
      // AI response — 1 second later
      insert.run('model', ex.ai, ts.replace(/:00$/, ':01'))
    }
  })

  insertAll()

  const after = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count
  console.log(`Inserted ${after - before} messages (${after} total)`)

  db.close()
  console.log('Done.')
}

main()
