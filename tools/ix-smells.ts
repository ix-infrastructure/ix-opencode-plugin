// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-smells — architecture smell report
 *
 * Reports architecture smells (orphan files, god modules, weak components).
 * It reads the claims a previous `ix smells` run stored (`ix smells --list`).
 * When none are stored and the graph is confirmed mapped, it runs detection
 * (`ix smells`), which stores fresh claims for this workspace only, so the
 * answer is never "clean" just because nobody ran detection yet.
 * Use during architecture review or to find improvement candidates.
 */

import { runIx, safeRun, failureDetail } from "../runtime/cli.ts";
import { tryLlm } from "../runtime/llm.ts";
import { formatIxError, needsMap, parseIxError, parseLlmRecord, type IxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-smells";
export const description =
  "Report architecture smells (orphan files, god modules, weak components) for the graph. Reads stored smell claims; if none are stored on a mapped graph, runs detection, which stores claims for this workspace. Set detect=true to re-run detection after code changes. Says when the graph is not mapped. Use during architecture review or before a large refactor.";

export const parameters = {
  type: "object",
  properties: {
    limit: {
      type: "number",
      description: "Max results to return. Default: 50, max: 200",
      default: 50,
    },
    detect: {
      type: "boolean",
      description:
        "Re-run smell detection (`ix smells`) instead of reading stored claims. Stores fresh claims for this workspace. Default: false",
      default: false,
    },
  },
  required: [],
} as const;

// `ix smells` has no path filter (no `--path` at any version): it always runs
// over the whole workspace, so the tool takes no path either.
type Params = {
  limit?: number;
  detect?: boolean;
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = toolCwd(context);
  const limit = Math.min(params.limit ?? 50, 200);

  if (params.detect) return await detect(dir, limit, false);

  const stored = await listStored(dir, limit);
  if (stored !== null) return stored;

  // Nothing stored. Zero claims is not "clean" on its own: an unmapped or
  // empty graph has none either. Only a mapped graph gets a detection run.
  const health = await graphHealth(dir);
  if (health.state !== "mapped") return notMapped(health);
  return await detect(dir, limit, true);
}

/**
 * The claims a previous `ix smells` run stored, via `ix smells --list`, or
 * null when none are stored. Error records and an unusable ix are answers in
 * their own right and are returned as text.
 */
async function listStored(dir: string, limit: number): Promise<string | null> {
  const fast = await tryLlm(["smells", "--list"], dir);
  if (fast) {
    const header = parseLlmRecord(fast.split("\n")[0]!);
    const count = header.kind === "smells" ? Number(header.fields["count"]) : NaN;
    if (count === 0) return null;
    return `## ix-smells\n\n${clip(fast, limit)}\n\n_Stored claims from the last \`ix smells\` run; call again with \`detect: true\` to re-detect after code changes._`;
  }

  const run = await runIx(["smells", "--list", "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(failureDetail(run));
  const output = run.stdout;
  // An error record (unmapped workspace, empty graph) has no `smells`, and
  // reading it as a result reported "Architecture looks clean".
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError("## ix-smells", ixErr);

  // `{"count","inference_version","smells":[{"smell","entity_id","confidence"}]}`.
  // Stored claims name the entity by id only; a detection run names files.
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
  if (claims.length === 0) return null;

  const showing = claims.length < total ? ` (showing ${claims.length} of ${total})` : "";
  const lines = [
    "## ix-smells",
    "",
    `**${total} smell claim${total === 1 ? "" : "s"} stored**${showing}`,
    "",
  ];
  for (const [kind, items] of groupByKind(claims, (c) => c.smell)) {
    lines.push(`### ${kind} (${items.length})`);
    for (const item of items.slice(0, 10)) {
      lines.push(`- entity \`${item.entity_id ?? "?"}\`${confidence(item.confidence)}`);
    }
    if (items.length > 10) lines.push(`  _...and ${items.length - 10} more_`);
    lines.push("");
  }
  lines.push("_Claims from the last `ix smells` run, named by entity id. Call again with `detect: true` to re-detect and get file paths._");
  return lines.join("\n");
}

/**
 * Run detection (`ix smells`). It stores smell claims for this workspace (and
 * only this one), which is what makes the next `--list` answer. `auto` says
 * whether the tool chose to run it because nothing was stored.
 */
async function detect(dir: string, limit: number, auto: boolean): Promise<string> {
  const why = auto
    ? "_No smell claims were stored, so this ran `ix smells` detection on the mapped graph; the results are now stored for this workspace._"
    : "_Fresh `ix smells` detection run; the results are stored for this workspace._";

  const fast = await tryLlm(["smells"], dir);
  if (fast) {
    const header = parseLlmRecord(fast.split("\n")[0]!);
    const count = header.kind === "smells" ? Number(header.fields["count"]) : NaN;
    if (count === 0) return clean(why);
    return `## ix-smells\n\n${clip(fast, limit)}\n\n${why}`;
  }

  const run = await runIx(["smells", "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(failureDetail(run));
  const output = run.stdout;
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError("## ix-smells", ixErr);

  // `{"rev","run_at","count","inference_version","candidates":[{"file","smell","confidence","signals"}]}`
  let raw: {
    count?: number;
    candidates?: { file?: string; smell?: string; confidence?: number }[];
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-smells\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const all = raw.candidates ?? [];
  const total = raw.count ?? all.length;
  if (total === 0 || all.length === 0) return clean(why);
  const shown = [...all].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, limit);

  const showing = shown.length < total ? ` (showing ${shown.length} of ${total})` : "";
  const lines = [
    "## ix-smells",
    "",
    `**${total} smell${total === 1 ? "" : "s"} detected**${showing}`,
    "",
  ];
  for (const [kind, items] of groupByKind(shown, (c) => c.smell)) {
    lines.push(`### ${kind} (${items.length})`);
    for (const item of items.slice(0, 10)) {
      lines.push(`- \`${item.file ?? "?"}\`${confidence(item.confidence)}`);
    }
    if (items.length > 10) lines.push(`  _...and ${items.length - 10} more_`);
    lines.push("");
  }
  lines.push(why);
  return lines.join("\n");
}

function clean(why: string): string {
  return ["## ix-smells", "", "**No smells detected** on the mapped graph.", "", why].join("\n");
}

function clip(records: string, limit: number): string {
  const lines = records.split("\n");
  const shown = lines.slice(0, limit + 1).join("\n");
  const more = lines.length - 1 - limit;
  return more > 0 ? `${shown}\n_...and ${more} more (raise \`limit\`)_` : shown;
}

function confidence(c: number | undefined): string {
  return typeof c === "number" ? ` — confidence: ${c.toFixed(2)}` : "";
}

function groupByKind<T>(items: T[], kindOf: (item: T) => string | undefined): Map<string, T[]> {
  const byKind = new Map<string, T[]>();
  for (const item of items) {
    const kind = (kindOf(item) ?? "unknown").replace(/^has_smell\./, "");
    const group = byKind.get(kind) ?? [];
    group.push(item);
    byKind.set(kind, group);
  }
  return byKind;
}

/** No stored claims, and the graph is not confirmed mapped: say which. */
function notMapped(health: GraphHealth): string {
  if (health.error) return formatIxError("## ix-smells", health.error);
  if (health.state === "unmapped") {
    return [
      "## ix-smells",
      "",
      "**The Ix graph for this project is not mapped**, so there is nothing to check for smells — this is not a clean result.",
      "",
      "Run `ix map` from the project root (or call the `ix-ingest` tool with `refresh: true`), then call this tool again.",
    ].join("\n");
  }
  return [
    "## ix-smells",
    "",
    "**No smell claims are stored**, and Ix could not confirm the graph is mapped, so this is not evidence the architecture is clean.",
    "",
    "Check `ix status`; if the graph is missing, run `ix map`, then call this tool again.",
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
