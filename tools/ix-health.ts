// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-health — CLI and graph availability probe
 *
 * Checks whether the ix CLI is installed, what version it is,
 * and whether the graph is present and indexed.
 * Use at session start or before running other tools if reliability is uncertain.
 */

import { runIx, safeRun } from "../runtime/cli.ts";
import { parseIxError, type IxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-health";
export const description =
  "Check whether the ix CLI is installed and the graph is indexed. Returns a one-line status summary and any issues found.";

export const parameters = {
  type: "object",
  properties: {},
  required: [],
} as const;

type Params = Record<string, never>;
type Context = { directory: string; worktree?: string };

export async function execute(_params: Params, context: Context): Promise<string> {
  const dir = toolCwd(context);

  // Check CLI availability
  let cliVersion: string | null = null;
  const jsonRun = await runIx(["--version", "--format", "json"], dir, { timeoutMs: 10_000 });
  if (jsonRun && jsonRun.exitCode === 0 && jsonRun.stdout.trim()) {
    const versionOut = jsonRun.stdout.trim();
    try {
      const parsed = JSON.parse(versionOut);
      cliVersion = typeof parsed.version === "string" ? parsed.version : versionOut.split(/\s+/)[0] ?? "unknown";
    } catch {
      cliVersion = versionOut.split(/\s+/)[0] ?? "unknown";
    }
  } else {
    // ix not installed or --format json not supported
    const plainRun = await runIx(["--version"], dir, { timeoutMs: 10_000 });
    if (plainRun && plainRun.exitCode === 0) {
      cliVersion = plainRun.stdout.trim().split(/\s+/)[0] || "unknown";
    }
  }

  if (!cliVersion) {
    return [
      "## ix-health",
      "",
      "**Status: UNAVAILABLE**",
      "",
      "ix CLI not found. Install Ix to enable graph-aware features:",
      "```",
      "command -v ix     # check if installed",
      "ix docker start   # start the local backend",
      "ix map            # build the initial graph",
      "```",
    ].join("\n");
  }

  // Check graph state via ix status
  let graphPresent = false;
  let revision: number | undefined;
  let staleness: string | undefined;
  let ixError: IxError | null = null;

  try {
    // Kept via safeRun: `ix status` exits non-zero for an unhealthy graph while
    // still describing it (Ix#549), and that description is exactly what this
    // health report is for.
    const statusOut = await safeRun(["status", "--format", "json"], dir);
    if (statusOut === null) throw new Error("no output");
    ixError = parseIxError(statusOut);
    if (ixError) throw new Error(ixError.code);
    // `{"backend","graphCompleted","mapCompleted","currentRev","lastIngestAt","staleFiles",...}`
    const status = JSON.parse(statusOut) as {
      graphCompleted?: boolean | null;
      currentRev?: number | null;
      staleFiles?: number;
      lastIngestAt?: string | null;
    };
    if (typeof status.graphCompleted !== "boolean") throw new Error("no graph state");
    graphPresent = status.graphCompleted;
    if (typeof status.currentRev === "number") revision = status.currentRev;
    if (graphPresent) {
      staleness =
        typeof status.staleFiles === "number" && status.staleFiles > 0
          ? `${status.staleFiles} stale files`
          : status.lastIngestAt
            ? `current (last ingest ${status.lastIngestAt})`
            : undefined;
    }
  } catch {
    // Fall back to the stored subsystem scores: present only if a map ran.
    try {
      const subsOut = await safeRun(["subsystems", "--list", "--format", "json"], dir);
      if (subsOut === null) throw new Error("no output");
      ixError = ixError ?? parseIxError(subsOut);
      if (ixError) throw new Error(ixError.code);
      const parsed = JSON.parse(subsOut) as { scores?: unknown[] };
      graphPresent = (parsed.scores ?? []).length > 0;
    } catch {
      // Can't determine graph state
    }
  }

  const lines = ["## ix-health", ""];

  const overallOk = graphPresent;
  lines.push(`**Status:** ${overallOk ? "OK" : "DEGRADED"}`);
  lines.push(`**CLI:** ix ${cliVersion} — installed`);
  lines.push(`**Graph:** ${graphPresent ? `indexed${revision !== undefined ? ` (rev ${revision})` : ""}` : "not indexed — run `ix map`"}`);
  if (ixError) lines.push(`**Ix says:** \`${ixError.code}\` — ${ixError.message}`);
  if (staleness) lines.push(`**Freshness:** ${staleness}`);

  if (!graphPresent) {
    lines.push("", "**Action needed:** Run `ix map` to build the initial graph before using other tools.");
  }

  return lines.join("\n");
}
