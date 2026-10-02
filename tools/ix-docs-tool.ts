// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-docs-tool — doc/context summary retrieval
 *
 * Retrieves a structured context summary for a symbol, subsystem, or file.
 * Produces a condensed architectural briefing suitable for injecting as context.
 * Not the same as the /ix-docs skill — this is a lightweight context fetcher.
 */

import { safeRun } from "../runtime/cli.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-docs-tool";
export const description =
  "Get a condensed architectural context summary for a symbol, subsystem, or file. Returns role, structure, key components, and risk notes. Use to inject graph context before making changes.";

export const parameters = {
  type: "object",
  properties: {
    target: {
      type: "string",
      description: "Symbol name, file path, or subsystem name to summarize",
    },
    depth: {
      type: "string",
      description:
        "How much detail to fetch. 'brief' = overview only. 'standard' = overview + key components. 'full' = overview + components + relationships. Default: standard",
      enum: ["brief", "standard", "full"],
      default: "standard",
    },
  },
  required: ["target"],
} as const;

type Params = {
  target: string;
  depth?: "brief" | "standard" | "full";
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
  const depth = params.depth ?? "standard";

  // Phase 1: locate + overview in parallel
  const [locateOut, overviewOut, statsOut] = await Promise.all([
    safeRun(["locate", params.target, "--format", "json"], dir),
    safeRun(["overview", params.target, "--format", "json"], dir),
    depth !== "brief"
      ? safeRun(["stats", "--format", "json"], dir)
      : Promise.resolve(null),
  ]);

  if (!locateOut && !overviewOut) {
    return [
      `## ix-docs-tool: ${params.target}`,
      "",
      "**Not found in graph.** The target may not be indexed.",
      "",
      "Try: `ix map` to refresh, or `ix locate` to check the exact name.",
    ].join("\n");
  }

  // Both lookups answered with an error record (unmapped workspace, empty
  // graph): there is nothing to document, and the record says why.
  const locateErr = parseIxError(locateOut);
  const overviewErr = parseIxError(overviewOut);
  if ((locateErr || !locateOut) && (overviewErr || !overviewOut)) {
    const ixErr = overviewErr ?? locateErr;
    if (ixErr) return formatIxError(`## ix-docs-tool: ${params.target}`, ixErr);
  }

  // Neither lookup resolved the target (`resolvedTarget: null`): say so rather
  // than return an empty briefing.
  if (!resolves(locateOut) && !resolves(overviewErr ? null : overviewOut)) {
    const ixErr = overviewErr ?? locateErr;
    if (ixErr) return formatIxError(`## ix-docs-tool: ${params.target}`, ixErr);
    return [
      `## ix-docs-tool: ${params.target}`,
      "",
      "**Not found in graph.** No entity by that name is indexed.",
      "",
      "Try: `ix locate` to check the exact name, or `ix map` to refresh.",
    ].join("\n");
  }

  const sections: string[] = [
    `## Context: ${params.target}`,
    "",
  ];

  // Stats: counts are objects (`nodes.total`), and files are one node kind.
  if (statsOut && !parseIxError(statsOut)) {
    try {
      const stats = JSON.parse(statsOut) as {
        nodes?: { total?: number; byKind?: { kind?: string; count?: number }[] };
      };
      const parts: string[] = [];
      const files = stats.nodes?.byKind?.find((e) => e.kind === "file")?.count;
      if (files) parts.push(`${files} files`);
      if (stats.nodes?.total) parts.push(`${stats.nodes.total} nodes`);
      if (parts.length > 0) sections.push(`_${parts.join(" · ")}_`, "");
    } catch {
      // ignore
    }
  }

  // Overview
  let overview: OverviewRecord | null = null;
  if (overviewOut && !overviewErr) {
    try {
      overview = JSON.parse(overviewOut) as OverviewRecord;
      sections.push(formatOverview(overview));
    } catch {
      overview = null;
    }
  }

  if (depth === "brief") {
    return sections.join("\n");
  }

  // Phase 2: explain key components. `keyItems` are what a file or class
  // contains; a function has none, and its `keySiblings` are not components.
  const components = (overview?.keyItems ?? [])
    .slice(0, depth === "full" ? 8 : 5)
    .map((m) => m.name ?? "")
    .filter(Boolean);

  if (components.length > 0) {
    const scopePath = overview?.path;
    const explains = await Promise.all(
      components.map((c) =>
        safeRun(
          scopePath ? ["explain", c, "--path", scopePath, "--format", "json"] : ["explain", c, "--format", "json"],
          dir,
        )
      )
    );

    const componentLines = ["**Key Components:**", ""];
    for (let i = 0; i < components.length; i++) {
      const out = explains[i];
      if (!out || parseIxError(out)) {
        componentLines.push(`- \`${components[i]}\``);
        continue;
      }
      try {
        const e = JSON.parse(out) as {
          role?: { role?: string };
          facts?: { callerCount?: number };
        };
        const role = e.role?.role ? ` — ${e.role.role}` : "";
        const callers = e.facts?.callerCount !== undefined ? ` (${e.facts.callerCount} callers)` : "";
        componentLines.push(`- \`${components[i]}\`${callers}${role}`);
      } catch {
        componentLines.push(`- \`${components[i]}\``);
      }
    }
    sections.push(componentLines.join("\n"), "");
  }

  if (depth === "full") {
    // Phase 3: impact for context
    const impactOut = await safeRun(["impact", params.target, "--format", "json"], dir);
    if (impactOut && !parseIxError(impactOut)) {
      try {
        const impact = JSON.parse(impactOut) as {
          riskLevel?: string;
          summary?: Record<string, unknown>;
        };
        const risk = impact.riskLevel ?? "unknown";
        const reaching = ["callers", "directImporters", "directDependents", "memberLevelCallers"]
          .map((k) => impact.summary?.[k])
          .filter((n): n is number => typeof n === "number")
          .reduce((a, b) => a + b, 0);
        sections.push(
          `**Change risk:** ${risk.toUpperCase()} (${reaching} callers/importers/dependents reach it)`,
          ""
        );
      } catch {
        // ignore
      }
    }
  }

  return sections.join("\n");
}

