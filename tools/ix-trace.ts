// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-trace — execution path tracing
 *
 * Traces upstream callers and downstream callees through a symbol.
 * Use when you need to understand the full execution path, not just immediate neighbors.
 * For immediate neighbors use ix-neighbors instead.
 */

import { runIx, failureDetail } from "../runtime/cli.ts";
import { tryLlm } from "../runtime/llm.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-trace";
export const description =
  "Trace execution paths through a symbol — upstream callers and downstream callees. Use to understand the full call chain, not just immediate neighbors. Optionally trace to a specific target symbol.";

export const parameters = {
  type: "object",
  properties: {
    symbol: {
      type: "string",
      description: "Symbol to trace execution paths for",
    },
    to: {
      type: "string",
      description: "Optional: trace only paths from `symbol` to this specific target",
    },
  },
  required: ["symbol"],
} as const;

type Params = { symbol: string; to?: string };
type Context = { directory: string; worktree?: string };

type TraceNode = {
  name?: string;
  kind?: string;
  path?: string;
  cycle?: boolean;
  children?: TraceNode[];
};

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = toolCwd(context);

  const llmArgs = ["trace", params.symbol];
  if (params.to) llmArgs.push("--to", params.to);
  const fast = await tryLlm(llmArgs, dir);
  if (fast) return `## ix-trace: ${params.symbol}\n\n${fast}`;

  const args = ["trace", params.symbol, "--format", "json"];
  if (params.to) args.push("--to", params.to);

  const run = await runIx(args, dir);
  if (!run?.stdout.trim()) return unavailable(params.symbol, failureDetail(run));
  const output = run.stdout;
  // An error record has no trace summary, and reading it as a result said the
  // symbol "may be a root entry point".
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError(`## ix-trace: ${params.symbol}`, ixErr);

  let raw: {
    mode?: string;
    from?: { name?: string; kind?: string; path?: string };
    to?: { name?: string; kind?: string; path?: string };
    path?: { name?: string; kind?: string }[];
    summary?: { path_length?: number };
    target?: { name?: string; kind?: string; path?: string };
    upstream?: { tree?: TraceNode[]; summary?: { nodes_visited?: number; max_depth?: number } };
    downstream?: { tree?: TraceNode[]; summary?: { nodes_visited?: number; max_depth?: number } };
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-trace: ${params.symbol}\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  // `--to` answers in path mode: one chain of steps, no up/down trees.
  if (raw.mode === "path" || Array.isArray(raw.path)) {
    const steps = raw.path ?? [];
    if (steps.length === 0) {
      return [
        `## ix-trace: ${params.symbol}`,
        "",
        `No path found from \`${params.symbol}\` to \`${params.to ?? raw.to?.name ?? "?"}\`.`,
      ].join("\n");
    }
    const lines = [
      `## ix-trace: ${params.symbol}`,
      "",
      `**Path to \`${raw.to?.name ?? params.to ?? "?"}\`** (${steps.length} step${steps.length === 1 ? "" : "s"}):`,
    ];
    steps.forEach((step, i) => {
      lines.push(`${i + 1}. \`${step.name ?? "?"}\`${step.kind ? ` (${step.kind})` : ""}`);
    });
    return lines.join("\n");
  }

  const target = raw.target;
  const upstream = raw.upstream ?? {};
  const downstream = raw.downstream ?? {};
  const upNodes = upstream.summary?.nodes_visited ?? 0;
  const downNodes = downstream.summary?.nodes_visited ?? 0;

  if (upNodes === 0 && downNodes === 0) {
    return [
      `## ix-trace: ${params.symbol}`,
      "",
      "No trace paths found. The symbol may be a root entry point or not indexed.",
    ].join("\n");
  }

  const lines = [`## ix-trace: ${params.symbol}`, ""];

  if (target) {
    if (target.kind) lines.push(`**Kind:** ${target.kind}`);
    if (target.path) lines.push(`**Path:** \`${target.path}\``);
    lines.push("");
  }

  if (params.to) {
    lines.push(`**Tracing path to:** \`${params.to}\``, "");
  }

  if (upNodes > 0) {
    lines.push(`**Upstream** (${upNodes} node${upNodes === 1 ? "" : "s"}, depth ${upstream.summary?.max_depth ?? "?"}):`);
    renderTree(upstream.tree ?? [], lines, "  ");
    lines.push("");
  }

  if (downNodes > 0) {
    lines.push(`**Downstream** (${downNodes} node${downNodes === 1 ? "" : "s"}, depth ${downstream.summary?.max_depth ?? "?"}):`);
    renderTree(downstream.tree ?? [], lines, "  ");
  }

  return lines.join("\n");
}

function renderTree(nodes: TraceNode[], lines: string[], indent: string, depth = 0): void {
  if (depth > 4) {
    lines.push(`${indent}... (truncated)`);
    return;
  }
  for (const node of nodes.slice(0, 10)) {
    const cycle = node.cycle ? " ↺ (cycle)" : "";
    const kind = node.kind ? ` (${node.kind})` : "";
    lines.push(`${indent}- \`${node.name ?? "?"}\`${kind}${cycle}`);
    if (node.children && node.children.length > 0) {
      renderTree(node.children, lines, indent + "  ", depth + 1);
    }
  }
}

function unavailable(symbol: string, err: string): string {
  return [
    `## ix-trace: ${symbol}`,
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
