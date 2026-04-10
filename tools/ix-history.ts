/**
 * ix-history — revision and history lookup
 *
 * Returns change history, recent decisions, and recorded bugs
 * for a symbol or the workspace. Requires Ix Pro.
 */

import { $ } from "bun";

export const name = "ix-history";
export const description =
  "Get change history, recorded decisions, and known bugs for a symbol or workspace. Requires Ix Pro. Returns empty results gracefully if Pro is unavailable.";

export const parameters = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description:
        "Optional: symbol or topic to filter history/decisions to. Omit for workspace-wide summary.",
    },
    include: {
      type: "array",
      items: {
        type: "string",
        enum: ["decisions", "bugs", "changes", "briefing"],
      },
      description:
        "What to fetch. Default: ['briefing'] which returns all available context.",
      default: ["briefing"],
    },
  },
  required: [],
} as const;

type Params = {
  topic?: string;
  include?: ("decisions" | "bugs" | "changes" | "briefing")[];
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
  const include = params.include ?? ["briefing"];

  // Check Pro availability via briefing
  let proAvailable = false;
  let briefingData: {
    revision?: string;
    recentDecisions?: unknown[];
    openBugs?: unknown[];
    recentChanges?: unknown[];
    activeGoals?: unknown[];
    activePlans?: unknown[];
  } = {};

  if (include.includes("briefing") || !params.topic) {
    try {
      const output = await $`ix briefing --format json`.cwd(dir).text();
      const parsed = JSON.parse(output);
      if (parsed.revision) {
        proAvailable = true;
        briefingData = parsed;
      }
    } catch {
      // Pro not available
    }
  }

  if (!proAvailable) {
    return [
      `## ix-history${params.topic ? `: ${params.topic}` : ""}`,
      "",
      "**Ix Pro not available.** History, decisions, and bug tracking require Ix Pro.",
      "",
      "_Graph-based features (ix-query, ix-neighbors, ix-impact, ix-map) work without Pro._",
    ].join("\n");
  }

  const sections: string[] = [
    `## ix-history${params.topic ? `: ${params.topic}` : ""}`,
    "",
    `**Revision:** ${briefingData.revision}`,
    "",
  ];

  // Decisions
  if (include.includes("decisions") || include.includes("briefing")) {
    if (params.topic) {
      try {
        const output = await $`ix decisions --topic ${params.topic} --format json`
          .cwd(dir)
          .text();
        const parsed = JSON.parse(output);
        sections.push(formatDecisions(parsed.decisions ?? []));
      } catch {
        sections.push(
          formatDecisions(
            (briefingData.recentDecisions as { title?: string; summary?: string; date?: string }[]) ?? []
          )
        );
      }
    } else {
      sections.push(
        formatDecisions(
          (briefingData.recentDecisions as { title?: string; summary?: string; date?: string }[]) ?? []
        )
      );
    }
  }

  // Bugs
  if (include.includes("bugs") || include.includes("briefing")) {
    const bugs = (briefingData.openBugs as { title?: string; severity?: string; affects?: string }[]) ?? [];
    sections.push(formatBugs(bugs));
  }

  // Recent changes
  if (include.includes("changes") || include.includes("briefing")) {
    const changes = (briefingData.recentChanges as { summary?: string; date?: string; author?: string }[]) ?? [];
    sections.push(formatChanges(changes));
  }

  // Goals and plans (briefing only)
  if (include.includes("briefing")) {
    const goals = (briefingData.activeGoals as { title?: string; id?: string }[]) ?? [];
    const plans = (briefingData.activePlans as { title?: string; id?: string; status?: string }[]) ?? [];
    if (goals.length > 0) sections.push(formatGoals(goals));
    if (plans.length > 0) sections.push(formatPlans(plans));
  }

  return sections.join("\n");
}

function formatDecisions(
  decisions: { title?: string; summary?: string; date?: string }[]
): string {
  if (decisions.length === 0) return "**Recent decisions:** none\n";
  const lines = [`**Recent decisions** (${decisions.length}):`];
  for (const d of decisions.slice(0, 5)) {
    const title = d.title ?? "(untitled)";
    const date = d.date ? ` — ${d.date}` : "";
    lines.push(`- ${title}${date}`);
    if (d.summary) lines.push(`  ${d.summary}`);
  }
  return lines.join("\n") + "\n";
}

function formatBugs(
  bugs: { title?: string; severity?: string; affects?: string }[]
): string {
  if (bugs.length === 0) return "**Open bugs:** none\n";
  const lines = [`**Open bugs** (${bugs.length}):`];
  for (const b of bugs.slice(0, 5)) {
    const sev = b.severity ? ` [${b.severity}]` : "";
    const affects = b.affects ? ` — affects \`${b.affects}\`` : "";
    lines.push(`- ${b.title ?? "(untitled)"}${sev}${affects}`);
  }
  return lines.join("\n") + "\n";
}

function formatChanges(
  changes: { summary?: string; date?: string; author?: string }[]
): string {
  if (changes.length === 0) return "**Recent changes:** none\n";
  const lines = [`**Recent changes** (${changes.length}):`];
  for (const c of changes.slice(0, 5)) {
    const date = c.date ? ` (${c.date})` : "";
    const author = c.author ? ` by ${c.author}` : "";
    lines.push(`- ${c.summary ?? "(no summary)"}${author}${date}`);
  }
  return lines.join("\n") + "\n";
}

function formatGoals(goals: { title?: string; id?: string }[]): string {
  if (goals.length === 0) return "";
  const lines = ["**Active goals:**"];
  for (const g of goals) {
    const id = g.id ? ` (${g.id})` : "";
    lines.push(`- ${g.title ?? "(untitled)"}${id}`);
  }
  return lines.join("\n") + "\n";
}

function formatPlans(
  plans: { title?: string; id?: string; status?: string }[]
): string {
  if (plans.length === 0) return "";
  const lines = ["**Active plans:**"];
  for (const p of plans) {
    const id = p.id ? ` (${p.id})` : "";
    const status = p.status ? ` [${p.status}]` : "";
    lines.push(`- ${p.title ?? "(untitled)"}${id}${status}`);
  }
  return lines.join("\n") + "\n";
}
