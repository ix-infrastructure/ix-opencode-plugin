/**
 * ix-subsystems — list graph-derived subsystems
 *
 * Returns all subsystems with their file counts, hierarchy levels, and confidence signals.
 * More detailed than the subsystem table in ix-map — use for subsystem-level orientation
 * and to understand the architectural decomposition of the codebase.
 */

import { $ } from "bun";

export const name = "ix-subsystems";
export const description =
  "List all graph-derived subsystems with file counts, hierarchy levels, confidence signals, and interface counts. Use for top-level architectural orientation before deeper exploration.";

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
    output = await $`ix subsystems --format json`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(msg);
  }

  let raw: {
    file_count?: number;
    region_count?: number;
    levels?: number;
    map_rev?: number;
    outcome?: string;
    regions?: {
      label?: string;
      label_kind?: string;
      level?: number;
      files?: number;
      children?: number;
      parent_id?: string | null;
      confidence?: number;
      signals?: string[];
      interfaces?: number;
    }[];
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-subsystems\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const regions = raw.regions ?? [];
  if (regions.length === 0) {
    return [
      "## ix-subsystems",
      "",
      "**No subsystems found.** Run `ix map` to build the graph.",
    ].join("\n");
  }

  const lines = [
    "## ix-subsystems",
    "",
    `**${regions.length} subsystem${regions.length === 1 ? "" : "s"}** — ${raw.file_count ?? "?"} files, ${raw.levels ?? "?"} level${raw.levels === 1 ? "" : "s"}`,
    "",
    "| Subsystem | Kind | Level | Files | Children | Interfaces | Confidence |",
    "|-----------|------|-------|-------|----------|------------|------------|",
  ];

  for (const r of regions) {
    const name = r.label ?? "unknown";
    const kind = r.label_kind ?? "—";
    const level = r.level ?? "—";
    const files = r.files ?? "—";
    const children = r.children ?? 0;
    const ifaces = r.interfaces ?? 0;
    const conf = r.confidence !== undefined ? r.confidence.toFixed(2) : "—";
    lines.push(`| ${name} | ${kind} | ${level} | ${files} | ${children} | ${ifaces} | ${conf} |`);
  }

  if (raw.outcome) lines.push("", `_Outcome: ${raw.outcome}_`);

  return lines.join("\n");
}

function unavailable(err: string): string {
  return [
    "## ix-subsystems",
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
