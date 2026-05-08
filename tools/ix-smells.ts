/**
 * ix-smells — architecture smell detection
 *
 * Detects code quality smells across the graph: orphan files, high coupling,
 * low cohesion, overly large modules, dead code patterns, and other structural issues.
 * Use during architecture review or to find improvement candidates.
 */

import { $ } from "bun";

export const name = "ix-smells";
export const description =
  "Detect code quality and architecture smells across the graph: orphan files, high coupling, low cohesion, dead code, and other structural issues. Use during architecture review or before a large refactor.";

export const parameters = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "Optional: restrict smell detection to a directory path prefix",
    },
    limit: {
      type: "number",
      description: "Max results to return. Default: 50, max: 200",
      default: 50,
    },
  },
  required: [],
} as const;

type Params = {
  path?: string;
  limit?: number;
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;
  const limit = Math.min(params.limit ?? 50, 200);

  const args = ["ix", "smells", "--format", "json"];
  if (params.path) args.push("--path", params.path);

  let output: string;
  try {
    output = await $`${args}`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(msg);
  }

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
    const scopeNote = params.path ? ` in \`${params.path}\`` : "";
    return `## ix-smells\n\nNo code smells detected${scopeNote}. Architecture looks clean.`;
  }

  const scopeNote = params.path ? ` in \`${params.path}\`` : "";
  const showing = candidates.length < total ? ` (showing ${candidates.length} of ${total})` : "";
  const lines = [
    "## ix-smells",
    "",
    `**${total} smell${total === 1 ? "" : "s"} detected${scopeNote}**${showing}`,
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
