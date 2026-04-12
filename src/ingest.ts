#!/usr/bin/env node
import "dotenv/config";
/**
 * Ingest Longvinter C++ code into LanceDB
 *
 * Usage:
 *   npm run ingest                    # Ingest game code + plugins
 *   npm run ingest -- --code-only     # Only game source code
 *   npm run ingest -- --plugins-only  # Only plugin code
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { parseDirectory, type CppChunk } from "./cpp-parser.js";
import { VoyageEmbedding } from "./embedding.js";
import { LanceDBStore } from "./vectorstore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the Longvinter modding repo (sibling directory or custom via env var)
const REPO_ROOT = process.env.LONGVINTER_MODDING_PATH || path.resolve(__dirname, "../../longvinter-modding");
const SOURCE_DIR = path.join(REPO_ROOT, "Source");
const PLUGINS_DIR = path.join(REPO_ROOT, "Plugins");

const TABLE_NAMES = {
  code: "longvinter_code",
  plugins: "longvinter_plugins",
};

async function embedAndStore(
  chunks: CppChunk[],
  tableName: string,
  embedding: VoyageEmbedding,
  store: LanceDBStore
): Promise<void> {
  console.log(`\n  Embedding ${chunks.length} chunks...`);
  const startEmbed = Date.now();

  // Prepare texts for embedding
  const texts = chunks.map((c) => {
    const header = c.className ? `// ${c.className}::${c.functionName}` : `// ${c.functionName}`;
    return `${header}\n// File: ${c.filePath}\n${c.content}`;
  });

  const result = await embedding.embedBatch(texts, "code", "document", (current, total) => {
    process.stdout.write(`\r  Embedded ${current}/${total} chunks`);
  });
  console.log("");

  const embedTime = ((Date.now() - startEmbed) / 1000).toFixed(1);
  console.log(`  Embed time: ${embedTime}s`);
  console.log(`  Tokens used: ${result.usage?.totalTokens.toLocaleString()}`);

  // Store in LanceDB
  console.log(`  Storing in LanceDB table: ${tableName}...`);
  const records = chunks.map((chunk, i) => ({
    ...chunk,
    vector: result.vectors[i],
  }));

  await store.insert(tableName, records);
  console.log(`  Stored ${records.length} records`);
}

async function main() {
  const args = process.argv.slice(2);
  const codeOnly = args.includes("--code-only");
  const pluginsOnly = args.includes("--plugins-only");

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.error("Error: VOYAGE_API_KEY not set. Add it to .env file.");
    process.exit(1);
  }

  const dbPath = process.env.LONGVINTER_RAG_DB_PATH || path.join(__dirname, "..", "data", "lancedb");
  fs.mkdirSync(dbPath, { recursive: true });

  console.log("=== Longvinter RAG Code Ingestion ===");
  console.log(`Database: ${dbPath}`);
  console.log("");

  const embedding = new VoyageEmbedding(apiKey);
  const store = new LanceDBStore(dbPath);
  await store.connect();

  // Ingest game source code
  if (!pluginsOnly) {
    console.log("--- Game Source Code ---");
    console.log(`Source: ${SOURCE_DIR}`);

    const { chunks, errors } = await parseDirectory(SOURCE_DIR, false, (current, total, file) => {
      if (current % 10 === 0 || current === total) {
        process.stdout.write(`\r  Parsed ${current}/${total} files`);
      }
    });
    console.log("");

    console.log(`  Chunks: ${chunks.length}`);
    if (errors.length > 0) console.log(`  Errors: ${errors.length}`);

    if (chunks.length > 0) {
      await embedAndStore(chunks, TABLE_NAMES.code, embedding, store);
    }
  }

  // Ingest plugin source code
  if (!codeOnly) {
    console.log("\n--- Plugin Source Code ---");
    console.log(`Source: ${PLUGINS_DIR}`);

    const { chunks, errors } = await parseDirectory(PLUGINS_DIR, true, (current, total, file) => {
      if (current % 50 === 0 || current === total) {
        process.stdout.write(`\r  Parsed ${current}/${total} files`);
      }
    });
    console.log("");

    console.log(`  Chunks: ${chunks.length}`);
    if (errors.length > 0) console.log(`  Errors: ${errors.length}`);

    if (chunks.length > 0) {
      await embedAndStore(chunks, TABLE_NAMES.plugins, embedding, store);
    }
  }

  console.log("\n=== Ingestion Complete ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
