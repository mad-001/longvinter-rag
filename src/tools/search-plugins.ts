/**
 * Search Longvinter Plugin Source Code
 */

import { searchPluginsSchema, type SearchPluginsInput, type ToolDefinition, type ToolContext, type ToolResult, type CodeSearchResult } from "../types.js";

export const searchPluginsTool: ToolDefinition<SearchPluginsInput, CodeSearchResult[]> = {
  name: "search_longvinter_plugins",
  description:
    "Search Longvinter UE4 plugin source code using semantic search. " +
    "Covers plugins like SimpleUGC, AdvancedSessions, SteamCore, ProceduralDungeon, VaRestPlugin, and more. " +
    "Use this to understand plugin APIs and integration points for modding.",
  inputSchema: searchPluginsSchema,

  async handler(input, context): Promise<ToolResult<CodeSearchResult[]>> {
    if (context.configError || !context.embedding) {
      return { success: false, error: context.configError || "Embedding provider not configured" };
    }

    const limit = Math.min(Math.max(1, input.limit ?? 5), 20);
    const queryVector = await context.embedding.embedQuery(input.query, "code");
    const filter = input.pluginFilter ? { category: input.pluginFilter } : undefined;

    const results = await context.vectorStore.search<CodeSearchResult>(
      context.tables.plugins,
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
