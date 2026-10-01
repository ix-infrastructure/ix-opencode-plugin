// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-ingest — ingest status and trigger
 *
 * Checks whether the Ix graph is present and fresh.
 * Can optionally trigger a graph refresh via `ix map`.
 */

import { runIx, safeRun, failureDetail } from "../runtime/cli.ts";
import { resolveGitRoot, isUnmappableRoot } from "../runtime/automap.ts";

// An explicit rebuild can take minutes on a large repo; it is still bounded.
const REFRESH_TIMEOUT_MS = 10 * 60_000;

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

  // Bun's shell has no `command` builtin, so `$\`command -v ix\`` threw on
  // every machine and this tool reported "ix CLI not found" unconditionally.
  if (!Bun.which("ix")) return unavailable();

  if (params.refresh) return await refresh(context, params.silent !== false);

  // Status check
  // `ix status` exits non-zero when the graph is unhealthy but still reports
  // why (Ix#549). That report is the answer this tool wants; only a genuinely
  // empty result should fall through to the probe.
  const statusRun = await safeRun(["status", "--format", "json"], dir);
  if (statusRun === null) return await probeStatus(dir);
  const statusOutput = statusRun;

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

/**
 * Rebuild the graph for the project's git root.
 *
 * `ix map` takes a directory, never a file, and the directory is the repo root
 * -- not OpenCode's worktree, which is "/" for a project outside git. A root of
 * $HOME or / is refused: mapping either would ingest everything under it.
 */
async function refresh(context: Context, silent: boolean): Promise<string> {
  const root = (await resolveGitRoot(context.directory)) ?? context.directory;
  if (isUnmappableRoot(root)) {
    return [
      "## ix-ingest: graph refresh",
      "",
      `**Status:** Not refreshed — \`${root}\` is not a project root.`,
      "",
      "Run `ix map <project-dir>` from the project you want indexed.",
    ].join("\n");
  }

  const args = silent ? ["map", root, "--silent"] : ["map", root];
  const run = await runIx(args, root, { timeoutMs: REFRESH_TIMEOUT_MS });
  if (run && run.exitCode === 0) {
    return [
      "## ix-ingest: graph refresh",
      "",
      "**Status:** Graph refresh complete.",
      "The Ix graph has been rebuilt. Graph data is now current.",
    ].join("\n");
  }
  return [
    "## ix-ingest: graph refresh",
    "",
    `**Status:** Refresh failed — ${failureDetail(run)}`,
    "",
    "Try running `ix map` manually to diagnose.",
  ].join("\n");
}

async function probeStatus(dir: string): Promise<string> {
  // Probe by running ix subsystems — if it returns data, graph is present
  try {
    const output = await safeRun(["subsystems", "--list", "--format", "json"], dir);
    if (output === null) throw new Error("no output");
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
      "Ensure the backend is running: `ix docker start`, then check `ix status`.",
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
    "command -v ix     # check if installed",
    "ix docker start   # start the local backend",
    "ix map            # build the initial graph",
    "```",
  ].join("\n");
}
