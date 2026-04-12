# Longvinter RAG MCP Server

A semantic search [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for the [Longvinter](https://www.longvinter.com/) modding codebase. Enables AI assistants like Claude to search and understand Longvinter's game source code, plugin code, and modding documentation using natural language queries.

Built with [Voyage AI](https://www.voyageai.com/) embeddings and [LanceDB](https://lancedb.com/) vector storage.

## Features

- **search_longvinter_code** - Semantic search over Longvinter's C++ game source code (components, game modes, character logic)
- **search_longvinter_plugins** - Search UE4 plugin source code (SimpleUGC, AdvancedSessions, ProceduralDungeon, etc.)
- **search_longvinter_docs** - Search modding and map creation documentation
- **longvinter_code_stats** / **longvinter_plugins_stats** / **longvinter_docs_stats** - Database statistics

## Quick Start

The pre-built vector database is included - no game source code download or indexing required.

### 1. Clone this repo

```bash
git clone https://github.com/mad-001/longvinter-rag.git
cd longvinter-rag
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure API key

Create a `.env` file in the `longvinter-rag` directory:

```bash
VOYAGE_API_KEY=pa-your-key-here
```

Get a free API key at [voyageai.com](https://www.voyageai.com/) - 200M free tokens, no credit card required. The key is needed to convert your search queries into vectors.

### 4. Add to Claude Code

```bash
claude mcp add longvinter-rag -- bash -c "cd '/path/to/longvinter-rag' && set -a && source .env && set +a && npx tsx src/index.ts"
```

Replace `/path/to/longvinter-rag` with the actual path. Restart Claude Code and the tools will be available.

## Rebuilding the Database (Optional)

If you want to re-index from the latest Longvinter source code (e.g. after a game update), you can rebuild the database yourself. This requires a Voyage AI API key and the Longvinter modding source code.

### 1. Clone the Longvinter modding repo

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

### 2. Configure API key

Create a `.env` file in the `longvinter-rag` directory:

```bash
VOYAGE_API_KEY=pa-your-key-here
```

Get a free API key at [voyageai.com](https://www.voyageai.com/). The free tier includes 200M tokens which is more than enough for indexing.

> **Tip:** Adding a payment method to your Voyage AI account unlocks higher rate limits (from 3 RPM to standard), making ingestion much faster. You still keep the free tokens.

### 3. Run ingestion

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

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `VOYAGE_API_KEY` | (required) | Voyage AI API key (free tier available) |
| `LONGVINTER_RAG_DB_PATH` | `./data/lancedb` | Path to LanceDB database |
| `LONGVINTER_MODDING_PATH` | `../longvinter-modding` | Path to the Longvinter modding repo (only for rebuilding) |

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
