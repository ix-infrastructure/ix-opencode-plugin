// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-decide — pre-edit policy gate
 *
 * Runs `ix impact` on each touched path and synthesizes a conservative policy
 * verdict (ALLOW / REVIEW / BLOCK) with required actions and evidence.
 *
 * ## Fails closed
 *
 * ALLOW is a clearance, so it is only ever given on evidence: a parsed impact
 * record, for every touched path, with a real risk level and dependent counts.
 * Anything short of that -- no `ix`, a timeout, an error record (unmapped
 * workspace, unresolved target, empty or hollow graph), output that does not
 * parse, a withheld `riskLevel: "unknown"`, more paths than are checked -- is
 * REVIEW, with the reason. A gate that cannot see must not say "go".
 *
 * Fields are the ones `ix impact --format json` emits (Ix
 * ix-cli/src/cli/commands/impact.ts): `riskLevel`, and under `summary` either
 * `directImporters` / `directDependents` / `memberLevelCallers` (a file or
 * other container) or `callers` (a function). Their sum is the same total Ix's
 * own risk inference uses.
 */

import { failureDetail, runIx } from "../runtime/cli.ts";
import { ixErrorFromJson, ixErrorLines, runFailure, type IxError } from "../runtime/ix-error.ts";

export const name = "ix-decide";
export const description =
  "Get a policy verdict before editing files. Returns ALLOW, REVIEW, or BLOCK with required actions and blast radius evidence. Used by the pre-edit hook and by ix-plan for high-risk changes.";

