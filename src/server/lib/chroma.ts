import { ChromaClient, type EmbeddingFunction } from 'chromadb'
import { ai } from './gemini.js'

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost'
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || '8100', 10)
export const COLLECTION_NAME = 'coaching-history'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

/**
 * L2-normalize a vector for cosine similarity at non-3072 dimensions.
 * MRL-reduced embeddings (768-dim from 3072) require normalization.
 */
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map((v) => v / norm) : vec
}

/**
 * Custom embedding function wrapping @google/genai directly.
 * The @chroma-core/google-gemini package bundles an old SDK (v1beta)
 * that cannot use gemini-embedding-001. This uses the project's
 * @google/genai SDK with 768-dim MRL-reduced embeddings.
 */
class GeminiEmbeddingFunction implements EmbeddingFunction {
  name = 'GeminiEmbeddingFunction'

  async generate(texts: string[]): Promise<number[][]> {
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    })
    return result.embeddings!.map((e) => normalize(e.values!))
  }
}

export const embedder = new GeminiEmbeddingFunction()
export const client = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT })

/**
 * Get (or create) the coaching-history collection with cosine distance.
 * Uses the custom GeminiEmbeddingFunction for all add/query operations.
 */
export async function getCollection() {
  return client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: embedder,
    metadata: { 'hnsw:space': 'cosine' },
  })
}

/**
 * Health check for ChromaDB connectivity.
 * Used by server startup for graceful degradation when ChromaDB is down.
 */
export async function checkChromaHealth(): Promise<boolean> {
  try {
    const resp = await fetch(
      `http://${CHROMA_HOST}:${CHROMA_PORT}/api/v1/heartbeat`
    )
    return resp.ok
  } catch {
    return false
  }
}
