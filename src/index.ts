#!/usr/bin/env node
import "dotenv/config";
/**
 * Longvinter RAG - Main Entry Point
 *
 * Semantic search MCP server for the Longvinter modding codebase.
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { VoyageEmbedding } from "./embedding.js";
import { LanceDBStore } from "./vectorstore.js";
import { ToolRegistry } from "./tool-registry.js";
import { searchCodeTool } from "./tools/search-code.js";
import { searchPluginsTool } from "./tools/search-plugins.js";
import { searchDocsTool } from "./tools/search-docs.js";
import { codeStatsTool, pluginsStatsTool, docsStatsTool } from "./tools/stats.js";
import { startMCPServer } from "./mcp-server.js";
import type { ToolContext } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TABLE_NAMES = {
  code: "longvinter_code",
  plugins: "longvinter_plugins",
  docs: "longvinter_docs",
};

async function main() {
  const dbPath = process.env.LONGVINTER_RAG_DB_PATH || path.join(__dirname, "..", "data", "lancedb");
  const apiKey = process.env.VOYAGE_API_KEY;

  let configError: string | undefined;
  let embedding: VoyageEmbedding | undefined;

  if (!apiKey) {
    configError =
      "Voyage API key not configured. Add VOYAGE_API_KEY=your-key to .env file.\n" +
      "Get a free key at https://www.voyageai.com/";
  } else if (!apiKey.startsWith("pa-")) {
    configError = `Invalid Voyage API key format. Keys should start with "pa-".`;
  } else {
    embedding = new VoyageEmbedding(apiKey);
  }

  const vectorStore = new LanceDBStore(dbPath);
  if (!configError) {
    await vectorStore.connect();
  }

  const registry = new ToolRegistry();
  registry.register(searchCodeTool);
  registry.register(searchPluginsTool);
  registry.register(searchDocsTool);
  registry.register(codeStatsTool);
  registry.register(pluginsStatsTool);
  registry.register(docsStatsTool);

  const context: ToolContext = {
    embedding,
    vectorStore,
    configError,
    tables: TABLE_NAMES,
  };

  await startMCPServer(registry, context);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
