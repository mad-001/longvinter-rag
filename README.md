# Longvinter RAG MCP Server

A semantic search [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for the [Longvinter](https://www.longvinter.com/) modding codebase. Enables AI assistants like Claude to search and understand Longvinter's game source code, plugin code, and modding documentation using natural language queries.

Built with [Voyage AI](https://www.voyageai.com/) embeddings and [LanceDB](https://lancedb.com/) vector storage.

## Features

- **search_longvinter_code** - Semantic search over Longvinter's C++ game source code (components, game modes, character logic)
- **search_longvinter_plugins** - Search UE4 plugin source code (SimpleUGC, AdvancedSessions, ProceduralDungeon, etc.)
- **search_longvinter_docs** - Search modding and map creation documentation
- **longvinter_code_stats** / **longvinter_plugins_stats** / **longvinter_docs_stats** - Database statistics

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Voyage AI API key](https://www.voyageai.com/) (free tier available - 200M free tokens)
- [Claude Code](https://claude.ai/code) or another MCP-compatible client
- The [Longvinter modding source code](https://github.com/Uuvana-Studios/longvinter-modding) (see Setup)

## Setup

### 1. Clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/longvinter-rag.git
cd longvinter-rag
```

### 2. Clone the Longvinter modding repo

The Longvinter modding source code is required for indexing but is **not included** in this repo. Clone it as a sibling directory:

```bash
cd ..
git clone https://github.com/Uuvana-Studios/longvinter-modding.git longvinter-modding
```

Your directory structure should look like:

```
parent-folder/
  longvinter-rag/       # This repo
  longvinter-modding/   # Longvinter modding source (Uuvana Studios)
```

### 3. Install dependencies

```bash
cd longvinter-rag
npm install
```

### 4. Configure API key

Create a `.env` file in the `longvinter-rag` directory:

```bash
VOYAGE_API_KEY=pa-your-key-here
```

Get a free API key at [voyageai.com](https://www.voyageai.com/). The free tier includes 200M tokens which is more than enough for indexing.

> **Tip:** Adding a payment method to your Voyage AI account unlocks higher rate limits (from 3 RPM to standard), making ingestion much faster. You still keep the free tokens.

### 5. Run ingestion

Index the Longvinter codebase into the vector database:

```bash
# Index everything (code + plugins + docs)
npm run ingest-all

# Or index individually
npm run ingest              # Game source code + plugins
npm run ingest -- --code-only    # Only game source code
npm run ingest -- --plugins-only # Only plugin source code
npm run ingest-docs         # Only documentation
```

> **Note:** On the free Voyage AI tier, plugin ingestion can take a while due to rate limits. Game source code and docs index quickly.

### 6. Add to Claude Code

```bash
claude mcp add longvinter-rag -- bash -c "cd '/path/to/longvinter-rag' && set -a && source .env && set +a && npx tsx src/index.ts"
```

Restart Claude Code and the tools will be available.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `VOYAGE_API_KEY` | (required) | Voyage AI API key |
| `LONGVINTER_RAG_DB_PATH` | `./data/lancedb` | Path to LanceDB database |
| `LONGVINTER_MODDING_PATH` | `../longvinter-modding` | Path to the Longvinter modding repo |

## Project Structure

```
longvinter-rag/
  src/
    index.ts          # Entry point - starts MCP server
    mcp-server.ts     # MCP protocol server
    tool-registry.ts  # Tool registration and execution
    types.ts          # TypeScript types and Zod schemas
    embedding.ts      # Voyage AI embedding provider
    vectorstore.ts    # LanceDB vector store
    cpp-parser.ts     # C++ source code parser
    ingest.ts         # Code ingestion script
    ingest-docs.ts    # Documentation ingestion script
    ingest-all.ts     # Run all ingestion scripts
    tools/
      search-code.ts     # Game source code search
      search-plugins.ts  # Plugin source code search
      search-docs.ts     # Documentation search
      stats.ts           # Database statistics tools
  data/               # LanceDB database (generated, not committed)
  .env                # API keys (not committed)
```

## How It Works

1. **Parsing** - C++ source files are parsed into function/method-level chunks with metadata (file path, class name, function name, line numbers)
2. **Embedding** - Each chunk is embedded using Voyage AI's `voyage-code-3` model (code) or `voyage-4-large` model (docs)
3. **Storage** - Embeddings are stored in a local LanceDB vector database
4. **Search** - Natural language queries are embedded and matched against stored vectors using similarity search
5. **MCP** - Results are served via the Model Context Protocol for integration with Claude and other AI assistants

## Attribution

This tool indexes the [Longvinter modding source code](https://github.com/Uuvana-Studios/longvinter-modding) by [Uuvana Studios](https://www.uuvana.com/).

The Longvinter modding source code is licensed under [Creative Commons Attribution-NonCommercial (CC BY-NC)](https://creativecommons.org/licenses/by-nc/4.0/). This tool is provided for non-commercial use only, in compliance with that license.

Longvinter is a trademark of Uuvana Studios. This project is not affiliated with or endorsed by Uuvana Studios.

## License

MIT - The RAG tool code in this repository is original work. The Longvinter game source code it indexes is subject to its own [CC BY-NC license](https://github.com/Uuvana-Studios/longvinter-modding/blob/main/LICENSE).
