import { createClient } from '@deepgram/sdk'

const apiKey = process.env.DEEPGRAM_API_KEY

if (!apiKey) {
  console.warn(
    'DEEPGRAM_API_KEY not set in environment. Voice messaging will be unavailable.'
  )
}

export const deepgram = apiKey ? createClient(apiKey) : null
