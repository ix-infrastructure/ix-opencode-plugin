// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-smells — architecture smell report
 *
 * Reports the architecture smells (orphan files, god modules, weak components)
 * stored by the last `ix smells` run, via `ix smells --list`. Read-only: it
 * never runs detection itself, because that writes claims to the backend.
 * Use during architecture review or to find improvement candidates.
 */

import { runIx, safeRun, failureDetail } from "../runtime/cli.ts";
import { tryLlm } from "../runtime/llm.ts";
import { formatIxError, needsMap, parseIxError, parseLlmRecord, type IxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-smells";
export const description =
  "Report the architecture smells stored for the graph (orphan files, god modules, weak components) from the last `ix smells` run. Read-only; says when the graph is not mapped or no smells have been detected yet. Use during architecture review or before a large refactor.";

export const parameters = {
  type: "object",
  properties: {
    limit: {
      type: "number",
      description: "Max results to return. Default: 50, max: 200",
      default: 50,
    },
  },
  required: [],
} as const;

// `ix smells` has no path filter (no `--path` at any version): it always runs
// over the whole workspace, so the tool takes no path either.
type Params = {
  limit?: number;
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = toolCwd(context);
  const limit = Math.min(params.limit ?? 50, 200);

  // `--list`, always: bare `ix smells` re-runs detection and writes smell
  // claims to the backend, which a read-only tool must never do. `--list`
  // returns the claims a previous `ix smells` run stored.
  const fast = await tryLlm(["smells", "--list"], dir);
  if (fast) {
    const header = parseLlmRecord(fast.split("\n")[0]!);
    const count = header.kind === "smells" ? Number(header.fields["count"]) : NaN;
    if (count === 0) return await noClaims(dir);
    const records = fast.split("\n");
    const shown = records.slice(0, limit + 1).join("\n");
    const more = records.length - 1 - limit;
    return `## ix-smells\n\n${shown}${more > 0 ? `\n_...and ${more} more (raise \`limit\`)_` : ""}`;
  }

  const run = await runIx(["smells", "--list", "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(failureDetail(run));
  const output = run.stdout;
  // An error record (unmapped workspace, empty graph) has no `smells`, and
  // reading it as a result reported "Architecture looks clean".
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError("## ix-smells", ixErr);

  // `{"count","inference_version","smells":[{"smell","entity_id","confidence"}]}`.
  // The stored claims name the entity by id only; file paths are in the
  // output of a detection run, which this tool does not trigger.
  let raw: {
    count?: number;
    inference_version?: string;
    smells?: { smell?: string; entity_id?: string; confidence?: number }[];
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-smells\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const all = raw.smells ?? [];
  const total = raw.count ?? all.length;
  const claims = all.slice(0, limit);

  if (claims.length === 0) return await noClaims(dir);

  const showing = claims.length < total ? ` (showing ${claims.length} of ${total})` : "";
  const lines = [
    "## ix-smells",
    "",
    `**${total} smell claim${total === 1 ? "" : "s"} stored**${showing}`,
    "",
  ];

  const byKind = new Map<string, typeof claims>();
  for (const c of claims) {
    const kind = (c.smell ?? "unknown").replace(/^has_smell\./, "");
    const group = byKind.get(kind) ?? [];
    group.push(c);
    byKind.set(kind, group);
  }

  for (const [kind, items] of byKind) {
    lines.push(`### ${kind} (${items.length})`);
    for (const item of items.slice(0, 10)) {
      const conf = typeof item.confidence === "number" ? ` — confidence: ${item.confidence.toFixed(2)}` : "";
      lines.push(`- entity \`${item.entity_id ?? "?"}\`${conf}`);
    }
    if (items.length > 10) lines.push(`  _...and ${items.length - 10} more_`);
    lines.push("");
  }

  lines.push("_Claims from the last `ix smells` run. Entities are named by id; `ix smells` (which re-runs detection and stores fresh claims) prints file paths._");
  return lines.join("\n");
}

/**
 * Zero stored claims is not "clean" on its own: an unmapped or empty graph
 * has no claims either, and so does a mapped one `ix smells` never ran on.
 * Ask Ix which it is before saying anything about the architecture.
 */
async function noClaims(dir: string): Promise<string> {
  const health = await graphHealth(dir);
  if (health.error) return formatIxError("## ix-smells", health.error);
  if (health.state === "unmapped") {
    return [
      "## ix-smells",
      "",
      "**The Ix graph for this project is not mapped**, so there is nothing to check for smells — this is not a clean result.",
      "",
      "Run `ix map` from the project root (or call the `ix-ingest` tool with `refresh: true`), then `ix smells` to detect smells.",
    ].join("\n");
  }
  if (health.state === "mapped") {
    return [
      "## ix-smells",
      "",
      "**No smell claims are stored for this graph.** Either the last `ix smells` run found none, or smell detection has not been run on this graph yet.",
      "",
      "Run `ix smells` to (re)detect smells; this tool only reads stored claims.",
    ].join("\n");
  }
  return [
    "## ix-smells",
    "",
    "**No smell claims are stored**, and Ix could not confirm the graph is mapped, so this is not evidence the architecture is clean.",
    "",
    "Check `ix status`; if the graph is missing, run `ix map`, then `ix smells`.",
  ].join("\n");
}

type GraphHealth = { state: "mapped" | "unmapped" | "unknown"; error?: IxError };

/**
 * Whether this directory's workspace has a graph: `ix status` says whether an
 * ingest completed, and `ix stats` whether the backend holds any nodes. Either
 * one saying "no" is enough.
 */
async function graphHealth(dir: string): Promise<GraphHealth> {
  const [statusOut, statsOut] = await Promise.all([
    safeRun(["status", "--format", "json"], dir),
    safeRun(["stats", "--format", "json"], dir),
  ]);
  const err = parseIxError(statsOut) ?? parseIxError(statusOut);
  if (err) return needsMap(err) ? { state: "unmapped", error: err } : { state: "unknown", error: err };

  let completed: boolean | undefined;
  let nodes: number | undefined;
  try {
    const status = JSON.parse(statusOut ?? "") as { graphCompleted?: unknown };
    if (typeof status.graphCompleted === "boolean") completed = status.graphCompleted;
  } catch {
    // no status
  }
  try {
    const stats = JSON.parse(statsOut ?? "") as { nodes?: { total?: unknown } };
    if (typeof stats.nodes?.total === "number") nodes = stats.nodes.total;
  } catch {
    // no stats
  }

  if (completed === false || nodes === 0) return { state: "unmapped" };
  if (completed === true || (nodes !== undefined && nodes > 0)) return { state: "mapped" };
  return { state: "unknown" };
}

function unavailable(err: string): string {
  return [
    "## ix-smells",
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
