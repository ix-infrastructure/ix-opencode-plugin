/**
 * ix-locate — text / semantic search
 *
 * Searches for a text pattern across the indexed repository using `ix text`.
 * Use when you have a pattern or keyword, not an exact symbol name.
 * For exact symbol lookup use ix-query instead.
 */

import { $ } from "bun";

export const name = "ix-locate";
export const description =
  "Search for a text pattern or keyword across the indexed codebase. Returns ranked file hits with location and snippet. Use when you have a pattern, not an exact symbol name — for exact names use ix-query.";

export const parameters = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description: "Text pattern or keyword to search for",
    },
    limit: {
      type: "number",
      description: "Max results to return. Default: 20, max: 100",
      default: 20,
    },
    path: {
      type: "string",
      description: "Optional: restrict search to a directory path prefix",
    },
    language: {
      type: "string",
      description: "Optional: restrict to a specific language (e.g. 'typescript', 'python')",
    },
  },
  required: ["pattern"],
} as const;

type Params = {
  pattern: string;
  limit?: number;
  path?: string;
  language?: string;
};

type Context = {
  directory: string;
  worktree?: string;
};

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;
  const limit = Math.min(params.limit ?? 20, 100);

  const args = ["ix", "text", params.pattern, "--limit", String(limit), "--format", "json"];
  if (params.path) args.push("--path", params.path);
  if (params.language) args.push("--language", params.language);

  let output: string;
  try {
    output = await $`${args}`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(params.pattern, msg);
  }

  let hits: {
    path?: string;
    line_start?: number;
    line_end?: number;
    snippet?: string;
    score?: number;
    language?: string;
  }[];
  try {
    const parsed = JSON.parse(output);
    hits = Array.isArray(parsed) ? parsed : (parsed.hits ?? []);
  } catch {
    return `## ix-locate: ${params.pattern}\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  if (hits.length === 0) {
    const scopeNote = params.path ? ` in \`${params.path}\`` : "";
    return `## ix-locate: ${params.pattern}\n\nNo matches found${scopeNote}. Try a broader pattern or check that the graph is indexed.`;
  }

  const scopeNote = params.path ? ` in \`${params.path}\`` : "";
  const lines = [
    `## ix-locate: ${params.pattern}`,
    "",
    `**${hits.length} match${hits.length === 1 ? "" : "es"}${scopeNote}:**`,
    "",
  ];

  for (const hit of hits) {
    const loc = hit.line_start !== undefined ? `:${hit.line_start}` : "";
    const lang = hit.language ? ` (${hit.language})` : "";
    lines.push(`**\`${hit.path ?? "?"}${loc}\`**${lang}`);
    if (hit.snippet) {
      lines.push("```");
      lines.push(hit.snippet.trim().slice(0, 300));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
}

function unavailable(pattern: string, err: string): string {
  return [
    `## ix-locate: ${pattern}`,
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and the graph is indexed.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
