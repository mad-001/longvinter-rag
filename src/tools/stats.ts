/**
 * Stats tools for Longvinter RAG
 */

import { emptySchema, type EmptyInput, type ToolDefinition, type ToolContext, type ToolResult, type CodeStats, type DocsStats } from "../types.js";

export const codeStatsTool: ToolDefinition<EmptyInput, CodeStats> = {
  name: "longvinter_code_stats",
  description: "Get statistics about the indexed Longvinter game source code.",
  inputSchema: emptySchema,

  async handler(_input, context): Promise<ToolResult<CodeStats>> {
    const tableStats = await context.vectorStore.getStats(context.tables.code);
    const fileNames = new Set<string>();
    const classNames = new Set<string>();

    for await (const batch of context.vectorStore.queryAll<{
      fileName: string;
      className: string;
    }>(context.tables.code)) {
      for (const row of batch) {
        if (row.fileName) fileNames.add(row.fileName);
        if (row.className) classNames.add(row.className);
      }
    }

    return {
      success: true,
      data: {
        totalChunks: tableStats.rowCount,
        uniqueFiles: fileNames.size,
        uniqueClasses: classNames.size,
        category: "Game Source Code",
      },
    };
  },
};

export const pluginsStatsTool: ToolDefinition<EmptyInput, CodeStats> = {
  name: "longvinter_plugins_stats",
  description: "Get statistics about the indexed Longvinter plugin source code.",
  inputSchema: emptySchema,

  async handler(_input, context): Promise<ToolResult<CodeStats>> {
    const tableStats = await context.vectorStore.getStats(context.tables.plugins);
    const fileNames = new Set<string>();
    const classNames = new Set<string>();

    for await (const batch of context.vectorStore.queryAll<{
      fileName: string;
      className: string;
    }>(context.tables.plugins)) {
      for (const row of batch) {
        if (row.fileName) fileNames.add(row.fileName);
        if (row.className) classNames.add(row.className);
      }
    }

    return {
      success: true,
      data: {
        totalChunks: tableStats.rowCount,
        uniqueFiles: fileNames.size,
        uniqueClasses: classNames.size,
        category: "Plugin Source Code",
      },
    };
  },
};

export const docsStatsTool: ToolDefinition<EmptyInput, DocsStats> = {
  name: "longvinter_docs_stats",
  description: "Get statistics about the indexed Longvinter documentation.",
  inputSchema: emptySchema,

  async handler(_input, context): Promise<ToolResult<DocsStats>> {
    const tableStats = await context.vectorStore.getStats(context.tables.docs);
    const sources = new Set<string>();

    for await (const batch of context.vectorStore.queryAll<{ source: string }>(context.tables.docs)) {
      for (const row of batch) {
        if (row.source) sources.add(row.source);
      }
    }

    return {
      success: true,
      data: {
        totalChunks: tableStats.rowCount,
        uniqueSources: sources.size,
      },
    };
  },
};
