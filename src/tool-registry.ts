/**
 * Tool Registry for Longvinter RAG
 */

import { z, ZodSchema } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute<TOutput>(
    name: string,
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found` };
    }

    const startTime = Date.now();

    try {
      const validatedInput = tool.inputSchema.parse(input);
      const result = await tool.handler(validatedInput, context);
      if (!result.metadata) {
        result.metadata = { executionTimeMs: Date.now() - startTime };
      }
      return result as ToolResult<TOutput>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(", ")}`,
          metadata: { executionTimeMs: Date.now() - startTime },
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }
}

/**
 * Convert a Zod schema to JSON Schema format
 */
export function zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = schema._def as any;

  if (def.typeName === "ZodObject") {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as ZodSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldDef = fieldSchema._def as any;
      const isOptional = fieldDef.typeName === "ZodOptional" || fieldDef.typeName === "ZodDefault";
      if (!isOptional) required.push(key);

      let innerSchema = fieldSchema;
      if (fieldDef.typeName === "ZodOptional") innerSchema = fieldDef.innerType;
      else if (fieldDef.typeName === "ZodDefault") innerSchema = fieldDef.innerType;

      properties[key] = zodTypeToJsonSchema(innerSchema);
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return zodTypeToJsonSchema(schema);
}

function zodTypeToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = schema._def as any;
  const result: Record<string, unknown> = {};

  if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault") {
    return zodTypeToJsonSchema(def.innerType);
  }

  if (def.description) result.description = def.description;

  switch (def.typeName) {
    case "ZodString":
      result.type = "string";
      break;
    case "ZodNumber":
      result.type = "number";
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "int") result.type = "integer";
          if (check.kind === "min") result.minimum = check.value;
          if (check.kind === "max") result.maximum = check.value;
        }
      }
      break;
    case "ZodBoolean":
      result.type = "boolean";
      break;
    case "ZodEnum":
      result.type = "string";
      result.enum = def.values;
      break;
    case "ZodArray":
      result.type = "array";
      result.items = zodTypeToJsonSchema(def.type);
      break;
    default:
      result.type = "string";
  }

  return result;
}
