#!/usr/bin/env node
import "dotenv/config";
/**
 * Ingest Longvinter documentation into LanceDB
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { VoyageEmbedding } from "./embedding.js";
import { LanceDBStore } from "./vectorstore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.LONGVINTER_MODDING_PATH || path.resolve(__dirname, "../../longvinter-modding");
const TABLE_NAME = "longvinter_docs";

interface DocChunk {
  id: string;
  title: string;
  section: string;
  content: string;
  source: string;
}

/**
 * Parse a markdown file into sections.
 */
function parseMarkdown(filePath: string): DocChunk[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);
  const chunks: DocChunk[] = [];

  // Split by headings (## and ###)
  const lines = content.split("\n");
  let currentTitle = fileName.replace(".md", "");
  let currentSection = "";
  let currentContent: string[] = [];
  let chunkIndex = 0;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match) {
      // Save previous chunk
      if (currentContent.length > 0) {
        const text = currentContent.join("\n").trim();
        if (text.length > 10) {
          chunks.push({
            id: `${fileName}:${chunkIndex++}`,
            title: currentTitle,
            section: currentSection || currentTitle,
            content: text,
            source: fileName,
          });
        }
      }
      currentTitle = h1Match[1].trim();
      currentSection = currentTitle;
      currentContent = [];
    } else if (h2Match || h3Match) {
      // Save previous chunk
      if (currentContent.length > 0) {
        const text = currentContent.join("\n").trim();
        if (text.length > 10) {
          chunks.push({
            id: `${fileName}:${chunkIndex++}`,
            title: currentTitle,
            section: currentSection || currentTitle,
            content: text,
            source: fileName,
          });
        }
      }
      currentSection = (h2Match || h3Match)![1].trim();
      currentContent = [line];
    } else {
      // Skip image-only lines but keep text content
      if (!line.match(/^!\[.*?\]\(.*?\)\s*$/)) {
        currentContent.push(line);
      }
    }
  }

  // Save last chunk
  if (currentContent.length > 0) {
    const text = currentContent.join("\n").trim();
    if (text.length > 10) {
      chunks.push({
        id: `${fileName}:${chunkIndex++}`,
        title: currentTitle,
        section: currentSection || currentTitle,
        content: text,
        source: fileName,
      });
    }
  }

  return chunks;
}

async function main() {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.error("Error: VOYAGE_API_KEY not set. Add it to .env file.");
    process.exit(1);
  }

  const dbPath = process.env.LONGVINTER_RAG_DB_PATH || path.join(__dirname, "..", "data", "lancedb");
  fs.mkdirSync(dbPath, { recursive: true });

  console.log("=== Longvinter RAG Docs Ingestion ===");
  console.log(`Database: ${dbPath}`);
  console.log("");

  // Find all markdown files in the repo root
  const docFiles = [
    path.join(REPO_ROOT, "README.md"),
    path.join(REPO_ROOT, "MapCreation.md"),
  ].filter((f) => fs.existsSync(f));

  console.log(`Found ${docFiles.length} doc files:`);
  docFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));

  // Parse all docs
  const allChunks: DocChunk[] = [];
  for (const file of docFiles) {
    const chunks = parseMarkdown(file);
    allChunks.push(...chunks);
    console.log(`  ${path.basename(file)}: ${chunks.length} chunks`);
  }

  console.log(`\nTotal chunks: ${allChunks.length}`);

  if (allChunks.length === 0) {
    console.log("No documentation chunks to embed.");
    return;
  }

  // Embed
  const embedding = new VoyageEmbedding(apiKey);
  console.log("\nEmbedding chunks...");
  const texts = allChunks.map((c) => `# ${c.title}\n## ${c.section}\n\n${c.content}`);

  const result = await embedding.embedBatch(texts, "text", "document", (current, total) => {
    process.stdout.write(`\r  Embedded ${current}/${total} chunks`);
  });
  console.log("");

  // Store
  const store = new LanceDBStore(dbPath);
  await store.connect();

  const records = allChunks.map((chunk, i) => ({
    ...chunk,
    vector: result.vectors[i],
  }));

  await store.insert(TABLE_NAME, records);
  console.log(`Stored ${records.length} records in table: ${TABLE_NAME}`);
  console.log("\n=== Docs Ingestion Complete ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
