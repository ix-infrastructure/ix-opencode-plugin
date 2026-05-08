/**
 * ix-decide — pre-edit policy gate
 *
 * Routes through the Ix Core Runtime `ix_decide` endpoint when the runtime is
 * available, returning a formal policy verdict (ALLOW / REVIEW / BLOCK) with
 * required actions and evidence.
 *
 * When the runtime is unavailable (expected until 2026-07-15 alpha), falls back
 * to running `ix impact` on each touched path and synthesizing a conservative verdict.
 */

import { $ } from "bun";
import { callRuntime } from "../runtime/client.ts";

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

  // Try the runtime API first
  const runtimeResult = await callRuntime(
    "/v2/ix_decide",
    {
      proposal: {
        intent,
        touched_paths: params.touched_paths,
        risk_tolerance: riskTolerance,
      },
    },
    { dir }
  );

  if (runtimeResult) {
    return formatRuntimeVerdict(params.touched_paths, runtimeResult);
  }

  // Runtime not available — fall back to ix impact on each path
  return await fallbackImpactVerdict(params.touched_paths, intent, riskTolerance, dir);
}

function formatRuntimeVerdict(
  paths: string[],
  result: Record<string, unknown>
): string {
  const decision = (result.decision as Record<string, unknown> | undefined) ?? {};
  const verdict = String(decision.verdict ?? "REVIEW").toUpperCase();
  const reason = String(decision.reason ?? "See impact data below.");
  const requiredActions = (decision.required_actions as string[] | undefined) ?? [];
  const impact = (result.impact as Record<string, unknown> | undefined) ?? {};

  const lines = [
    `## ix-decide: ${paths.length === 1 ? paths[0] : `${paths.length} files`}`,
    "",
    `**Verdict:** ${verdict}`,
    `**Reason:** ${reason}`,
  ];

  if (impact.risk_level) lines.push(`**Risk:** ${String(impact.risk_level).toUpperCase()}`);
  if (impact.direct_dependents !== undefined) lines.push(`**Direct dependents:** ${impact.direct_dependents}`);
  if (impact.crosses_architectural_boundary) lines.push("⚠ **Crosses architectural boundary**");

  if (requiredActions.length > 0) {
    lines.push("", "**Required actions:**");
    for (const action of requiredActions) lines.push(`- ${action}`);
  }

  return lines.join("\n");
}

async function fallbackImpactVerdict(
  paths: string[],
  intent: string,
  riskTolerance: string,
  dir: string
): Promise<string> {
  type ImpactResult = {
    risk?: string;
    dependentCount?: number;
    transitiveCount?: number;
    subsystems?: string[];
  };

  const impacts: { path: string; result: ImpactResult | null }[] = [];

  for (const filePath of paths.slice(0, 5)) {
    try {
      const out = await $`ix impact ${filePath} --format json`.cwd(dir).quiet().text();
      impacts.push({ path: filePath, result: JSON.parse(out) as ImpactResult });
    } catch {
      impacts.push({ path: filePath, result: null });
    }
  }

  // Synthesize verdict from highest risk across all paths
  let maxRisk = "low";
  let totalDependents = 0;
  const subsystems = new Set<string>();

  for (const { result } of impacts) {
    if (!result) continue;
    const risk = (result.risk ?? "low").toLowerCase();
    if (risk === "critical" || (risk === "high" && maxRisk !== "critical")) maxRisk = risk;
    else if (risk === "medium" && maxRisk === "low") maxRisk = risk;
    totalDependents += result.dependentCount ?? 0;
    (result.subsystems ?? []).forEach((s) => subsystems.add(s));
  }

  // Verdict thresholds (adjusted by risk_tolerance)
  const toleranceMultiplier = riskTolerance === "low" ? 0.5 : riskTolerance === "high" ? 2 : 1;
  const reviewThreshold = Math.round(5 * toleranceMultiplier);
  const blockThreshold = Math.round(20 * toleranceMultiplier);

  let verdict: string;
  let requiredAction: string;

  if (maxRisk === "critical" || totalDependents >= blockThreshold) {
    verdict = "BLOCK";
    requiredAction = "Run `/ix-plan` to generate a sequenced change plan before proceeding.";
  } else if (maxRisk === "high" || maxRisk === "medium" || totalDependents >= reviewThreshold) {
    verdict = "REVIEW";
    requiredAction = "Review callers and run tests after this change.";
  } else {
    verdict = "ALLOW";
    requiredAction = "Safe to proceed. Verify affected callers after the change.";
  }

  const lines = [
    `## ix-decide: ${paths.length === 1 ? paths[0] : `${paths.length} files`}`,
    "",
    `**Verdict:** ${verdict}`,
    `**Risk:** ${maxRisk.toUpperCase()}`,
    `**Total dependents:** ${totalDependents}`,
  ];

  if (subsystems.size > 0) {
    lines.push(`**Subsystems affected:** ${[...subsystems].join(", ")}`);
  }

  if (intent !== "edit") lines.push(`**Intent:** ${intent}`);

  lines.push("", `**Required action:** ${requiredAction}`);

  if (paths.length > 1) {
    lines.push("", "**Per-file breakdown:**");
    for (const { path, result } of impacts) {
      const risk = result?.risk ?? "unknown";
      const deps = result?.dependentCount ?? 0;
      lines.push(`- \`${path}\` — ${risk.toUpperCase()}, ${deps} dependents`);
    }
  }

  lines.push("", "_[Runtime unavailable — verdict synthesized from ix impact fallback]_");

  return lines.join("\n");
}
