// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-map — architectural map and subsystem overview
 *
 * Returns the subsystem map and top-level architectural structure.
 * Use for orientation before exploration or planning.
 */

import { safeRun } from "../runtime/cli.ts";
import { ixErrorLines, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-map";
export const description =
  "Get the architectural map of the codebase: all subsystems, their cohesion/coupling scores, and top components. Use for orientation before deeper exploration.";

export const parameters = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      description:
        "Optional: scope to a specific subsystem name or path prefix",
    },
    include_stats: {
      type: "boolean",
      description: "Include codebase stats (file count, nodes, edges). Default: true",
      default: true,
    },
  },
  required: [],
} as const;

type Params = {
  scope?: string;
  include_stats?: boolean;
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
  const includeStats = params.include_stats !== false;

  const fetches: Promise<string>[] = [
    fetchSubsystems(dir, params.scope),
    fetchSubsystemList(dir),
  ];
  if (includeStats) fetches.push(fetchStats(dir));

  const [subsystems, subsystemList, stats] = await Promise.all(
    fetches.length === 3
      ? fetches
      : [...fetches, Promise.resolve("")]
  );

  const sections = [`## ix-map${params.scope ? `: ${params.scope}` : ""}`, ""];

  if (stats) sections.push(stats, "");
  sections.push(subsystems);
  if (subsystemList) sections.push("", subsystemList);

  return sections.join("\n");
}

async function fetchSubsystems(dir: string, scope?: string): Promise<string> {
  try {
    const args = scope
      ? ["subsystems", scope, "--format", "json"]
      : ["subsystems", "--format", "json"];

    // `ix subsystems <region>` exits 1 for a region it cannot resolve while
    // still emitting the record (Ix#538), so keep stdout rather than throwing.
    const output = await safeRun(args, dir);
    if (output === null) throw new Error("ix subsystems produced no output");
    // An error record has no regions; reading it as a result said "none found".
    const ixErr = parseIxError(output);
    if (ixErr) return ["**Subsystems:**", ...ixErrorLines(ixErr)].join("\n");
    const parsed = JSON.parse(output) as SubsystemsRecord;

    // `ix subsystems <region>` answers with that region (`target`) and its
    // `children`, not with a `regions` list.
    if (parsed.target) return formatScoped(parsed);

    const systems = parsed.regions ?? [];

    if (systems.length === 0) {
      return "**Subsystems:** none found. Run `ix map` to build the graph.";
    }

    const lines = [
      `**Subsystems** (${systems.length}${parsed.file_count !== undefined ? `, ${parsed.file_count} files` : ""}):`,
      "",
      "| Subsystem | Kind | Level | Files | Cohesion | Coupling | Confidence |",
      "|-----------|------|-------|-------|----------|----------|------------|",
    ];

    for (const s of systems) {
      const cohesion = s.cohesion !== undefined ? s.cohesion.toFixed(2) : "—";
      // Ix's coupling is a count of cross-boundary edge weight, not a 0-1
      // ratio, so it is shown as given and not judged against a threshold.
      const coupling = s.coupling !== undefined ? String(s.coupling) : "—";
      const confidence = s.confidence !== undefined ? s.confidence.toFixed(2) : "—";
      const flag = s.cohesion !== undefined && s.cohesion < 0.4 && (s.files ?? 0) > 1 ? " ⚠" : "";
      lines.push(
        `| ${s.label ?? "?"}${flag} | ${s.label_kind ?? "—"} | ${s.level ?? "—"} | ${s.files ?? "—"} | ${cohesion} | ${coupling} | ${confidence} |`
      );
    }

    return lines.join("\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `**Subsystems:** unavailable — ${msg}`;
  }
}

async function fetchSubsystemList(dir: string): Promise<string> {
  try {
    const output = await safeRun(["subsystems", "--list", "--format", "json"], dir);
    if (output === null) throw new Error("no output");
    if (parseIxError(output)) return "";
    // `{"scores":[{"name","level","health","files",...}]}`, healthiest first.
    const parsed = JSON.parse(output) as { scores?: { name?: string; health?: number }[] };
    const scores = (parsed.scores ?? []).filter((s) => typeof s.name === "string");
    if (scores.length === 0) return "";
    const named = scores.map((s) => (s.health !== undefined ? `${s.name} (${s.health.toFixed(2)})` : s.name));
    return `**Subsystem health:** ${named.join(", ")}`;
  } catch {
    return "";
  }
}

async function fetchStats(dir: string): Promise<string> {
  try {
    const output = await safeRun(["stats", "--format", "json"], dir);
    if (output === null) throw new Error("no output");
    if (parseIxError(output)) return "";
    const parsed = JSON.parse(output) as StatsRecord;

    const parts: string[] = [];
    const files = statsFileCount(parsed);
    if (files !== undefined) parts.push(`${files} files`);
    if (parsed.nodes?.total !== undefined) parts.push(`${parsed.nodes.total} nodes`);
    if (parsed.edges?.total !== undefined) parts.push(`${parsed.edges.total} edges`);

    return parts.length > 0 ? `**Codebase:** ${parts.join(" · ")}` : "";
  } catch {
    return "";
  }
}

/** `ix stats --format json`: counts are objects with a `total` and a breakdown. */
type StatsRecord = {
  nodes?: { total?: number; byKind?: { kind?: string; count?: number }[] };
  edges?: { total?: number; byPredicate?: { predicate?: string; count?: number }[] };
};

/** Files are one node kind among many; stats has no top-level file count. */
function statsFileCount(stats: StatsRecord): number | undefined {
  return stats.nodes?.byKind?.find((e) => e.kind === "file")?.count ?? (stats.nodes ? 0 : undefined);
}

type Region = {
  label?: string;
  label_kind?: string;
  kind?: string;
  level?: number;
  files?: number;
  cohesion?: number;
  coupling?: number;
  confidence?: number;
};

/** `ix subsystems [region] --format json` (Ix commands/subsystems.ts). */
type SubsystemsRecord = {
  file_count?: number;
  regions?: Region[];
  target?: Region;
  parent?: { label?: string; kind?: string } | null;
  children?: Region[];
};

function formatScoped(parsed: SubsystemsRecord): string {
  const t = parsed.target!;
  const lines = [
    `**Subsystem ${t.label ?? "?"}** (${t.kind ?? "region"}, level ${t.level ?? "?"}, ${t.files ?? "?"} files, confidence ${t.confidence !== undefined ? t.confidence.toFixed(2) : "—"})`,
  ];
  if (parsed.parent?.label) lines.push(`Part of: ${parsed.parent.label}`);
  const children = parsed.children ?? [];
  if (children.length > 0) {
    lines.push("", "| Child | Kind | Files | Confidence |", "|-------|------|-------|------------|");
    for (const c of children) {
      lines.push(`| ${c.label ?? "?"} | ${c.kind ?? c.label_kind ?? "—"} | ${c.files ?? "—"} | ${c.confidence !== undefined ? c.confidence.toFixed(2) : "—"} |`);
    }
  } else {
    lines.push("No child regions.");
  }
  return lines.join("\n");
}
