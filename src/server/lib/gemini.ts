import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error(
    'GEMINI_API_KEY not set in environment. Add it to your .env file.'
  )
}

export const ai = new GoogleGenAI({ apiKey })

/**
 * Count tokens in a text string using the Gemini API.
 * Useful for measuring context size before generation calls.
 */
export async function countTokens(
  text: string,
  model: string = 'gemini-2.5-flash'
) {
  const result = await ai.models.countTokens({
    model,
    contents: text,
  })
  return result
}
