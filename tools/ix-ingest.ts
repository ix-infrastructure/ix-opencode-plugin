/**
 * ix-ingest — ingest status and trigger
 *
 * Checks whether the Ix graph is present and fresh.
 * Can optionally trigger a graph refresh via `ix map`.
 */

import { $ } from "bun";

export const name = "ix-ingest";
export const description =
  "Check the Ix graph ingestion status. Returns whether the graph is present, how fresh it is, and whether a refresh is recommended. Can optionally trigger a graph rebuild.";

export const parameters = {
  type: "object",
  properties: {
    refresh: {
      type: "boolean",
      description:
        "If true, trigger a graph refresh via `ix map`. Default: false (status check only)",
      default: false,
    },
    silent: {
      type: "boolean",
      description:
        "If refresh is true: run `ix map --silent` (suppress output). Default: true",
      default: true,
    },
  },
  required: [],
} as const;

type Params = {
  refresh?: boolean;
  silent?: boolean;
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

  // Check ix availability first
  let ixAvailable = false;
  try {
    await $`command -v ix`.cwd(dir).quiet().text();
    ixAvailable = true;
  } catch {
    return unavailable();
  }

  if (!ixAvailable) return unavailable();

  // If refresh requested, trigger ix map
  if (params.refresh) {
    const silent = params.silent !== false;
    try {
      if (silent) {
        await $`ix map --silent`.cwd(dir).text();
      } else {
        await $`ix map`.cwd(dir).text();
      }
      return [
        "## ix-ingest: graph refresh",
        "",
        "**Status:** Graph refresh complete.",
        "The Ix graph has been rebuilt. Graph data is now current.",
      ].join("\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        "## ix-ingest: graph refresh",
        "",
        `**Status:** Refresh failed — ${msg}`,
        "",
        "Try running `ix map` manually to diagnose.",
      ].join("\n");
    }
  }

  // Status check
  let statusOutput = "";
  try {
    statusOutput = await $`ix status --format json`.cwd(dir).text();
  } catch {
    // ix status may not be available — fall back to subsystems probe
    return await probeStatus(dir);
  }

  let status: {
    connected?: boolean;
    graphPresent?: boolean;
    lastUpdated?: string;
    fileCount?: number;
    staleness?: string;
    recommendation?: string;
  };
  try {
    status = JSON.parse(statusOutput);
  } catch {
    return await probeStatus(dir);
  }

  return formatStatus(status);
}

async function probeStatus(dir: string): Promise<string> {
  // Probe by running ix subsystems — if it returns data, graph is present
  try {
    const output = await $`ix subsystems --list --format json`.cwd(dir).text();
    const parsed = JSON.parse(output);
    const names: string[] = parsed.names ?? parsed.list ?? [];

    if (names.length === 0) {
      return [
        "## ix-ingest: status",
        "",
        "**Status:** Graph is empty — no subsystems found.",
        "",
        "Run `ix map` to build the graph:",
        "```",
        "ix map",
        "```",
      ].join("\n");
    }

    return [
      "## ix-ingest: status",
      "",
      "**Status:** Graph is present.",
      `**Subsystems found:** ${names.length} (${names.slice(0, 5).join(", ")}${names.length > 5 ? "..." : ""})`,
      "",
      "_Detailed freshness data unavailable. Run `ix status` directly for more info._",
    ].join("\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return [
      "## ix-ingest: status",
      "",
      `**Status:** Could not determine graph state — ${msg}`,
      "",
      "Ensure ix is connected: `ix connect`",
    ].join("\n");
  }
}

function formatStatus(status: {
  connected?: boolean;
  graphPresent?: boolean;
  lastUpdated?: string;
  fileCount?: number;
  staleness?: string;
  recommendation?: string;
}): string {
  const lines = ["## ix-ingest: status", ""];

  if (status.connected !== undefined) {
    lines.push(
      `**Connected:** ${status.connected ? "yes" : "no ⚠"}`
    );
  }
  if (status.graphPresent !== undefined) {
    lines.push(
      `**Graph present:** ${status.graphPresent ? "yes" : "no — run `ix map`"}`
    );
  }
  if (status.fileCount !== undefined) {
    lines.push(`**Files indexed:** ${status.fileCount}`);
  }
  if (status.lastUpdated) {
    lines.push(`**Last updated:** ${status.lastUpdated}`);
  }
  if (status.staleness) {
    lines.push(`**Freshness:** ${status.staleness}`);
  }
  if (status.recommendation) {
    lines.push("", `**Recommendation:** ${status.recommendation}`);
  }

  return lines.join("\n");
}

function unavailable(): string {
  return [
    "## ix-ingest: status",
    "",
    "**ix CLI not found.** Install Ix to enable graph-aware features.",
    "",
    "```",
    "command -v ix   # check if installed",
    "ix connect      # connect to workspace",
    "ix map          # build initial graph",
    "```",
  ].join("\n");
}
