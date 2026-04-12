/**
 * C++ Source Code Parser
 *
 * Parses C++ source files into function/method chunks for embedding.
 * Uses heuristic-based parsing (not a full AST parser) since we only
 * need to extract function boundaries and class context.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface CppChunk {
  id: string;
  fileName: string;
  filePath: string;
  functionName: string;
  className: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  category: string;
  fileHash: string;
}

/**
 * Extract the plugin name from a file path.
 * e.g., "Plugins/SimpleUGC/Source/..." -> "SimpleUGC"
 */
function getPluginName(filePath: string): string {
  const match = filePath.match(/Plugins[/\\]([^/\\]+)/);
  return match ? match[1] : "Unknown";
}

/**
 * Extract class name from a C++ file.
 * Looks for class declarations and ClassName:: patterns.
 */
function extractClassName(content: string, fileName: string): string {
  // Try to find class declaration
  const classMatch = content.match(/\bclass\s+(?:\w+_API\s+)?(\w+)\s*(?::\s*(?:public|private|protected))?/);
  if (classMatch) return classMatch[1];

  // Try ClassName:: pattern from implementations
  const implMatch = content.match(/(\w+)::\w+\s*\(/);
  if (implMatch) return implMatch[1];

  // Fall back to filename without extension
  return path.basename(fileName, path.extname(fileName));
}

/**
 * Find matching closing brace for an opening brace.
 */
function findMatchingBrace(lines: string[], startLine: number, startCol: number): number {
  let depth = 0;
  let foundFirst = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const startJ = i === startLine ? startCol : 0;

    for (let j = startJ; j < line.length; j++) {
      // Skip string literals and comments (basic)
      if (line[j] === '"' && (j === 0 || line[j - 1] !== '\\')) {
        const endQuote = line.indexOf('"', j + 1);
        if (endQuote !== -1) j = endQuote;
        continue;
      }
      if (line[j] === '/' && j + 1 < line.length && line[j + 1] === '/') break;

      if (line[j] === '{') {
        depth++;
        foundFirst = true;
      } else if (line[j] === '}') {
        depth--;
        if (foundFirst && depth === 0) return i;
      }
    }
  }
  return lines.length - 1;
}

/**
 * C++ function signature pattern.
 * Matches: ReturnType [ClassName::]FunctionName(params) [const] [override] {
 */
const FUNC_PATTERN = /^[\t ]*(?:(?:virtual|static|inline|explicit|FORCEINLINE|UFUNCTION\(.*?\))\s+)*(?:[\w:*&<>,\s]+?\s+)?([\w~]+)\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?(?:final\s*)?(?:noexcept\s*)?(?:->[\w:*&<>\s]+)?\s*\{?\s*$/;

/**
 * Class method implementation pattern: ReturnType ClassName::MethodName(...)
 */
const METHOD_IMPL_PATTERN = /^[\t ]*(?:[\w:*&<>,\s]+?\s+)?(\w+)::(\w+)\s*\([^)]*\)/;

/**
 * Parse a single C++ file into chunks.
 */
