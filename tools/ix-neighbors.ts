/**
 * ix-neighbors — neighborhood traversal
 *
 * Returns callers, callees, dependents, and imports for a symbol.
 * Use to understand who uses a symbol and what it depends on.
 */

import { $ } from "bun";
import { callRuntime } from "../runtime/client.ts";

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
  const dir = context.worktree ?? context.directory;
  const direction = params.direction ?? "all";
  const limit = Math.min(params.limit ?? 15, 30);
  const depth = Math.min(params.depth ?? 2, 3);

  // Try runtime API first — use preview_markdown when available
  const edgeTypes = direction === "all"
    ? ["calls", "imports", "depends_on"]
    : direction === "callers" ? ["calls"]
    : direction === "callees" ? ["calls"]
    : direction === "depends" ? ["depends_on"]
    : ["imports"];
  const rr = await callRuntime("/v2/graph/query", {
    operation: "neighbors",
    selectors: [{ kind: "symbol", value: params.symbol }],
    edge_types: edgeTypes,
    depth,
  }, { dir });
  if (typeof rr?.preview_markdown === "string") return rr.preview_markdown;

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
  try {
    let output: string;
    if (direction === "depends" && depth !== undefined) {
      output = await $`ix depends ${symbol} --depth ${depth} --format json`
        .cwd(dir)
        .text();
    } else {
      output =
        await $`ix ${direction} ${symbol} --limit ${limit} --format json`
          .cwd(dir)
          .text();
    }

    let result: {
      items?: { name: string; kind?: string; file?: string; subsystem?: string; callCount?: number }[];
      count?: number;
    };
    try {
      result = JSON.parse(output);
    } catch {
      return `**${direction}:** (parse error)\n`;
    }

    const items = result.items ?? [];
    if (items.length === 0) {
      return `**${direction}:** none\n`;
    }

    const label = capitalize(direction);
    const total = result.count ?? items.length;
    const lines = [`**${label}** (${total} total, showing ${items.length}):`];

    for (const item of items) {
      const parts = [`\`${item.name}\``];
      if (item.kind) parts.push(`(${item.kind})`);
      if (item.subsystem) parts.push(`[${item.subsystem}]`);
      if (item.file) parts.push(`— ${item.file}`);
      lines.push(`- ${parts.join(" ")}`);
    }

    return lines.join("\n") + "\n";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `**${direction}:** unavailable — ${msg}\n`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
