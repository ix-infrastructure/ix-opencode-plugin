/**
 * ix-impact — blast radius analysis
 *
 * Runs `ix impact` on a symbol or file and returns a structured risk report.
 * Depth of analysis scales with the risk level detected.
 */

import { $ } from "bun";

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
  const dir = context.worktree ?? context.directory;

  let impactOutput: string;
  try {
    impactOutput = await $`ix impact ${params.target} --format json`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(params.target, msg);
  }

  let impact: {
    target?: string;
    risk?: string;
    dependentCount?: number;
    transitiveCount?: number;
    atRiskBehaviors?: string[];
    subsystems?: string[];
  };
  try {
    impact = JSON.parse(impactOutput);
  } catch {
    return `**ix-impact: ${params.target}**\n\nFailed to parse impact output.\n\`\`\`\n${impactOutput.slice(0, 500)}\n\`\`\``;
  }

  const risk = (impact.risk ?? "unknown").toLowerCase();
  const dependentCount = impact.dependentCount ?? 0;

  // Phase 1 result — for low risk with few dependents, stop here
  if (risk === "low" && dependentCount < 3) {
    return formatReport({
      target: params.target,
      risk,
      verdict: "SAFE TO PROCEED",
      dependentCount,
      transitiveCount: impact.transitiveCount,
      atRiskBehaviors: impact.atRiskBehaviors,
      callers: [],
      subsystems: impact.subsystems,
    });
  }

  // Phase 2 — fetch callers for medium/high/critical
  let callers: { name: string; subsystem?: string; file?: string }[] = [];
  try {
    const callersOutput = await $`ix callers ${params.target} --limit 20 --format json`.cwd(dir).text();
    const parsed = JSON.parse(callersOutput);
    callers = parsed.items ?? [];
  } catch {
    // callers unavailable — continue with what we have
  }

  const verdict =
    risk === "low"
      ? "SAFE TO PROCEED"
      : risk === "medium"
      ? "REVIEW CALLERS FIRST"
      : "NEEDS CHANGE PLAN";

  return formatReport({
    target: params.target,
    risk,
    verdict,
    dependentCount,
    transitiveCount: impact.transitiveCount,
    atRiskBehaviors: impact.atRiskBehaviors,
    callers,
    subsystems: impact.subsystems,
  });
}

type ReportArgs = {
  target: string;
  risk: string;
  verdict: string;
  dependentCount: number;
  transitiveCount?: number;
  atRiskBehaviors?: string[];
  callers: { name: string; subsystem?: string; file?: string }[];
  subsystems?: string[];
};

function formatReport(r: ReportArgs): string {
  const lines = [
    `## Impact: ${r.target}`,
    "",
    `**Risk level:** ${r.risk.toUpperCase()}`,
    `**Verdict:** ${r.verdict}`,
    "",
    "**Blast radius:**",
    `- Direct dependents: ${r.dependentCount}`,
  ];

  if (r.transitiveCount !== undefined) {
    lines.push(`- Transitive (depth 2): ${r.transitiveCount}`);
  }
  if (r.subsystems && r.subsystems.length > 0) {
    lines.push(`- Subsystems affected: ${r.subsystems.join(", ")}`);
  }

  if (r.callers.length > 0) {
    lines.push("", "**Key callers:**");
    for (const c of r.callers.slice(0, 5)) {
      const label = c.subsystem ? ` [${c.subsystem}]` : "";
      lines.push(`- \`${c.name}\`${label}`);
    }
  }

  if (r.atRiskBehaviors && r.atRiskBehaviors.length > 0) {
    lines.push("", "**At-risk behaviors:**");
    for (const b of r.atRiskBehaviors) {
      lines.push(`- ${b}`);
    }
  }

  lines.push("", "**Recommended action:**");
  if (r.risk === "low") {
    lines.push("- Safe to proceed. Verify callers after change.");
  } else if (r.risk === "medium") {
    lines.push(
      `- Test ${r.callers
        .slice(0, 3)
        .map((c) => `\`${c.name}\``)
        .join(", ")} after change.`
    );
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
