/**
 * Search Longvinter Game Source Code
 */

import { searchCodeSchema, type SearchCodeInput, type ToolDefinition, type ToolContext, type ToolResult, type CodeSearchResult } from "../types.js";

export const searchCodeTool: ToolDefinition<SearchCodeInput, CodeSearchResult[]> = {
  name: "search_longvinter_code",
  description:
    "Search the Longvinter game source code (C++) using semantic search. " +
    "Use this to find game logic, components, character code, game modes, and other core functionality. " +
    "Returns relevant C++ code with file paths and line numbers.",
  inputSchema: searchCodeSchema,

  async handler(input, context): Promise<ToolResult<CodeSearchResult[]>> {
    if (context.configError || !context.embedding) {
      return { success: false, error: context.configError || "Embedding provider not configured" };
    }

    const limit = Math.min(Math.max(1, input.limit ?? 5), 20);
    const queryVector = await context.embedding.embedQuery(input.query, "code");
    const filter = input.classFilter ? { className: input.classFilter } : undefined;

    const results = await context.vectorStore.search<CodeSearchResult>(
      context.tables.code,
      queryVector,
      { limit, filter }
    );

    const data: CodeSearchResult[] = results.map((r) => ({
      id: r.data.id,
      fileName: r.data.fileName,
      filePath: r.data.filePath,
      functionName: r.data.functionName,
      className: r.data.className,
      content: r.data.content,
      lineStart: r.data.lineStart,
      lineEnd: r.data.lineEnd,
      category: r.data.category,
      score: r.score,
    }));

    return { success: true, data };
  },
};
