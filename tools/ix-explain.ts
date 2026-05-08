/**
 * ix-explain — symbol deep explanation
 *
 * Returns a symbol's role, importance, callers, callees, and rendered explanation.
 * More complete than ix-query (which combines locate + brief explain).
 * Use when you need the full picture of what a symbol does and why it matters.
 */

import { $ } from "bun";

export const name = "ix-explain";
export const description =
  "Get a full explanation of a symbol: its role, importance level, caller/callee counts, top dependents, and a plain-English description from the graph. More complete than ix-query.";

export const parameters = {
  type: "object",
  properties: {
    symbol: {
      type: "string",
      description: "Symbol name to explain (class, function, file, or module)",
    },
  },
  required: ["symbol"],
} as const;

type Params = { symbol: string };
type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;

  let output: string;
  try {
    output = await $`ix explain ${params.symbol} --format json`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(params.symbol, msg);
  }

  let raw: {
    resolvedTarget?: { kind?: string; name?: string; path?: string };
    facts?: {
      callerCount?: number;
      calleeCount?: number;
      dependentCount?: number;
      importerCount?: number;
      memberCount?: number;
      topCallers?: string[];
      topDependents?: string[];
      stale?: boolean;
    };
    role?: { role?: string; confidence?: string; reasons?: string[] };
    importance?: { level?: string; category?: string; reasons?: string[] };
    rendered?: { explanation?: string; context?: string; usedBy?: string; whyItMatters?: string; notes?: string[] };
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-explain: ${params.symbol}\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const target = raw.resolvedTarget;
  const facts = raw.facts;
  const role = raw.role;
  const importance = raw.importance;
  const rendered = raw.rendered;

  if (!target && !facts) {
    return [
      `## ix-explain: ${params.symbol}`,
      "",
      "Not found in graph. Try `ix map` to refresh, or check the exact symbol name with ix-query.",
    ].join("\n");
  }

  const lines = [`## ix-explain: ${params.symbol}`, ""];

  if (target?.kind) lines.push(`**Kind:** ${target.kind}`);
  if (target?.path) lines.push(`**Path:** \`${target.path}\``);

  if (role?.role) {
    const conf = role.confidence ? ` (${role.confidence} confidence)` : "";
    lines.push(`**Role:** ${role.role}${conf}`);
    if (role.reasons && role.reasons.length > 0) {
      lines.push(`  _${role.reasons.slice(0, 2).join("; ")}_`);
    }
  }

  if (importance?.level) {
    const cat = importance.category ? ` — ${importance.category}` : "";
    lines.push(`**Importance:** ${importance.level}${cat}`);
  }

  if (facts) {
    const graphLines: string[] = [];
    if (facts.callerCount !== undefined) graphLines.push(`callers: ${facts.callerCount}`);
    if (facts.calleeCount !== undefined) graphLines.push(`callees: ${facts.calleeCount}`);
    if (facts.dependentCount !== undefined) graphLines.push(`dependents: ${facts.dependentCount}`);
    if (facts.memberCount !== undefined) graphLines.push(`members: ${facts.memberCount}`);
    if (graphLines.length > 0) lines.push(`**Graph:** ${graphLines.join(" · ")}`);

    if (facts.topCallers && facts.topCallers.length > 0) {
      lines.push(`**Top callers:** ${facts.topCallers.slice(0, 5).map((c) => `\`${c}\``).join(", ")}`);
    }
    if (facts.topDependents && facts.topDependents.length > 0) {
      lines.push(`**Top dependents:** ${facts.topDependents.slice(0, 5).map((d) => `\`${d}\``).join(", ")}`);
    }
    if (facts.stale) lines.push("\n⚠ Data may be stale — run `ix map` to refresh.");
  }

  if (rendered?.explanation) lines.push("", rendered.explanation);
  if (rendered?.whyItMatters) lines.push("", `**Why it matters:** ${rendered.whyItMatters}`);
  if (rendered?.usedBy) lines.push(`**Used by:** ${rendered.usedBy}`);
  if (rendered?.notes && rendered.notes.length > 0) {
    lines.push("", ...rendered.notes.map((n) => `_${n}_`));
  }

  return lines.join("\n");
}

function unavailable(symbol: string, err: string): string {
  return [
    `## ix-explain: ${symbol}`,
    "",
    "**ix unavailable.** Ensure the ix CLI is installed and `ix map` has been run.",
    "",
    `Error: ${err}`,
  ].join("\n");
}
