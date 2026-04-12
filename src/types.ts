/**
 * Shared types for the Longvinter RAG system
 */

import { z } from "zod";

// --- Embedding types ---

export type EmbeddingPurpose = "code" | "text";

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
  usage?: { totalTokens: number };
}

// --- Vector store types ---

export interface VectorSearchOptions {
  limit: number;
  filter?: Record<string, string | number | boolean>;
  minScore?: number;
}

export interface VectorSearchResult<T> {
  id: string;
  data: T;
  score: number;
  distance?: number;
}

export interface TableStats {
  rowCount: number;
}

// --- Search result types ---

export interface CodeSearchResult {
  id: string;
  fileName: string;
  filePath: string;
  functionName: string;
  className: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  category: string;
  score: number;
}

export interface DocsSearchResult {
  id: string;
  title: string;
  section: string;
  content: string;
  source: string;
  score: number;
}

export interface CodeStats {
  totalChunks: number;
  uniqueFiles: number;
  uniqueClasses: number;
  category: string;
}

export interface DocsStats {
  totalChunks: number;
  uniqueSources: number;
}

// --- Zod input schemas ---

export const searchCodeSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural language description of what you're looking for in the game source code"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Number of results to return (default 5, max 20)"),
  classFilter: z
    .string()
    .optional()
    .describe("Filter results to a specific class name"),
});

export type SearchCodeInput = z.infer<typeof searchCodeSchema>;

export const searchPluginsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural language description of what plugin functionality you're looking for"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Number of results to return (default 5, max 20)"),
  pluginFilter: z
    .string()
    .optional()
    .describe("Filter results to a specific plugin name (e.g., SimpleUGC, AdvancedSessions)"),
});

export type SearchPluginsInput = z.infer<typeof searchPluginsSchema>;

export const searchDocsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural language question about Longvinter modding"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Number of results to return (default 5, max 20)"),
});

export type SearchDocsInput = z.infer<typeof searchDocsSchema>;

export const emptySchema = z.object({});
export type EmptyInput = z.infer<typeof emptySchema>;

// --- Tool types ---

export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: { executionTimeMs: number };
}

export type ToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: ToolHandler<TInput, TOutput>;
}

export interface ToolContext {
  embedding: EmbeddingProvider | undefined;
  vectorStore: VectorStoreInterface;
  configError?: string;
  tables: {
    code: string;
    plugins: string;
    docs: string;
  };
}

// --- Provider interfaces ---

export interface EmbeddingProvider {
  embedBatch(
    texts: string[],
    purpose: EmbeddingPurpose,
    mode: "document" | "query",
    onProgress?: (current: number, total: number) => void
  ): Promise<EmbeddingResult>;

  embedQuery(text: string, purpose: EmbeddingPurpose): Promise<number[]>;
}

export interface VectorStoreInterface {
  connect(): Promise<void>;
  close(): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;
  dropTable(tableName: string): Promise<void>;
  insert<T extends Record<string, unknown>>(
    tableName: string,
    records: Array<T & { vector: number[] }>
  ): Promise<void>;
  append<T extends Record<string, unknown>>(
    tableName: string,
    records: Array<T & { vector: number[] }>
  ): Promise<void>;
  search<T>(
    tableName: string,
    queryVector: number[],
    options: VectorSearchOptions
  ): Promise<VectorSearchResult<T>[]>;
  getStats(tableName: string): Promise<TableStats>;
  queryAll<T>(tableName: string, batchSize?: number): AsyncGenerator<T[], void, unknown>;
}
