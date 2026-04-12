/**
 * MCP Server for Longvinter RAG
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ToolRegistry } from "./tool-registry.js";
import type { ToolContext, CodeSearchResult, DocsSearchResult, CodeStats, DocsStats } from "./types.js";

function formatToolResult(toolName: string, data: unknown): string {
  switch (toolName) {
    case "search_longvinter_code":
    case "search_longvinter_plugins":
      return formatCodeResults(data as CodeSearchResult[]);
    case "search_longvinter_docs":
      return formatDocsResults(data as DocsSearchResult[]);
    case "longvinter_code_stats":
    case "longvinter_plugins_stats":
      return formatCodeStatsResult(data as CodeStats);
    case "longvinter_docs_stats":
      return formatDocsStatsResult(data as DocsStats);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatCodeResults(results: CodeSearchResult[]): string {
  if (results.length === 0) return "No results found for your query.";
  return results
    .map((r, i) => {
      const header = r.className
        ? `${r.className}::${r.functionName}`
        : r.functionName || r.fileName;
      return `## Result ${i + 1}: ${header}
**File:** ${r.filePath}:${r.lineStart}-${r.lineEnd}
**Category:** ${r.category}
**Relevance:** ${(r.score * 100).toFixed(1)}%

\`\`\`cpp
${r.content}
\`\`\``;
    })
    .join("\n\n---\n\n");
}

function formatDocsResults(results: DocsSearchResult[]): string {
  if (results.length === 0) return "No results found for your query.";
  return results
    .map((r, i) => {
      return `## Result ${i + 1}: ${r.title}
**Section:** ${r.section}
**Source:** ${r.source}
**Relevance:** ${(r.score * 100).toFixed(1)}%

${r.content}`;
    })
    .join("\n\n---\n\n");
}

function formatCodeStatsResult(stats: CodeStats): string {
  return `# Longvinter ${stats.category} Statistics

- **Total Chunks:** ${stats.totalChunks.toLocaleString()}
- **Unique Files:** ${stats.uniqueFiles.toLocaleString()}
- **Unique Classes:** ${stats.uniqueClasses.toLocaleString()}

The database is ready for semantic code search.`;
}

function formatDocsStatsResult(stats: DocsStats): string {
  return `# Longvinter Documentation Statistics

- **Total Chunks:** ${stats.totalChunks.toLocaleString()}
- **Unique Sources:** ${stats.uniqueSources.toLocaleString()}

The database is ready for documentation search.`;
}

export async function startMCPServer(
  registry: ToolRegistry,
  context: ToolContext
): Promise<void> {
  const server = new McpServer({
    name: "longvinter-rag",
    version: "1.0.0",
  });

  for (const tool of registry.getAll()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (input: unknown) => {
        const result = await registry.execute(tool.name, input, context);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        const formatted = formatToolResult(tool.name, result.data);
        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      }
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
