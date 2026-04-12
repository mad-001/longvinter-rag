/**
 * Voyage AI Embedding Provider for Longvinter RAG
 */

import type { EmbeddingProvider, EmbeddingPurpose, EmbeddingResult } from "./types.js";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

const MODELS = {
  code: "voyage-code-3",
  text: "voyage-4-large",
};

const BATCH_SIZE = 10; // Small batches for free tier rate limits
const RATE_LIMIT_MS = 21000; // ~3 RPM = 20s between requests + buffer
const MAX_RETRIES = 5;
const MAX_CHARS_CODE = 32000;
const MAX_CHARS_TEXT = 16000;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "\n// ... truncated";
}

export class VoyageEmbedding implements EmbeddingProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedBatch(
    texts: string[],
    purpose: EmbeddingPurpose,
    mode: "document" | "query",
    onProgress?: (current: number, total: number) => void
  ): Promise<EmbeddingResult> {
    const model = purpose === "code" ? MODELS.code : MODELS.text;
    const inputType = mode === "query" ? "query" : "document";
    const maxChars = purpose === "code" ? MAX_CHARS_CODE : MAX_CHARS_TEXT;

    const allVectors: number[][] = [];
    let totalTokens = 0;

    const truncatedTexts = texts.map((t) => truncate(t, maxChars));

    for (let i = 0; i < truncatedTexts.length; i += BATCH_SIZE) {
      const batch = truncatedTexts.slice(i, i + BATCH_SIZE);

      let data: VoyageResponse | undefined;
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        const response = await fetch(VOYAGE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ model, input: batch, input_type: inputType }),
        });

        if (response.ok) {
          data = (await response.json()) as VoyageResponse;
          break;
        }

        if (response.status === 429) {
          const waitTime = Math.min(30000 * (retry + 1), 120000);
          process.stderr.write(`\n  Rate limited, waiting ${waitTime / 1000}s (retry ${retry + 1}/${MAX_RETRIES})...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        const errorText = await response.text();
        throw new Error(`Voyage API error: ${response.status} - ${errorText}`);
      }

      if (!data) throw new Error("Exceeded max retries due to rate limiting");
      data.data.sort((a, b) => a.index - b.index);
      allVectors.push(...data.data.map((d) => d.embedding));
      totalTokens += data.usage.total_tokens;

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, truncatedTexts.length), truncatedTexts.length);
      }

      if (i + BATCH_SIZE < truncatedTexts.length) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }

    return {
      vectors: allVectors,
      model,
      dimensions: 1024,
      usage: { totalTokens },
    };
  }

  async embedQuery(text: string, purpose: EmbeddingPurpose): Promise<number[]> {
    const result = await this.embedBatch([text], purpose, "query");
    return result.vectors[0];
  }
}