export const parameters = {
  type: "object",
  properties: {
    touched_paths: {
      type: "array",
      items: { type: "string" },
      description: "File paths that will be edited",
    },
    intent: {
      type: "string",
      description: "What kind of change: edit, refactor, delete, or add. Default: edit",
      enum: ["edit", "refactor", "delete", "add"],
      default: "edit",
    },
    risk_tolerance: {
      type: "string",
      description: "Risk tolerance for the verdict. Default: medium",
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  required: ["touched_paths"],
} as const;

type Params = {
  touched_paths: string[];
  intent?: "edit" | "refactor" | "delete" | "add";
  risk_tolerance?: "low" | "medium" | "high";
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;
  const intent = params.intent ?? "edit";
  const riskTolerance = params.risk_tolerance ?? "medium";

  return await impactVerdict(params.touched_paths, intent, riskTolerance, dir);
}

/** At most this many paths are checked; the rest force REVIEW. */
const MAX_PATHS = 5;

type RiskLevel = "low" | "medium" | "high" | "critical";
const RISK_LEVELS: readonly string[] = ["low", "medium", "high", "critical"];

type Assessment =
  | { path: string; ok: true; risk: RiskLevel; dependents: number; regions: string[] }
  | { path: string; ok: false; reason: string; ixError?: IxError };

/** The `ix impact --format json` fields this gate reads. */
type ImpactRecord = {
  riskLevel?: unknown;
  graph?: { status?: unknown };
  summary?: Record<string, unknown>;
  propagationBuckets?: { region?: unknown }[];
};

const COUNT_FIELDS = ["directImporters", "directDependents", "memberLevelCallers", "callers"] as const;

async function assess(filePath: string, dir: string): Promise<Assessment> {
  // `runIx`, not `safeRun`: an unresolved path exits 1 while printing a record,
  // and this gate needs to tell that record from no answer at all.
  const run = await runIx(["impact", filePath, "--format", "json"], dir);
  const failure = runFailure(run);
  if (failure === "not_installed") return { path: filePath, ok: false, reason: "ix CLI not found on PATH" };
  if (failure) return { path: filePath, ok: false, reason: failureDetail(run) };

  let parsed: unknown;
  try {
    parsed = JSON.parse(run!.stdout);
  } catch {
    return { path: filePath, ok: false, reason: "`ix impact` output did not parse as JSON" };
  }

  const ixError = ixErrorFromJson(parsed);
  if (ixError) {
    return { path: filePath, ok: false, reason: `Ix error \`${ixError.code}\`: ${ixError.message}`, ixError };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { path: filePath, ok: false, reason: "`ix impact` output is not an impact record" };
  }

  const impact = parsed as ImpactRecord;
  const graphStatus = typeof impact.graph?.status === "string" ? impact.graph.status : undefined;
  if (graphStatus && graphStatus !== "ok") {
    return { path: filePath, ok: false, reason: `Ix reports the graph as ${graphStatus}, so its counts cannot be trusted` };
  }

  const risk = typeof impact.riskLevel === "string" ? impact.riskLevel.toLowerCase() : undefined;
  if (!risk || !RISK_LEVELS.includes(risk)) {
    return { path: filePath, ok: false, reason: `Ix gave no usable risk level (riskLevel: ${risk ?? "missing"})` };
  }

  const summary = impact.summary ?? {};
  const counts = COUNT_FIELDS.map((k) => summary[k]).filter((v): v is number => typeof v === "number");
  if (counts.length === 0) {
    return { path: filePath, ok: false, reason: "`ix impact` output has no dependent counts" };
  }

  const regions = (impact.propagationBuckets ?? [])
    .map((b) => b.region)
    .filter((r): r is string => typeof r === "string" && r !== "(unmapped)");

  return {
    path: filePath,
    ok: true,
    risk: risk as RiskLevel,
    dependents: counts.reduce((a, b) => a + b, 0),
    regions,
  };
}

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

async function impactVerdict(
  paths: string[],
  intent: string,
  riskTolerance: string,
  dir: string
): Promise<string> {
  const checked = paths.slice(0, MAX_PATHS);
  const unassessed = paths.length - checked.length;

  const assessments: Assessment[] = [];
  for (const filePath of checked) assessments.push(await assess(filePath, dir));

  const ok = assessments.filter((a): a is Extract<Assessment, { ok: true }> => a.ok);
  const failed = assessments.filter((a): a is Extract<Assessment, { ok: false }> => !a.ok);

  let maxRisk: RiskLevel = "low";
  let totalDependents = 0;
  const subsystems = new Set<string>();
  for (const a of ok) {
    if (RANK[a.risk] > RANK[maxRisk]) maxRisk = a.risk;
    totalDependents += a.dependents;
    a.regions.forEach((r) => subsystems.add(r));
  }

  // Verdict thresholds (adjusted by risk_tolerance)
  const toleranceMultiplier = riskTolerance === "low" ? 0.5 : riskTolerance === "high" ? 2 : 1;
  const reviewThreshold = Math.round(5 * toleranceMultiplier);
  const blockThreshold = Math.round(20 * toleranceMultiplier);

  // Anything not assessed counts against ALLOW: no paths, a path past the cap,
  // or a path Ix could not answer for.
  const incomplete = paths.length === 0 || unassessed > 0 || failed.length > 0;

  let verdict: string;
  let requiredAction: string;

  if (maxRisk === "critical" || totalDependents >= blockThreshold) {
    verdict = "BLOCK";
    requiredAction = "Run `/ix-plan` to generate a sequenced change plan before proceeding.";
  } else if (incomplete) {
    verdict = "REVIEW";
    requiredAction =
      "Ix could not assess every touched file, so this is not a clearance. Review the callers of the unassessed files and run tests after this change.";
  } else if (maxRisk === "high" || maxRisk === "medium" || totalDependents >= reviewThreshold) {
    verdict = "REVIEW";
    requiredAction = "Review callers and run tests after this change.";
  } else {
    verdict = "ALLOW";
    requiredAction = "Safe to proceed. Verify affected callers after the change.";
  }

  const notAssessed = failed.length + unassessed;
  const riskLabel = ok.length === 0 ? "UNKNOWN" : maxRisk.toUpperCase();
  const lines = [
    `## ix-decide: ${paths.length === 1 ? paths[0] : `${paths.length} files`}`,
    "",
    `**Verdict:** ${verdict}`,
    `**Risk:** ${riskLabel}${notAssessed > 0 && ok.length > 0 ? ` (${notAssessed} file${notAssessed === 1 ? "" : "s"} not assessed)` : ""}`,
    `**Total dependents:** ${ok.length === 0 && paths.length > 0 ? "unknown" : totalDependents}`,
  ];

  if (subsystems.size > 0) {
    lines.push(`**Subsystems affected:** ${[...subsystems].join(", ")}`);
  }

  if (intent !== "edit") lines.push(`**Intent:** ${intent}`);

  lines.push("", `**Required action:** ${requiredAction}`);

  if (paths.length === 0) {
    lines.push("", "**Not assessed:** no touched_paths were given.");
  }

  if (failed.length > 0) {
    lines.push("", "**Not assessed:**");
    for (const f of failed) lines.push(`- \`${f.path}\` — ${f.reason}`);
    // Ix's own guidance once, from the first error record: an unmapped
    // workspace is the same answer for every path. Its first line repeats the
    // code and message already listed above, so it is dropped.
    const ixError = failed.find((f) => f.ixError)?.ixError;
    if (ixError) lines.push("", ...ixErrorLines(ixError).slice(2));
  }

  if (unassessed > 0) {
    lines.push("", `**Not assessed:** ${unassessed} path${unassessed === 1 ? "" : "s"} beyond the first ${MAX_PATHS}.`);
  }

  if (paths.length > 1) {
    lines.push("", "**Per-file breakdown:**");
    for (const a of assessments) {
      lines.push(
        a.ok
          ? `- \`${a.path}\` — ${a.risk.toUpperCase()}, ${a.dependents} dependents`
          : `- \`${a.path}\` — UNKNOWN (not assessed)`,
      );
    }
  }

  lines.push("", "_Verdict synthesized from `ix impact`._");

  return lines.join("\n");
}
