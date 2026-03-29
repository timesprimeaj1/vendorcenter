import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
let extractor: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

const MODEL_LOAD_TIMEOUT_MS = 60_000; // 60s max for model download/load

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;

  if (!loadingPromise) {
    const load = pipeline("feature-extraction", MODEL_NAME, {
      quantized: true,
    }).then((pipe) => {
      extractor = pipe;
      console.log("[embedding] Model loaded:", MODEL_NAME);
      return pipe;
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Embedding model load timed out after ${MODEL_LOAD_TIMEOUT_MS}ms`)), MODEL_LOAD_TIMEOUT_MS),
    );

    loadingPromise = Promise.race([load, timeout]).catch((err) => {
      // Reset so next call retries from scratch
      loadingPromise = null;
      extractor = null;
      throw err;
    });
  }

  return loadingPromise;
}

/**
 * Generate a 384-dimensional embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getExtractor();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getExtractor();
  const output = await pipe(texts, { pooling: "mean", normalize: true });
  const dim = 384;
  const data = output.data as Float32Array;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
  }
  return results;
}

/**
 * Compute cosine similarity between two vectors (assumes normalized inputs → dot product).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Pre-warm the model on startup so first query doesn't pay the load penalty.
 * Call this during server boot — failure is non-fatal.
 */
export async function warmupEmbeddingModel(): Promise<void> {
  try {
    await getExtractor();
  } catch (err) {
    console.warn("[embedding] Warmup failed (non-fatal):", (err as Error).message);
  }
}
