// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-subsystems — list graph-derived subsystems
 *
 * Returns all subsystems with their file counts, hierarchy levels, and confidence signals.
 * More detailed than the subsystem table in ix-map — use for subsystem-level orientation
 * and to understand the architectural decomposition of the codebase.
 */

import { runIx, failureDetail } from "../runtime/cli.ts";
import { tryLlmRun } from "../runtime/llm.ts";
import { mapStaleFromJson, mapStaleFromLlm, mapStaleNote } from "../runtime/map-stale.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

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
  const dir = toolCwd(context);

  const fast = await tryLlmRun(["subsystems"], dir);
  if (fast) {
    // A map deferred after an edit (Ix#841): the regions are the last map's.
    const stale = mapStaleFromLlm(fast.text, fast.stderr);
    return stale
      ? `## ix-subsystems\n\n${mapStaleNote(stale)}\n\n${fast.text}`
      : `## ix-subsystems\n\n${fast.text}`;
  }

  const run = await runIx(["subsystems", "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(failureDetail(run));
  const output = run.stdout;
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError("## ix-subsystems", ixErr);

  let raw: {
    file_count?: number;
    region_count?: number;
    levels?: number;
    map_rev?: number;
    outcome?: string;
    map_stale?: boolean;
    regions_as_of?: { map_rev?: number; file_count?: number } | null;
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
  ];
  // A map deferred after an edit (Ix#841): the counts are the last map's.
  const stale = mapStaleFromJson(raw, run.stderr);
  if (stale) lines.push(mapStaleNote(stale));
  lines.push(
    "",
    "| Subsystem | Kind | Level | Files | Children | Interfaces | Confidence |",
    "|-----------|------|-------|-------|----------|------------|------------|",
  );

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
