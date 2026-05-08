/**
 * ix-stats — graph-wide statistics
 *
 * Returns node/edge counts broken down by kind, file count, and graph health.
 * Use for quick orientation ("how big is this codebase?") and to verify the
 * graph is indexed before running more expensive queries.
 */

import { $ } from "bun";

export const name = "ix-stats";
export const description =
  "Return graph-wide statistics: file count, node and edge counts by kind, and graph health status. Use to verify the graph is indexed and to orient in an unfamiliar codebase.";

export const parameters = {
  type: "object",
  properties: {},
  required: [],
} as const;

type Params = Record<string, never>;
type Context = { directory: string; worktree?: string };

export async function execute(_params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;

  let output: string;
  try {
    output = await $`ix stats --format json`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(msg);
  }

  let raw: {
    files?: number;
    nodes?: { total?: number; byKind?: { kind?: string; count?: number }[] };
    edges?: { total?: number; byPredicate?: { kind?: string; count?: number }[] };
    language?: string;
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-stats\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const lines = ["## ix-stats", ""];

  const totalNodes = raw.nodes?.total ?? 0;
  const totalEdges = raw.edges?.total ?? 0;
  const fileCount = raw.files ?? countByKind(raw.nodes?.byKind, "file");

  if (totalNodes === 0) {
    return [
      "## ix-stats",
      "",
      "**Graph is empty.** Run `ix map` to index the codebase.",
    ].join("\n");
  }

  lines.push("**Codebase:**");
  lines.push(`- Files indexed: ${fileCount}`);
  lines.push(`- Total nodes: ${totalNodes}`);
  lines.push(`- Total edges: ${totalEdges}`);
  if (raw.language) lines.push(`- Primary language: ${raw.language}`);

  if (raw.nodes?.byKind && raw.nodes.byKind.length > 0) {
    lines.push("", "**Nodes by kind:**");
    for (const entry of raw.nodes.byKind) {
      if (entry.kind && entry.count && entry.count > 0) {
        lines.push(`- ${entry.kind}: ${entry.count}`);
      }
    }
  }

  if (raw.edges?.byPredicate && raw.edges.byPredicate.length > 0) {
    lines.push("", "**Edges by type:**");
    for (const entry of raw.edges.byPredicate) {
      if (entry.kind && entry.count && entry.count > 0) {
        lines.push(`- ${entry.kind}: ${entry.count}`);
      }
    }
  }

  return lines.join("\n");
}

function countByKind(
  byKind: { kind?: string; count?: number }[] | undefined,
  kind: string
): number {
  return byKind?.find((e) => e.kind === kind)?.count ?? 0;
}

function unavailable(err: string): string {
  return [
    "## ix-stats",
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
