// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-neighbors — neighborhood traversal
 *
 * Returns callers, callees, dependents, and imports for a symbol.
 * Use to understand who uses a symbol and what it depends on.
 */

import { safeRun } from "../runtime/cli.ts";
import { tryLlm } from "../runtime/llm.ts";
import { ixErrorLines, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-neighbors";
export const description =
  "Get the neighborhood of a symbol: who calls it, what it calls, and what depends on it. Graph-based, no source reads.";

export const parameters = {
  type: "object",
  properties: {
    symbol: {
      type: "string",
      description: "Symbol, class, or file to get neighbors for",
    },
    direction: {
      type: "string",
      description:
        "Which neighbors to fetch. 'all' fetches callers + callees. Default: all",
      enum: ["callers", "callees", "depends", "imported-by", "all"],
      default: "all",
    },
    limit: {
      type: "number",
      description: "Max results per direction. Default: 15",
      default: 15,
    },
    depth: {
      type: "number",
      description:
        "Traversal depth for 'depends' direction. Default: 2, max: 3",
      default: 2,
    },
  },
  required: ["symbol"],
} as const;

type Params = {
  symbol: string;
  direction?: "callers" | "callees" | "depends" | "imported-by" | "all";
  limit?: number;
  depth?: number;
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
  const direction = params.direction ?? "all";
  const limit = Math.min(params.limit ?? 15, 30);
  const depth = Math.min(params.depth ?? 2, 3);

  const sections: string[] = [`## ix-neighbors: ${params.symbol}`, ""];

  if (direction === "callers" || direction === "all") {
    sections.push(await fetchSection(dir, "callers", params.symbol, limit));
  }
  if (direction === "callees" || direction === "all") {
    sections.push(await fetchSection(dir, "callees", params.symbol, limit));
  }
  if (direction === "depends") {
    sections.push(
      await fetchSection(dir, "depends", params.symbol, limit, depth)
    );
  }
  if (direction === "imported-by") {
    sections.push(await fetchSection(dir, "imported-by", params.symbol, limit));
  }

  return sections.join("\n");
}

async function fetchSection(
  dir: string,
  direction: string,
  symbol: string,
  limit: number,
  depth?: number
): Promise<string> {
  // One section per direction, so the fast-path is per section too: a mixed
  // result (llm for callers, JSON-rendered for depends) is fine, because each
  // section is independently headed.
  const llmArgs =
    direction === "depends" && depth !== undefined
      ? ["depends", symbol, "--depth", String(depth)]
      : [direction, symbol, "--limit", String(limit)];
  const fast = await tryLlm(llmArgs, dir);
  // Keep the section label the JSON path emits: these are stacked under one
  // `## ix-neighbors` header, so an unlabelled block would leave the model
  // unable to tell callers from callees.
  if (fast) return `**${capitalize(direction)}:**\n${fast}\n`;

  try {
    // Every direction this tool drives -- callers, callees, imports,
    // imported-by, depends -- is in the set Ix#547 makes exit 1 on a target it
    // cannot resolve, while still printing the record. `safeRun` keeps that
    // record; a bare `.text()` would drop it and report "(parse error)".
    const output = await safeRun(
      direction === "depends" && depth !== undefined
        ? ["depends", symbol, "--depth", String(depth), "--format", "json"]
        : [direction, symbol, "--limit", String(limit), "--format", "json"],
      dir,
    );
    if (output === null) return `**${direction}:** unavailable\n`;
    // An error record has no `results`; reading it as a result reported "none".
    const ixErr = parseIxError(output);
    if (ixErr) return `**${capitalize(direction)}:**\n${ixErrorLines(ixErr).join("\n")}\n`;

    let result: NeighborsRecord;
    try {
      result = JSON.parse(output);
    } catch {
      return `**${direction}:** (parse error)\n`;
    }

    const label = capitalize(direction);

    // `ix depends` answers with a dependency tree, not a flat list.
    if (direction === "depends") {
      const tree = result.tree ?? [];
      if (tree.length === 0) return `**${direction}:** none\n`;
      const visited = result.traversal?.nodesVisited;
      const lines = [`**${label}**${visited !== undefined ? ` (${visited} nodes)` : ""}:`];
      renderTree(tree, lines, "", 0);
      if (result.traversal?.depthLimited) lines.push("_depth limit reached; there may be more below_");
      return lines.join("\n") + "\n";
    }

    // callers / callees / imported-by: `results`, counted under `summary`.
    const items = result.results ?? [];
    if (items.length === 0) {
      return `**${direction}:** none\n`;
    }

    const total = result.summary?.total ?? items.length;
    const lines = [`**${label}** (${total} total, showing ${items.length}):`];

    for (const item of items) {
      const parts = [`\`${item.name ?? "?"}\``];
      if (item.kind) parts.push(`(${item.kind})`);
      const at = item.path ?? item.site?.path;
      if (at) parts.push(`— ${at}${item.site?.line !== undefined ? `:${item.site.line}` : ""}`);
      lines.push(`- ${parts.join(" ")}`);
    }

    return lines.join("\n") + "\n";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `**${direction}:** unavailable — ${msg}\n`;
  }
}

type DependsNode = {
  name?: string;
  kind?: string;
  rel?: string;
  path?: string;
  cycle?: boolean;
  children?: DependsNode[];
};

/** The fields of the neighbour commands' `--format json` this tool reads. */
type NeighborsRecord = {
  results?: {
    name?: string;
    kind?: string;
    path?: string;
    site?: { path?: string; line?: number };
  }[];
  summary?: { total?: number; shown?: number };
  tree?: DependsNode[];
  traversal?: { nodesVisited?: number; depthLimited?: boolean };
};

function renderTree(nodes: DependsNode[], lines: string[], indent: string, depth: number): void {
  for (const node of nodes.slice(0, 15)) {
    const kind = node.kind ? ` (${node.kind})` : "";
    const path = node.path ? ` — ${node.path}` : "";
    const cycle = node.cycle ? " ↺" : "";
    lines.push(`${indent}- \`${node.name ?? "?"}\`${kind}${path}${cycle}`);
    if (node.children && node.children.length > 0 && depth < 3) {
      renderTree(node.children, lines, indent + "  ", depth + 1);
    }
  }
  if (nodes.length > 15) lines.push(`${indent}- … ${nodes.length - 15} more`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
