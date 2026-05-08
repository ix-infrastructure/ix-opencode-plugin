/**
 * ix-rank — rank symbols by a graph metric
 *
 * Returns top symbols ranked by dependents, callers, importers, or member count.
 * Use to surface hotspots, high-fan-in classes, and centrality candidates.
 */

import { $ } from "bun";

export const name = "ix-rank";
export const description =
  "Rank symbols by a graph metric (dependents, callers, importers, members) to surface hotspots and high-centrality components. Useful before architecture review or impact planning.";

export const parameters = {
  type: "object",
  properties: {
    by: {
      type: "string",
      description: "Metric to rank by. Default: dependents",
      enum: ["dependents", "callers", "importers", "members"],
      default: "dependents",
    },
    kind: {
      type: "string",
      description: "Symbol kind to rank. Default: class",
      enum: ["class", "function", "file", "interface", "module"],
      default: "class",
    },
    top: {
      type: "number",
      description: "How many results to return. Default: 10, max: 50",
      default: 10,
    },
    path: {
      type: "string",
      description: "Optional: restrict ranking to a directory path prefix",
    },
  },
  required: [],
} as const;

type Params = {
  by?: "dependents" | "callers" | "importers" | "members";
  kind?: "class" | "function" | "file" | "interface" | "module";
  top?: number;
  path?: string;
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;
  const by = params.by ?? "dependents";
  const kind = params.kind ?? "class";
  const top = Math.min(params.top ?? 10, 50);

  const args = [
    "ix", "rank",
    "--by", by,
    "--kind", kind,
    "--top", String(top),
    "--format", "json",
  ];
  if (params.path) args.push("--path", params.path);

  let output: string;
  try {
    output = await $`${args}`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(by, kind, msg);
  }

  let raw: {
    metric?: string;
    kind?: string;
    results?: { name?: string; kind?: string; score?: number; path?: string }[];
    summary?: { evaluated?: number; returned?: number };
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-rank: ${by}/${kind}\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const results = raw.results ?? [];
  if (results.length === 0) {
    return `## ix-rank: ${by}/${kind}\n\nNo results. The graph may be empty — run \`ix map\` to index the codebase.`;
  }

  const scopeNote = params.path ? ` in \`${params.path}\`` : "";
  const lines = [
    `## ix-rank: top ${kind} by ${by}${scopeNote}`,
    "",
    `| Rank | Symbol | Score | Path |`,
    `|------|--------|-------|------|`,
  ];

  results.forEach((r, i) => {
    const score = r.score !== undefined ? String(r.score) : "—";
    const path = r.path ? `\`${r.path}\`` : "—";
    lines.push(`| ${i + 1} | \`${r.name ?? "?"}\` | ${score} | ${path} |`);
  });

  if (raw.summary?.evaluated) {
    lines.push("", `_Evaluated ${raw.summary.evaluated} total, showing ${results.length}_`);
  }

  return lines.join("\n");
}

function unavailable(by: string, kind: string, err: string): string {
  return [
    `## ix-rank: ${by}/${kind}`,
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
