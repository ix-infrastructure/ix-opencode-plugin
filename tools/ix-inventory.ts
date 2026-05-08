/**
 * ix-inventory — enumerate files or symbols within a path scope
 *
 * Lists all files or symbols within a given directory path from the graph.
 * Use to explore what lives in a subsystem or directory without reading individual files.
 */

import { $ } from "bun";

export const name = "ix-inventory";
export const description =
  "List all files or symbols within a directory path scope from the graph. Use to explore what's inside a subsystem or directory without reading files.";

export const parameters = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "Directory path prefix to enumerate (e.g. 'src/auth', 'services/')",
    },
    kind: {
      type: "string",
      description: "What to enumerate. Default: file",
      enum: ["file", "class", "function", "interface", "module"],
      default: "file",
    },
  },
  required: ["path"],
} as const;

type Params = {
  path: string;
  kind?: "file" | "class" | "function" | "interface" | "module";
};

type Context = { directory: string; worktree?: string };

export async function execute(params: Params, context: Context): Promise<string> {
  const dir = context.worktree ?? context.directory;
  const kind = params.kind ?? "file";

  let output: string;
  try {
    output = await $`ix inventory --kind ${kind} --path ${params.path} --format json`.cwd(dir).text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable(params.path, kind, msg);
  }

  let raw: {
    kind?: string;
    scope?: string;
    total?: number;
    byFile?: { path?: string; items?: string[] }[];
  };
  try {
    raw = JSON.parse(output);
  } catch {
    return `## ix-inventory: ${params.path}\n\nFailed to parse output.\n\`\`\`\n${output.slice(0, 400)}\n\`\`\``;
  }

  const entries = raw.byFile ?? [];
  const total = raw.total ?? entries.reduce((n, e) => n + (e.items?.length ?? 1), 0);

  if (entries.length === 0) {
    return [
      `## ix-inventory: ${params.path}`,
      "",
      `No ${kind}s found under \`${params.path}\`. The path may not be indexed.`,
    ].join("\n");
  }

  const lines = [
    `## ix-inventory: ${params.path}`,
    "",
    `**${total} ${kind}${total === 1 ? "" : "s"}** under \`${raw.scope ?? params.path}\`:`,
    "",
  ];

  if (kind === "file") {
    // File inventory — flat list
    for (const entry of entries) {
      lines.push(`- \`${entry.path ?? "?"}\``);
    }
  } else {
    // Symbol inventory — grouped by file
    for (const entry of entries) {
      if (!entry.items || entry.items.length === 0) continue;
      lines.push(`**\`${entry.path ?? "?"}\`**`);
      for (const item of entry.items) {
        lines.push(`  - \`${item}\``);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function unavailable(path: string, kind: string, err: string): string {
  return [
    `## ix-inventory: ${path}`,
    "",
    `**ix unavailable.** Ensure the ix CLI is installed and \`ix map\` has been run.`,
    "",
    `Error: ${err}`,
  ].join("\n");
}
