/**
 * ix-docs-tool — doc/context summary retrieval
 *
 * Retrieves a structured context summary for a symbol, subsystem, or file.
 * Produces a condensed architectural briefing suitable for injecting as context.
 * Not the same as the /ix-docs skill — this is a lightweight context fetcher.
 */

import { $ } from "bun";
import { callRuntime } from "../runtime/client.ts";

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
  const dir = context.worktree ?? context.directory;
  const depth = params.depth ?? "standard";

  // Try runtime API first — use preview_markdown when available
  const depthMap = { brief: "shallow", standard: "medium", full: "deep" } as const;
  const rr = await callRuntime("/v2/ix_query", {
    query: {
      mode: "docs",
      depth: depthMap[depth],
      targets: [{ kind: "path", value: params.target }],
    },
  }, { dir });
  if (typeof rr?.preview_markdown === "string") return rr.preview_markdown;

  // Phase 1: locate + overview in parallel
  const [locateOut, overviewOut, statsOut] = await Promise.all([
    safeRun($`ix locate ${params.target} --format json`.cwd(dir)),
    safeRun($`ix overview ${params.target} --format json`.cwd(dir)),
    depth !== "brief"
      ? safeRun($`ix stats --format json`.cwd(dir))
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

  const sections: string[] = [
    `## Context: ${params.target}`,
    "",
  ];

  // Stats
  if (statsOut) {
    try {
      const stats = JSON.parse(statsOut);
      const parts: string[] = [];
      if (stats.files) parts.push(`${stats.files} files`);
      if (stats.nodes) parts.push(`${stats.nodes} nodes`);
      if (stats.language) parts.push(stats.language);
      if (parts.length > 0) sections.push(`_${parts.join(" · ")}_`, "");
    } catch {
      // ignore
    }
  }

  // Overview
  if (overviewOut) {
    try {
      const overview = JSON.parse(overviewOut);
      sections.push(formatOverview(overview));
    } catch {
      // fallback
    }
  }

  if (depth === "brief") {
    return sections.join("\n");
  }

  // Phase 2: explain key components
  let components: string[] = [];
  if (overviewOut) {
    try {
      const overview = JSON.parse(overviewOut);
      const members = overview.members ?? overview.components ?? [];
      components = members.slice(0, depth === "full" ? 8 : 5).map(
        (m: { name?: string }) => m.name ?? ""
      ).filter(Boolean);
    } catch {
      // no components
    }
  }

  if (components.length > 0) {
    const explains = await Promise.all(
      components.map((c) =>
        safeRun($`ix explain ${c} --format json`.cwd(dir))
      )
    );

    const componentLines = ["**Key Components:**", ""];
    for (let i = 0; i < components.length; i++) {
      const out = explains[i];
      if (!out) continue;
      try {
        const e = JSON.parse(out);
        const role = e.role ? ` — ${e.role}` : "";
        const callers = e.callerCount !== undefined ? ` (${e.callerCount} callers)` : "";
        componentLines.push(`- \`${components[i]}\`${callers}${role}`);
      } catch {
        componentLines.push(`- \`${components[i]}\``);
      }
    }
    sections.push(componentLines.join("\n"), "");
  }

  if (depth === "full") {
    // Phase 3: impact for context
    const impactOut = await safeRun(
      $`ix impact ${params.target} --format json`.cwd(dir)
    );
    if (impactOut) {
      try {
        const impact = JSON.parse(impactOut);
        const risk = impact.risk ?? "unknown";
        const dependents = impact.dependentCount ?? 0;
        sections.push(
          `**Change risk:** ${risk.toUpperCase()} (${dependents} direct dependents)`,
          ""
        );
      } catch {
        // ignore
      }
    }
  }

  return sections.join("\n");
}

function formatOverview(overview: {
  name?: string;
  kind?: string;
  path?: string;
  summary?: string;
  purpose?: string;
  fileCount?: number;
  memberCount?: number;
  subsystem?: string;
}): string {
  const lines: string[] = [];

  if (overview.kind) lines.push(`**Kind:** ${overview.kind}`);
  if (overview.path) lines.push(`**Path:** ${overview.path}`);
  if (overview.subsystem) lines.push(`**Subsystem:** ${overview.subsystem}`);
  if (overview.fileCount !== undefined)
    lines.push(`**Files:** ${overview.fileCount}`);
  if (overview.memberCount !== undefined)
    lines.push(`**Members:** ${overview.memberCount}`);

  const summary = overview.summary ?? overview.purpose;
  if (summary) lines.push("", summary);

  return lines.join("\n") + "\n";
}

async function safeRun(
  cmd: ReturnType<typeof $>
): Promise<string | null> {
  try {
    return await cmd.text();
  } catch {
    return null;
  }
}
