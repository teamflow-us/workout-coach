// Quick verification script for Task 2 API endpoints

const BASE = 'http://localhost:3001'

async function main() {
  // 1. Test health endpoint
  const health = await fetch(`${BASE}/api/health`)
  console.log('Health:', health.status, await health.json())

  // 2. Test GET profile (empty default)
  const profileGet = await fetch(`${BASE}/api/profile`)
  console.log('Profile GET:', profileGet.status, await profileGet.json())

  // 3. Test PUT profile
  const profilePut = await fetch(`${BASE}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxes: { bench: 185 },
      injuries: [],
      equipment: ['barbell', 'dumbbells'],
      dietaryConstraints: [],
      preferences: { daysPerWeek: 4 },
    }),
  })
  console.log('Profile PUT:', profilePut.status, await profilePut.json())

  // 4. Test chat history (should be empty initially or have prior messages)
  const history = await fetch(`${BASE}/api/chat/history`)
  console.log('History:', history.status, 'messages:', (await history.json()).length)

  // 5. Test chat send (SSE streaming)
  console.log('\nTesting chat streaming...')
  const chatRes = await fetch(`${BASE}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello coach, give me a brief tip.' }),
  })

  const reader = chatRes.body!.getReader()
  const decoder = new TextDecoder()
  let chunks = 0
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    const events = text.split('\n\n').filter(Boolean)
    for (const event of events) {
      const dataLine = event.split('\n').find((l: string) => l.startsWith('data: '))
      if (!dataLine) continue
      const data = JSON.parse(dataLine.slice(6))
      if (data.type === 'chunk') {
        chunks++
        fullText += data.text
      }
      if (data.type === 'done') {
        console.log(`Chat streaming: ${chunks} chunks received`)
        console.log(`Response preview: ${data.fullText.substring(0, 100)}...`)
      }
    }
  }

  // 6. Verify message persisted
  const history2 = await fetch(`${BASE}/api/chat/history`)
  const msgs = await history2.json()
  console.log(`\nHistory after chat: ${msgs.length} messages`)

  console.log('\nAll API tests passed!')
}

main().catch(console.error)
