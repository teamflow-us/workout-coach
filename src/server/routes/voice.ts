import { Hono } from 'hono'
import { deepgram } from '../lib/deepgram.js'

const app = new Hono()

// ---------- POST /transcribe -- Speech-to-text via Deepgram ----------

app.post('/transcribe', async (c) => {
  if (!deepgram) {
    return c.json(
      { error: 'Voice messaging is not configured. Set DEEPGRAM_API_KEY.' },
      503
    )
  }

  const contentType = c.req.header('content-type') || ''

  let audioBuffer: Buffer

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData()
    const file = formData.get('audio')
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No audio file provided' }, 400)
    }
    const arrayBuffer = await file.arrayBuffer()
    audioBuffer = Buffer.from(arrayBuffer)
  } else {
    // Raw audio body (e.g., audio/webm sent directly)
    const arrayBuffer = await c.req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return c.json({ error: 'Empty audio body' }, 400)
    }
    audioBuffer = Buffer.from(arrayBuffer)
  }

  try {
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-3',
        smart_format: true,
        detect_language: true,
      }
    )

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

    return c.json({ transcript })
  } catch (err) {
    console.error('Deepgram transcription error:', err)
    return c.json(
      {
        error: 'Transcription failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    )
  }
})

export default app
