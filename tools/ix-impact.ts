// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-impact — blast radius analysis
 *
 * Runs `ix impact` on a symbol or file and returns a structured risk report.
 * Depth of analysis scales with the risk level detected.
 */

import { runIx, safeRun, failureDetail } from "../runtime/cli.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";
import { toolCwd } from "../runtime/paths.ts";

export const name = "ix-impact";
export const description =
  "Analyze the blast radius and change risk for a symbol or file. Returns risk level, direct dependents, key callers, and a go/no-go verdict. Depth scales with risk.";

export const parameters = {
  type: "object",
  properties: {
    target: {
      type: "string",
      description: "Symbol name or file path to assess",
    },
  },
  required: ["target"],
} as const;

type Params = {
  target: string;
};

type Context = {
  directory: string;
  worktree?: string;
};

export async function execute(
  params: Params,
  context: Context
): Promise<string> {
  const dir = toolCwd(context);

  const run = await runIx(["impact", params.target, "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(params.target, failureDetail(run));
  const impactOutput = run.stdout;
  // `ix impact` on a target it cannot resolve, or in an unmapped workspace,
  // prints an error record and exits 1. That is an answer, but not an impact
  // report: reading it as one produced a verdict for a target Ix never found.
  const ixErr = parseIxError(impactOutput);
  if (ixErr) return formatIxError(`## ix-impact: ${params.target}`, ixErr);

  let impact: ImpactRecord;
  try {
    impact = JSON.parse(impactOutput);
  } catch {
    return `**ix-impact: ${params.target}**\n\nFailed to parse impact output.\n\`\`\`\n${impactOutput.slice(0, 500)}\n\`\`\``;
  }

  const risk = typeof impact.riskLevel === "string" ? impact.riskLevel.toLowerCase() : "unknown";
  const summary = impact.summary ?? {};
  const isContainer = typeof summary.callers !== "number";
  const dependentCount = dependentsOf(summary);
  const subsystems = [
    ...new Set(
      (impact.propagationBuckets ?? [])
        .map((b) => b.region)
        .filter((r): r is string => typeof r === "string" && r !== "(unmapped)"),
    ),
  ];
  const base = {
    target: params.target,
    risk,
    riskSummary: impact.riskSummary,
    summary,
    dependentCount,
    atRiskBehaviors: impact.atRiskBehavior,
    subsystems,
    graph: impact.graph,
  };

  // Ix withholds a risk level it cannot compute (a hollow or empty graph says
  // `riskLevel: "unknown"` with a `graph` verdict). That is not a low risk.
  if (!RISK_LEVELS.includes(risk)) {
    return formatReport({ ...base, verdict: "CANNOT ASSESS", callers: [] });
  }

  // Phase 1 result — for low risk with few dependents, stop here
  if (risk === "low" && dependentCount < 3) {
    return formatReport({ ...base, verdict: "SAFE TO PROCEED", callers: [] });
  }

  // Phase 2 — the callers to check. A file or class has no callers of its own;
  // its most-called members are what a change reaches, and Ix already listed
  // them. A function's callers come from `ix callers`.
  let callers: Caller[] = [];
  if (isContainer) {
    callers = (impact.topImpactedMembers ?? []).map((m) => ({
      name: m.name ?? "?",
      path: m.path,
      note: typeof m.callerCount === "number" ? `${m.callerCount} callers` : undefined,
    }));
  } else {
    try {
      // `ix callers` is in the set Ix#547 makes exit 1 on an unresolved target
      // while still printing the record.
      const callersOutput = await safeRun(["callers", params.target, "--limit", "20", "--format", "json"], dir);
      if (callersOutput === null) throw new Error("no output");
      const parsed = JSON.parse(callersOutput) as { results?: { name?: string; path?: string }[] };
      callers = (parsed.results ?? []).map((c) => ({ name: c.name ?? "?", path: c.path }));
    } catch {
      // callers unavailable — fall back to the names impact listed
      callers = (impact.callerList ?? []).map((c) => ({ name: c.name ?? "?" }));
    }
  }

  const verdict =
    risk === "low"
      ? "SAFE TO PROCEED"
      : risk === "medium"
      ? "REVIEW CALLERS FIRST"
      : "NEEDS CHANGE PLAN";

  return formatReport({ ...base, verdict, callers });
}

const RISK_LEVELS: readonly string[] = ["low", "medium", "high", "critical"];

/**
 * The fields `ix impact --format json` emits (Ix ix-cli/src/cli/commands/
 * impact.ts): `riskLevel`, and under `summary` either `callers`/`callees` (a
 * function) or `members`/`directImporters`/`directDependents`/
 * `memberLevelCallers` (a file, class or other container).
 */
type ImpactRecord = {
  riskLevel?: string;
  riskSummary?: string;
  atRiskBehavior?: string[];
  summary?: ImpactSummary;
  callerList?: { name?: string; kind?: string }[];
  topImpactedMembers?: { name?: string; path?: string; callerCount?: number }[];
  propagationBuckets?: { region?: string; count?: number }[];
  graph?: { status?: string; message?: string; fix?: string };
};

type ImpactSummary = {
  callers?: number;
  callees?: number;
  members?: number;
  directImporters?: number;
  directDependents?: number;
  memberLevelCallers?: number;
};

type Caller = { name: string; path?: string; note?: string };

/** Everything that reaches the target: the same total Ix's risk inference uses. */
function dependentsOf(s: ImpactSummary): number {
  return [s.callers, s.directImporters, s.directDependents, s.memberLevelCallers]
    .filter((n): n is number => typeof n === "number")
    .reduce((a, b) => a + b, 0);
}

type ReportArgs = {
  target: string;
  risk: string;
  riskSummary?: string;
  verdict: string;
  summary: ImpactSummary;
  dependentCount: number;
  atRiskBehaviors?: string[];
  callers: Caller[];
  subsystems: string[];
  graph?: { status?: string; message?: string; fix?: string };
};

function formatReport(r: ReportArgs): string {
  const lines = [
    `## Impact: ${r.target}`,
    "",
    `**Risk level:** ${r.risk.toUpperCase()}`,
    `**Verdict:** ${r.verdict}`,
  ];
  if (r.riskSummary) lines.push(`**Summary:** ${r.riskSummary}`);
  lines.push("", "**Blast radius:**");

  const s = r.summary;
  if (typeof s.callers === "number") {
    lines.push(`- Direct callers: ${s.callers}`);
    if (typeof s.callees === "number") lines.push(`- Callees: ${s.callees}`);
  } else {
    if (typeof s.directImporters === "number") lines.push(`- Direct importers: ${s.directImporters}`);
    if (typeof s.directDependents === "number") lines.push(`- Direct dependents: ${s.directDependents}`);
    if (typeof s.memberLevelCallers === "number") lines.push(`- Callers of its members: ${s.memberLevelCallers}`);
    if (typeof s.members === "number") lines.push(`- Members: ${s.members}`);
  }
  lines.push(`- Total reaching it: ${r.dependentCount}`);

  if (r.subsystems.length > 0) {
    lines.push(`- Subsystems affected: ${r.subsystems.join(", ")}`);
  }

  if (r.graph?.status && r.graph.status !== "ok") {
    lines.push("", `**Graph:** ${r.graph.status}${r.graph.message ? ` — ${r.graph.message}` : ""}`);
    if (r.graph.fix) lines.push(`Ix's fix: \`${r.graph.fix}\``);
  }

  if (r.callers.length > 0) {
    lines.push("", "**Key callers:**");
    for (const c of r.callers.slice(0, 5)) {
      const where = c.path ? ` — ${c.path}` : "";
      const note = c.note ? ` (${c.note})` : "";
      lines.push(`- \`${c.name}\`${note}${where}`);
    }
  }

  if (r.atRiskBehaviors && r.atRiskBehaviors.length > 0) {
    lines.push("", "**At-risk behaviors:**");
    for (const b of r.atRiskBehaviors) {
      lines.push(`- ${b}`);
    }
  }

  lines.push("", "**Recommended action:**");
  if (!RISK_LEVELS.includes(r.risk)) {
    lines.push("- Ix could not compute a risk level, so this is not a clearance. Repair the graph (`ix map`), then re-run.");
  } else if (r.risk === "low") {
    lines.push("- Safe to proceed. Verify callers after change.");
  } else if (r.risk === "medium") {
    const named = r.callers.slice(0, 3).map((c) => `\`${c.name}\``);
    lines.push(named.length > 0 ? `- Test ${named.join(", ")} after change.` : "- Review the callers and run tests after this change.");
  } else {
    lines.push("- Run `/ix-plan` before editing. This change needs a sequenced plan.");
  }

  return lines.join("\n");
}

function unavailable(target: string, err: string): string {
  return [
    `## ix-impact: ${target}`,
    "",
    "**ix unavailable.** The Ix graph service is not running or not installed.",
    "",
    "```",
    "command -v ix   # check installation",
    "ix status       # check connection",
    "```",
    "",
    `Error: ${err}`,
  ].join("\n");
}