export function parseFile(
  filePath: string,
  content: string,
  isPlugin: boolean
): CppChunk[] {
  const chunks: CppChunk[] = [];
  const lines = content.split("\n");
  const fileName = path.basename(filePath);
  const fileHash = crypto.createHash("md5").update(content).digest("hex");
  const defaultClassName = extractClassName(content, fileName);
  const category = isPlugin ? getPluginName(filePath) : "GameSource";

  // Track which lines have been assigned to chunks
  const assignedLines = new Set<number>();

  // First pass: find function/method definitions with bodies
  for (let i = 0; i < lines.length; i++) {
    if (assignedLines.has(i)) continue;

    const line = lines[i];

    // Skip preprocessor, comments, blank lines
    if (line.trim().startsWith("#") || line.trim().startsWith("//") || line.trim() === "") continue;

    // Check for method implementation (ClassName::Method)
    const methodMatch = line.match(METHOD_IMPL_PATTERN);
    if (methodMatch) {
      const className = methodMatch[1];
      const funcName = methodMatch[2];

      // Find the opening brace
      let braceLineIdx = i;
      let braceCol = line.indexOf("{");

      if (braceCol === -1) {
        // Brace might be on next line(s)
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const bracePos = lines[j].indexOf("{");
          if (bracePos !== -1) {
            braceLineIdx = j;
            braceCol = bracePos;
            break;
          }
        }
      }

      if (braceCol !== -1) {
        const endLine = findMatchingBrace(lines, braceLineIdx, braceCol);
        // Include a few lines before for comments/decorators
        const startLine = Math.max(0, i - 3);
        const actualStart = findFirstRelevantLine(lines, startLine, i);

        const chunkContent = lines.slice(actualStart, endLine + 1).join("\n");

        if (chunkContent.trim().length > 10) {
          chunks.push({
            id: `${filePath}:${funcName}:${actualStart + 1}`,
            fileName,
            filePath: normalizeFilePath(filePath),
            functionName: funcName,
            className,
            content: chunkContent,
            lineStart: actualStart + 1,
            lineEnd: endLine + 1,
            category,
            fileHash,
          });

          for (let k = actualStart; k <= endLine; k++) assignedLines.add(k);
          i = endLine;
          continue;
        }
      }
    }

    // Check for standalone function definition
    const funcMatch = line.match(FUNC_PATTERN);
    if (funcMatch && !line.includes(";")) {
      const funcName = funcMatch[1];
      if (!funcName || ["if", "else", "for", "while", "switch", "catch", "do", "return"].includes(funcName)) continue;

      let braceLineIdx = i;
      let braceCol = line.indexOf("{");

      if (braceCol === -1) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const bracePos = lines[j].indexOf("{");
          if (bracePos !== -1) {
            braceLineIdx = j;
            braceCol = bracePos;
            break;
          }
        }
      }

      if (braceCol !== -1) {
        const endLine = findMatchingBrace(lines, braceLineIdx, braceCol);
        const startLine = Math.max(0, i - 3);
        const actualStart = findFirstRelevantLine(lines, startLine, i);

        const chunkContent = lines.slice(actualStart, endLine + 1).join("\n");

        if (chunkContent.trim().length > 10) {
          chunks.push({
            id: `${filePath}:${funcName}:${actualStart + 1}`,
            fileName,
            filePath: normalizeFilePath(filePath),
            functionName: funcName,
            className: defaultClassName,
            content: chunkContent,
            lineStart: actualStart + 1,
            lineEnd: endLine + 1,
            category,
            fileHash,
          });

          for (let k = actualStart; k <= endLine; k++) assignedLines.add(k);
          i = endLine;
        }
      }
    }
  }

  // If no functions found (e.g., header with only declarations), chunk the whole file
  if (chunks.length === 0 && content.trim().length > 20) {
    // Split into logical chunks of ~50 lines for headers
    const chunkSize = 50;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, lines.length);
      const chunkContent = lines.slice(i, end).join("\n");
      if (chunkContent.trim().length > 20) {
        chunks.push({
          id: `${filePath}:chunk:${i + 1}`,
          fileName,
          filePath: normalizeFilePath(filePath),
          functionName: "",
          className: defaultClassName,
          content: chunkContent,
          lineStart: i + 1,
          lineEnd: end,
          category,
          fileHash,
        });
      }
    }
  }

  return chunks;
}

/**
 * Find the first relevant line before a function definition (skip blank lines).
 */
function findFirstRelevantLine(lines: string[], from: number, to: number): number {
  for (let i = from; i < to; i++) {
    const trimmed = lines[i].trim();
    if (trimmed !== "" && !trimmed.startsWith("#")) return i;
  }
  return to;
}

/**
 * Normalize file path to be relative to the project root.
 */
function normalizeFilePath(filePath: string): string {
  // Make paths relative and use forward slashes
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.indexOf("Source/");
  if (idx !== -1) return normalized.substring(idx);
  const pluginIdx = normalized.indexOf("Plugins/");
  if (pluginIdx !== -1) return normalized.substring(pluginIdx);
  return path.basename(normalized);
}

/**
 * Parse all C++ files in a directory recursively.
 */
export async function parseDirectory(
  dir: string,
  isPlugin: boolean,
  onProgress?: (current: number, total: number, file: string) => void
): Promise<{ chunks: CppChunk[]; errors: string[] }> {
  const chunks: CppChunk[] = [];
  const errors: string[] = [];

  const files = collectCppFiles(dir);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) onProgress(i + 1, files.length, file);

    try {
      const content = fs.readFileSync(file, "utf-8");
      const fileChunks = parseFile(file, content, isPlugin);
      chunks.push(...fileChunks);
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { chunks, errors };
}

/**
 * Collect all .cpp and .h files recursively.
 */
function collectCppFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // Skip intermediate build/generated directories
        if (["Intermediate", "ThirdParty", "Binaries", "obj", ".git"].includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && /\.(cpp|h|hpp|cc|cxx)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
