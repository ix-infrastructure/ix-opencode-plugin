/**
 * ix-query — graph entity lookup
 *
 * Locates and explains a symbol, class, file, or subsystem using the Ix graph.
 * Runs `ix locate` + `ix explain` and returns a formatted markdown summary.
 */

import { $ } from "bun";

export const name = "ix-query";
export const description =
  "Look up a symbol, class, file, or subsystem in the Ix graph. Returns role, connections, and importance from the graph without reading source code.";

export const parameters = {
  type: "object",
  properties: {
    symbol: {
      type: "string",
      description: "Symbol name, file path, or subsystem name to look up",
    },
    kind: {
      type: "string",
      description:
        "Optional: narrow to a specific kind (function, class, file, module)",
      enum: ["function", "class", "file", "module"],
    },
    path: {
      type: "string",
      description: "Optional: narrow results to a specific directory path",
    },
  },
  required: ["symbol"],
} as const;

type Params = {
  symbol: string;
  kind?: string;
  path?: string;
};

type Context = {
  directory: string;
  worktree?: string;
};

export async function execute(
  params: Params,
  context: Context
): Promise<string> {
  const dir = context.worktree ?? context.directory;

  // Build locate args
  const locateArgs = ["ix", "locate", params.symbol, "--format", "json"];
  if (params.kind) locateArgs.push("--kind", params.kind);
  if (params.path) locateArgs.push("--path", params.path);

  let locateOutput = "";
  let explainOutput = "";

  try {
    locateOutput = await $`${locateArgs}`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fallbackUnavailable("ix-query", params.symbol, msg);
  }

  let locateResult: { results?: { name: string; kind: string; file: string }[] };
  try {
    locateResult = JSON.parse(locateOutput);
  } catch {
    return `**ix-query: ${params.symbol}**\n\nFailed to parse locate output. Raw:\n\`\`\`\n${locateOutput.slice(0, 500)}\n\`\`\``;
  }

  const results = locateResult.results ?? [];
  if (results.length === 0) {
    return `**ix-query: ${params.symbol}**\n\nNo matches found in the graph. The symbol may not be indexed yet. Try \`ix map\` to refresh.`;
  }

  const entity = results[0];

  try {
    explainOutput = await $`ix explain ${entity.name} --format json`.cwd(dir).text();
  } catch {
    // Explain failed — return locate result only
    return formatLocateOnly(params.symbol, results);
  }

  let explainResult: {
    name?: string;
    kind?: string;
    file?: string;
    role?: string;
    importance?: string;
    callerCount?: number;
    calleeCount?: number;
    confidence?: number;
    subsystem?: string;
    summary?: string;
  };
  try {
    explainResult = JSON.parse(explainOutput);
  } catch {
    return formatLocateOnly(params.symbol, results);
  }

  return formatResult(params.symbol, results, explainResult);
}

function formatLocateOnly(
  symbol: string,
  results: { name: string; kind: string; file: string }[]
): string {
  const lines = [
    `## ix-query: ${symbol}`,
    "",
    "**Matches found:**",
  ];
  for (const r of results.slice(0, 5)) {
    lines.push(`- \`${r.name}\` (${r.kind}) — ${r.file}`);
  }
  lines.push("", "_explain data unavailable — run ix map to refresh graph_");
  return lines.join("\n");
}

function formatResult(
  symbol: string,
  results: { name: string; kind: string; file: string }[],
  explain: {
    name?: string;
    kind?: string;
    file?: string;
    role?: string;
    importance?: string;
    callerCount?: number;
    calleeCount?: number;
    confidence?: number;
    subsystem?: string;
    summary?: string;
  }
): string {
  const confidence = explain.confidence ?? 1;
  const confidenceNote =
    confidence < 0.7 ? " ⚠ [uncertain — confidence < 0.7, run `ix map` to refresh]" : "";

  const lines = [
    `## ix-query: ${symbol}`,
    "",
    `**Name:** \`${explain.name ?? results[0].name}\``,
    `**Kind:** ${explain.kind ?? results[0].kind}`,
    `**File:** ${explain.file ?? results[0].file}`,
  ];

  if (explain.subsystem) lines.push(`**Subsystem:** ${explain.subsystem}`);
  if (explain.role) lines.push(`**Role:** ${explain.role}`);
  if (explain.importance) lines.push(`**Importance:** ${explain.importance}`);
  if (explain.callerCount !== undefined)
    lines.push(`**Callers:** ${explain.callerCount}`);
  if (explain.calleeCount !== undefined)
    lines.push(`**Callees:** ${explain.calleeCount}`);
  if (explain.summary) lines.push("", explain.summary);
  if (confidenceNote) lines.push("", confidenceNote);

  if (results.length > 1) {
    lines.push(
      "",
      `_${results.length - 1} other match(es) — use --kind or --path to narrow_`
    );
  }

  return lines.join("\n");
}

function fallbackUnavailable(tool: string, symbol: string, err: string): string {
  return [
    `## ${tool}: ${symbol}`,
    "",
    "**ix unavailable.** The Ix graph service is not running or not installed.",
    "",
    "To use Ix tools, ensure the ix CLI is installed and the graph is running:",
    "```",
    "command -v ix   # check installation",
    "ix status       # check connection",
    "ix map          # build graph if needed",
    "```",
    "",
    `Error: ${err}`,
  ].join("\n");
}
