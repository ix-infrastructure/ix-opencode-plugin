// Copyright 2026 Ix Infrastructure Inc.

/**
 * ix-smells — architecture smell detection
 *
 * Detects code quality smells across the graph: orphan files, high coupling,
 * low cohesion, overly large modules, dead code patterns, and other structural issues.
 * Use during architecture review or to find improvement candidates.
 */

import { runIx, failureDetail } from "../runtime/cli.ts";
import { tryLlm } from "../runtime/llm.ts";
import { formatIxError, parseIxError } from "../runtime/ix-error.ts";

export const name = "ix-smells";
export const description =
  "Detect code quality and architecture smells across the graph: orphan files, high coupling, low cohesion, dead code, and other structural issues. Use during architecture review or before a large refactor.";

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
  const dir = context.worktree ?? context.directory;
  const limit = Math.min(params.limit ?? 50, 200);

  const fast = await tryLlm(["smells"], dir);
  if (fast) return `## ix-smells\n\n${fast}`;

  const run = await runIx(["smells", "--format", "json"], dir);
  if (!run?.stdout.trim()) return unavailable(failureDetail(run));
  const output = run.stdout;
  // An error record (unmapped workspace, empty graph) has no `candidates`, and
  // reading it as a result reported "Architecture looks clean".
  const ixErr = parseIxError(output);
  if (ixErr) return formatIxError("## ix-smells", ixErr);

  let raw: {
    rev?: number;
    run_at?: string;
    count?: number;
    inference_version?: string;
    candidates?: {
      file?: string;
      smell?: string;
      confidence?: number;
      signals?: Record<string, number>;
    }[];
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-smells\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const allCandidates = raw.candidates ?? [];
  const total = raw.count ?? allCandidates.length;
  const candidates = allCandidates.slice(0, limit);

  if (candidates.length === 0) {
    return `## ix-smells\n\nNo code smells detected. Architecture looks clean.`;
  }

  const showing = candidates.length < total ? ` (showing ${candidates.length} of ${total})` : "";
  const lines = [
    "## ix-smells",
    "",
    `**${total} smell${total === 1 ? "" : "s"} detected**${showing}`,
    "",
  ];

  // Group by smell type
  const bySmell = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const smell = c.smell ?? "unknown";
    const group = bySmell.get(smell) ?? [];
    group.push(c);
    bySmell.set(smell, group);
  }

  for (const [smell, items] of bySmell) {
    lines.push(`### ${smell} (${items.length})`);
    for (const item of items.slice(0, 10)) {
      const conf = item.confidence !== undefined ? ` — confidence: ${item.confidence.toFixed(2)}` : "";
      lines.push(`- \`${item.file ?? "?"}\`${conf}`);
      if (item.signals && Object.keys(item.signals).length > 0) {
        const signalStr = Object.entries(item.signals)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        lines.push(`  _signals: ${signalStr}_`);
      }
    }
    if (items.length > 10) lines.push(`  _...and ${items.length - 10} more_`);
    lines.push("");
  }

  if (raw.run_at) lines.push(`_Analysis run at: ${raw.run_at}_`);

  return lines.join("\n");
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