/** True when a locate/overview JSON body names the entity it resolved to. */
function resolves(output: string | null): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output) as { resolvedTarget?: unknown };
    return Boolean(parsed.resolvedTarget);
  } catch {
    return false;
  }
}

/** The fields of `ix overview --format json` this tool reads (Ix commands/overview.ts). */
type OverviewRecord = {
  resolvedTarget?: { kind?: string; name?: string } | null;
  path?: string;
  systemPath?: { name?: string; kind?: string }[] | null;
  childrenByKind?: Record<string, number> | null;
  keyItems?: { name?: string; kind?: string }[] | null;
  containedIn?: { kind?: string; name?: string } | null;
};

function formatOverview(overview: OverviewRecord): string {
  const lines: string[] = [];

  const target = overview.resolvedTarget;
  if (target?.kind) lines.push(`**Kind:** ${target.kind}`);
  if (overview.path) lines.push(`**Path:** ${overview.path}`);
  const regions = (overview.systemPath ?? [])
    .filter((p) => p.kind === "region" || p.kind === "system" || p.kind === "subsystem")
    .map((p) => p.name)
    .filter(Boolean);
  if (regions.length > 0) lines.push(`**Subsystem:** ${regions.join(" › ")}`);
  if (overview.containedIn?.name) {
    lines.push(`**Contained in:** ${overview.containedIn.kind ?? ""} ${overview.containedIn.name}`.replace("  ", " "));
  }
  const children = overview.childrenByKind ?? {};
  const childParts = Object.entries(children).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
  if (childParts.length > 0) lines.push(`**Contains:** ${childParts.join(", ")}`);

  return lines.join("\n") + "\n";
}
