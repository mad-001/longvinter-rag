#!/usr/bin/env node
/**
 * Run all ingestion scripts
 */

import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

console.log("=== Longvinter RAG - Full Ingestion ===\n");

try {
  console.log("--- Step 1: Ingesting C++ code ---\n");
  execSync("npx tsx src/ingest.ts", { cwd: rootDir, stdio: "inherit" });

  console.log("\n--- Step 2: Ingesting documentation ---\n");
  execSync("npx tsx src/ingest-docs.ts", { cwd: rootDir, stdio: "inherit" });

  console.log("\n=== Full Ingestion Complete ===");
} catch (error) {
  console.error("Ingestion failed:", error);
  process.exit(1);
}
