// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-query — graph entity lookup
 *
 * Locates and explains a symbol, class, file, or subsystem using the Ix graph.
 * Runs `ix locate` + `ix explain` and returns a formatted markdown summary.
 */

import { runIx, failureDetail } from "../runtime/cli.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

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
  const dir = toolCwd(context);

  // Build locate args
  const locateArgs = ["locate", params.symbol, "--format", "json"];
  if (params.kind) locateArgs.push("--kind", params.kind);
  if (params.path) locateArgs.push("--path", params.path);

  const locateRun = await runIx(locateArgs, dir);
  if (!locateRun?.stdout.trim()) {
    return fallbackUnavailable("ix-query", params.symbol, failureDetail(locateRun));
  }
  const locateOutput = locateRun.stdout;
  // An error record has no matches, and reading it as a result reported "No
  // matches found" for a project Ix could not search at all.
  const locateErr = parseIxError(locateOutput);
  if (locateErr) return formatIxError(`## ix-query: ${params.symbol}`, locateErr);

  let locate: LocateRecord;
  try {
    locate = JSON.parse(locateOutput);
  } catch {
    return `**ix-query: ${params.symbol}**\n\nFailed to parse locate output. Raw:\n\`\`\`\n${locateOutput.slice(0, 500)}\n\`\`\``;
  }

  // `ix locate` resolves to one entity (`resolvedTarget`), or to none with the
  // `candidates` it could not choose between (`resolutionMode: "ambiguous"`).
  const target = locate.resolvedTarget;
  const candidates = locate.candidates ?? [];
  if (!target) {
    if (candidates.length > 0) return formatCandidates(params.symbol, candidates);
    return `**ix-query: ${params.symbol}**\n\nNo matches found in the graph. The symbol may not be indexed yet. Try \`ix map\` to refresh.`;
  }

  const entity: Entity = {
    name: target.name ?? params.symbol,
    kind: target.kind ?? "?",
    path: target.path,
    lines: locate.lineRange,
    system: (locate.systemPath ?? [])
      .filter((p) => p.kind === "region" || p.kind === "system" || p.kind === "subsystem")
      .map((p) => p.name)
      .filter((n): n is string => typeof n === "string"),
  };

  // `ix explain` is enrichment on top of a locate that already succeeded, so a
  // miss here degrades to the locate-only view rather than failing the tool --
  // but a body printed alongside a non-zero exit is still an answer worth
  // parsing, which a bare `.text()` would have discarded. Narrowed by kind and
  // path so it explains the entity locate found, not a namesake.
  const explainArgs = ["explain", entity.name, "--format", "json"];
  if (target.kind) explainArgs.push("--kind", target.kind);
  if (target.path) explainArgs.push("--path", target.path);
  const explainRun = await runIx(explainArgs, dir);
  if (!explainRun?.stdout.trim()) return formatLocateOnly(params.symbol, entity);
  const explainOutput = explainRun.stdout;
  if (parseIxError(explainOutput)) return formatLocateOnly(params.symbol, entity);

  let explain: ExplainRecord;
  try {
    explain = JSON.parse(explainOutput);
  } catch {
    return formatLocateOnly(params.symbol, entity);
  }
  if (!explain.facts && !explain.role) return formatLocateOnly(params.symbol, entity);

  return formatResult(params.symbol, entity, explain);
}

/** The fields `ix locate --format json` emits (Ix commands/locate.ts). */
type LocateRecord = {
  resolvedTarget?: { id?: string; kind?: string; name?: string; path?: string } | null;
  resolutionMode?: string;
  candidates?: { name?: string; kind?: string; path?: string }[];
  lineRange?: { start?: number; end?: number };
  systemPath?: { name?: string; kind?: string }[] | null;
};

/** The fields of `ix explain --format json` this tool reads (Ix commands/explain.ts). */
type ExplainRecord = {
  facts?: {
    path?: string;
    callerCount?: number;
    calleeCount?: number;
    dependentCount?: number;
    memberCount?: number;
    stale?: boolean;
  };
  role?: { role?: string; confidence?: string };
  importance?: { level?: string; category?: string };
  rendered?: { explanation?: string };
};

type Entity = {
  name: string;
  kind: string;
  path?: string;
  lines?: { start?: number; end?: number };
  system: string[];
};

function where(e: Entity): string {
  if (!e.path) return "—";
  return e.lines?.start !== undefined ? `${e.path}:${e.lines.start}` : e.path;
}

function formatCandidates(
  symbol: string,
  candidates: { name?: string; kind?: string; path?: string }[],
): string {
  const lines = [
    `## ix-query: ${symbol}`,
    "",
    `**Ambiguous:** ${candidates.length} entities match. Narrow with \`kind\` or \`path\`:`,
  ];
  for (const c of candidates.slice(0, 10)) {
    lines.push(`- \`${c.name ?? "?"}\` (${c.kind ?? "?"}) — ${c.path ?? "—"}`);
  }
  return lines.join("\n");
}

function formatLocateOnly(symbol: string, entity: Entity): string {
  const lines = [
    `## ix-query: ${symbol}`,
    "",
    `**Found:** \`${entity.name}\` (${entity.kind}) — ${where(entity)}`,
  ];
  if (entity.system.length > 0) lines.push(`**Subsystem:** ${entity.system.join(" › ")}`);
  lines.push("", "_explain data unavailable — run ix map to refresh graph_");
  return lines.join("\n");
}

function formatResult(symbol: string, entity: Entity, explain: ExplainRecord): string {
  const facts = explain.facts ?? {};
  const lines = [
    `## ix-query: ${symbol}`,
    "",
    `**Name:** \`${entity.name}\``,
    `**Kind:** ${entity.kind}`,
    `**File:** ${where({ ...entity, path: entity.path ?? facts.path })}`,
  ];

  if (entity.system.length > 0) lines.push(`**Subsystem:** ${entity.system.join(" › ")}`);
  if (explain.role?.role) {
    const conf = explain.role.confidence ? ` (${explain.role.confidence} confidence)` : "";
    lines.push(`**Role:** ${explain.role.role}${conf}`);
  }
  if (explain.importance?.level) {
    const cat = explain.importance.category ? ` — ${explain.importance.category}` : "";
    lines.push(`**Importance:** ${explain.importance.level}${cat}`);
  }
  if (facts.callerCount !== undefined) lines.push(`**Callers:** ${facts.callerCount}`);
  if (facts.calleeCount !== undefined) lines.push(`**Callees:** ${facts.calleeCount}`);
  if (facts.dependentCount !== undefined) lines.push(`**Dependents:** ${facts.dependentCount}`);
  if (facts.memberCount) lines.push(`**Members:** ${facts.memberCount}`);
  if (explain.rendered?.explanation) lines.push("", explain.rendered.explanation);
  if (facts.stale) lines.push("", "⚠ [stale — run `ix map` to refresh]");

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
