/**
 * ix-map — architectural map and subsystem overview
 *
 * Returns the subsystem map and top-level architectural structure.
 * Use for orientation before exploration or planning.
 */

import { $ } from "bun";
import { callRuntime } from "../runtime/client.ts";

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
  const dir = context.worktree ?? context.directory;
  const includeStats = params.include_stats !== false;

  // Try runtime API first — use preview_markdown when available
  const rr = await callRuntime("/v2/ix_query", {
    query: {
      mode: "understand",
      depth: "shallow",
      targets: params.scope ? [{ kind: "path", value: params.scope }] : [],
    },
  }, { dir });
  if (typeof rr?.preview_markdown === "string") return rr.preview_markdown;

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
      ? ["ix", "subsystems", scope, "--format", "json"]
      : ["ix", "subsystems", "--format", "json"];

    const output = await $`${args}`.cwd(dir).text();
    const parsed = JSON.parse(output);

    const systems: {
      name: string;
      path?: string;
      fileCount?: number;
      cohesion?: number;
      externalCoupling?: number;
      confidence?: number;
    }[] = parsed.systems ?? parsed.regions ?? parsed.subsystems ?? [];

    if (systems.length === 0) {
      return "**Subsystems:** none found. Run `ix map` to build the graph.";
    }

    const lines = [
      `**Subsystems** (${systems.length}):`,
      "",
      "| Subsystem | Path | Files | Cohesion | Coupling |",
      "|-----------|------|-------|----------|----------|",
    ];

    for (const s of systems) {
      const cohesion =
        s.cohesion !== undefined ? s.cohesion.toFixed(2) : "—";
      const coupling =
        s.externalCoupling !== undefined
          ? s.externalCoupling.toFixed(2)
          : "—";
      const flag =
        (s.cohesion !== undefined && s.cohesion < 0.4) ||
        (s.externalCoupling !== undefined && s.externalCoupling > 0.5)
          ? " ⚠"
          : "";
      lines.push(
        `| ${s.name}${flag} | ${s.path ?? "—"} | ${s.fileCount ?? "—"} | ${cohesion} | ${coupling} |`
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
    const output = await $`ix subsystems --list --format json`.cwd(dir).text();
    const parsed = JSON.parse(output);
    const names: string[] = parsed.names ?? parsed.list ?? [];
    if (names.length === 0) return "";
    return `**Subsystem names:** ${names.join(", ")}`;
  } catch {
    return "";
  }
}

async function fetchStats(dir: string): Promise<string> {
  try {
    const output = await $`ix stats --format json`.cwd(dir).text();
    const parsed = JSON.parse(output);

    const parts: string[] = [];
    if (parsed.files !== undefined) parts.push(`${parsed.files} files`);
    if (parsed.nodes !== undefined) parts.push(`${parsed.nodes} nodes`);
    if (parsed.edges !== undefined) parts.push(`${parsed.edges} edges`);
    if (parsed.language) parts.push(`language: ${parsed.language}`);

    return parts.length > 0 ? `**Codebase:** ${parts.join(" · ")}` : "";
  } catch {
    return "";
  }
}
