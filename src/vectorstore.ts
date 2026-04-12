/**
 * LanceDB Vector Store for Longvinter RAG
 */

import * as lancedb from "@lancedb/lancedb";
import type {
  VectorStoreInterface,
  VectorSearchOptions,
  VectorSearchResult,
  TableStats,
} from "./types.js";

const DEFAULT_BATCH_SIZE = 5000;

export class LanceDBStore implements VectorStoreInterface {
  private dbPath: string;
  private connection: lancedb.Connection | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    if (!this.connection) {
      this.connection = await lancedb.connect(this.dbPath);
    }
  }

  async close(): Promise<void> {
    this.connection = null;
  }

  private async getConnection(): Promise<lancedb.Connection> {
    if (!this.connection) await this.connect();
    return this.connection!;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const db = await this.getConnection();
    try {
      await db.openTable(tableName);
      return true;
    } catch {
      return false;
    }
  }

  async dropTable(tableName: string): Promise<void> {
    const db = await this.getConnection();
    try {
      await db.dropTable(tableName);
    } catch {
      // Table doesn't exist
    }
  }

  async insert<T extends Record<string, unknown>>(
    tableName: string,
    records: Array<T & { vector: number[] }>
  ): Promise<void> {
    const db = await this.getConnection();
    const data = records.map((r) => this.prepareRecord(r));
    await this.dropTable(tableName);
    await db.createTable(tableName, data);
  }

  async append<T extends Record<string, unknown>>(
    tableName: string,
    records: Array<T & { vector: number[] }>
  ): Promise<void> {
    const db = await this.getConnection();
    const data = records.map((r) => this.prepareRecord(r));
    const table = await db.openTable(tableName);
    await table.add(data);
  }

  async search<T>(
    tableName: string,
    queryVector: number[],
    options: VectorSearchOptions
  ): Promise<VectorSearchResult<T>[]> {
    const db = await this.getConnection();
    const table = await db.openTable(tableName);

    let query = table.query().nearestTo(queryVector);

    if (options.filter) {
      const filterStr = this.buildFilterString(options.filter);
      if (filterStr) query = query.where(filterStr);
    }

    query = query.limit(options.limit);
    const results = await query.toArray();

    const mapped: VectorSearchResult<T>[] = [];
    for (const row of results) {
      const rowData = row as Record<string, unknown>;
      const distance = rowData._distance as number | undefined;
      const score = distance != null ? 1 - distance : 1;

      if (options.minScore !== undefined && score < options.minScore) continue;

      mapped.push({
        id: rowData.id as string,
        data: this.parseRecord<T>(rowData),
        score,
        distance,
      });
    }

    return mapped;
  }

  async getStats(tableName: string): Promise<TableStats> {
    const db = await this.getConnection();
    const table = await db.openTable(tableName);
    const rowCount = await table.countRows();
    return { rowCount };
  }

  async *queryAll<T>(
    tableName: string,
    batchSize: number = DEFAULT_BATCH_SIZE
  ): AsyncGenerator<T[], void, unknown> {
    const db = await this.getConnection();
    const table = await db.openTable(tableName);
    let offset = 0;

    while (true) {
      const batch = await table.query().limit(batchSize).offset(offset).toArray();
      if (batch.length === 0) break;
      yield batch.map((row) => this.parseRecord<T>(row as Record<string, unknown>));
      offset += batch.length;
      if (batch.length < batchSize) break;
    }
  }

  private prepareRecord<T extends Record<string, unknown>>(
    record: T & { vector: number[] }
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "vector") {
        prepared[key] = value;
      } else if (Array.isArray(value)) {
        prepared[key] = JSON.stringify(value);
      } else if (value === undefined) {
        prepared[key] = "";
      } else {
        prepared[key] = value;
      }
    }
    return prepared;
  }

  private parseRecord<T>(row: Record<string, unknown>): T {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === "_distance" || key === "vector") continue;
      if (typeof value === "string") {
        if (value.startsWith("[") && value.endsWith("]")) {
          try {
            parsed[key] = JSON.parse(value);
            continue;
          } catch { /* keep as string */ }
        }
        parsed[key] = value === "" ? undefined : value;
      } else {
        parsed[key] = value;
      }
    }
    return parsed as T;
  }

  private buildFilterString(filter: Record<string, string | number | boolean>): string {
    return Object.entries(filter)
      .map(([key, value]) => {
        const quotedKey = "`" + key + "`";
        if (typeof value === "string") {
          const escaped = value.replace(/'/g, "''");
          return `${quotedKey} = '${escaped}'`;
        }
        return `${quotedKey} = ${value}`;
      })
      .join(" AND ");
  }
}
