/**
 * ix-health — CLI and graph availability probe
 *
 * Checks whether the ix CLI is installed, what version it is,
 * and whether the graph is present and indexed.
 * Use at session start or before running other tools if reliability is uncertain.
 */

import { $ } from "bun";
import { safeRun } from "../runtime/cli.ts";
import { getRuntime } from "../runtime/client.ts";

export const name = "ix-health";
export const description =
  "Check whether the ix CLI is installed, the graph is indexed, and the Ix Core Runtime is reachable. Returns a one-line status summary and any issues found.";

export const parameters = {
  type: "object",
  properties: {},
  required: [],
} as const;

type Params = Record<string, never>;
type Context = { directory: string; worktree?: string };

export async function execute(_params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;

  // Check CLI availability
  let cliVersion: string | null = null;
  try {
    const versionOut = await $`ix --version --format json`.cwd(dir).quiet().text();
    try {
      const parsed = JSON.parse(versionOut.trim());
      cliVersion = typeof parsed.version === "string" ? parsed.version : versionOut.trim().split(/\s+/)[0] ?? "unknown";
    } catch {
      cliVersion = versionOut.trim().split(/\s+/)[0] ?? "unknown";
    }
  } catch {
    // ix not installed or --format json not supported
    try {
      const versionOut = await $`ix --version`.cwd(dir).quiet().text();
      cliVersion = versionOut.trim().split(/\s+/)[0] ?? "unknown";
    } catch {
      cliVersion = null;
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
  let fileCount: number | undefined;
  let staleness: string | undefined;

  try {
    // Kept via safeRun: `ix status` exits non-zero for an unhealthy graph while
    // still describing it (Ix#549), and that description is exactly what this
    // health report is for.
    const statusOut = await safeRun($`ix status --format json`.cwd(dir));
    if (statusOut === null) throw new Error("no output");
    const status = JSON.parse(statusOut);
    graphPresent = (status.currentRev ?? 0) > 0 || status.graphPresent === true;
    fileCount = status.fileCount;
    staleness = status.staleFiles > 0 ? `${status.staleFiles} stale files` : status.staleness;
  } catch {
    // Fall back to subsystems probe
    try {
      const subsOut = await safeRun($`ix subsystems --list --format json`.cwd(dir));
      if (subsOut === null) throw new Error("no output");
      const parsed = JSON.parse(subsOut);
      const names: string[] = parsed.names ?? parsed.list ?? [];
      graphPresent = names.length > 0;
    } catch {
      // Can't determine graph state
    }
  }

  // Check runtime
  const runtimeStatus = await getRuntime("/v2/status", { timeoutMs: 2000 });
  const runtimeReachable = runtimeStatus !== null;

  const lines = ["## ix-health", ""];

  const overallOk = graphPresent;
  lines.push(`**Status:** ${overallOk ? "OK" : "DEGRADED"}`);
  lines.push(`**CLI:** ix ${cliVersion} — installed`);
  lines.push(`**Graph:** ${graphPresent ? `indexed${fileCount !== undefined ? ` (${fileCount} files)` : ""}` : "not indexed — run `ix map`"}`);
  if (staleness) lines.push(`**Freshness:** ${staleness}`);
  lines.push(`**Runtime (v2):** ${runtimeReachable ? "reachable" : "not available (expected until 2026-07-15)"}`);

  if (!graphPresent) {
    lines.push("", "**Action needed:** Run `ix map` to build the initial graph before using other tools.");
  }

  return lines.join("\n");
}
