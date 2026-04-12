/**
 * Search Longvinter Documentation
 */

import { searchDocsSchema, type SearchDocsInput, type ToolDefinition, type ToolContext, type ToolResult, type DocsSearchResult } from "../types.js";

export const searchDocsTool: ToolDefinition<SearchDocsInput, DocsSearchResult[]> = {
  name: "search_longvinter_docs",
  description:
    "Search Longvinter modding documentation using semantic search. " +
    "Covers the modding guide, map creation guide, setup instructions, and more. " +
    "Use this to understand how to create mods, add items, weapons, placeables, and package mods.",
  inputSchema: searchDocsSchema,

  async handler(input, context): Promise<ToolResult<DocsSearchResult[]>> {
    if (context.configError || !context.embedding) {
      return { success: false, error: context.configError || "Embedding provider not configured" };
    }

    const limit = Math.min(Math.max(1, input.limit ?? 5), 20);
    const queryVector = await context.embedding.embedQuery(input.query, "text");

    const results = await context.vectorStore.search<DocsSearchResult>(
      context.tables.docs,
      queryVector,
      { limit }
    );

    const data: DocsSearchResult[] = results.map((r) => ({
      id: r.data.id,
      title: r.data.title,
      section: r.data.section,
      content: r.data.content,
      source: r.data.source,
      score: r.score,
    }));

    return { success: true, data };
  },
};
