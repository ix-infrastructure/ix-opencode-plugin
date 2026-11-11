// Copyright 2026 Ix Infrastructure Inc.

/**
 * Every `ix ...` command a command or agent prompt tells the model to run must
 * be one the CLI registers, with long flags it declares and a `--format` it
 * accepts.
 *
 * The CLI's commands and flags come from tests/fixtures/ix-cli-commands.json,
 * generated from the Ix source by tests/fixtures/regen-ix-commands.ts (see its
 * header for what it reads and the commit it was read at). Pro commands are
 * known by the stub names a CLI without Pro registers; their flags cannot be
 * checked here, since Pro's own declarations are not in the Ix source.
 *
 * Only code is checked: fenced blocks and `inline code` spans, in commands/*.md
 * and in each agent's `prompt`. Prose that mentions "ix map" is not argv.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");

type CliTable = {
  source: { commit: string };
  commands: Record<string, { flags: string[]; formats: string[] }>;
  proStubs: string[];
};
const CLI = JSON.parse(readFileSync(path.join(root, "tests/fixtures/ix-cli-commands.json"), "utf8")) as CliTable;

/**
 * Pro stub names that stay stubs even with Pro installed, so they answer
 * "requires Ix Pro" everywhere. Pro folded the plural list commands into a
 * subcommand of the singular: `goals` -> `goal list`, `bugs` -> `bug list`
 * (Ix ix-cli/src/cli/commands/workflows.ts, COLLAPSED_HELP_TOPICS), and
 * `plans` -> `plan list`.
 */
const STUB_ONLY: Record<string, string> = {
  goals: "ix goal list",
  plans: "ix plan list",
  bugs: "ix bug list",
};

function promptSources(): { file: string; text: string }[] {
  const out = Bun.spawnSync(["git", "ls-files", "agents", "commands", "skills"], { cwd: root });
  return out.stdout
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((file) => {
      const raw = readFileSync(path.join(root, file), "utf8");
      const text = file.endsWith(".json") ? String((JSON.parse(raw) as { prompt?: string }).prompt ?? "") : raw;
      return { file, text };
    });
}

/** The code in a markdown text: fenced block lines and inline code spans. */
export function codeSnippets(markdown: string): string[] {
  const snippets: string[] = [];
  const fence = /^```[^\n]*\n([\s\S]*?)^```/gm;
  for (const m of markdown.matchAll(fence)) snippets.push(...m[1]!.split("\n"));
  const prose = markdown.replace(fence, "");
  for (const m of prose.matchAll(/`([^`\n]+)`/g)) snippets.push(m[1]!);
  return snippets;
}

type Invocation = { command: string; flags: string[]; format?: string; text: string };

/** `ix <command> ...` runs in one snippet, split at shell separators, comments dropped. */
export function invocations(snippet: string): Invocation[] {
  const found: Invocation[] = [];
  for (const part of snippet.replace(/\s#.*$/, "").split(/\|\||&&|[|;]/)) {
    const m = part.match(/(?:^|\s)ix\s+([a-z][a-z-]*)(.*)$/);
    if (!m) continue;
    const rest = m[2]!;
    found.push({
      command: m[1]!,
      flags: [...rest.matchAll(/(?:^|\s)(--[a-z][a-z0-9-]*)/g)].map((f) => f[1]!),
      format: rest.match(/--format\s+([a-z]+)/)?.[1],
      text: `ix ${m[1]}${rest}`.trim(),
    });
  }
  return found;
}

/** What is wrong with one invocation, or null. */
export function problem(inv: Invocation): string | null {
  if (STUB_ONLY[inv.command]) {
    return `\`ix ${inv.command}\` is not a command even with Ix Pro; use \`${STUB_ONLY[inv.command]}\``;
  }
  if (CLI.proStubs.includes(inv.command)) {
    return inv.format === "llm" ? `Pro command \`ix ${inv.command}\` has no --format llm` : null;
  }
  const cmd = CLI.commands[inv.command];
  if (!cmd) return `\`ix ${inv.command}\` is not an ix command`;
  const unknown = inv.flags.filter((f) => !cmd.flags.includes(f));
  if (unknown.length > 0) return `\`ix ${inv.command}\` has no ${unknown.join(", ")}`;
  if (inv.format && cmd.formats.length > 0 && !cmd.formats.includes(inv.format)) {
    return `\`ix ${inv.command}\` has no --format ${inv.format} (${cmd.formats.join("|")})`;
  }
  return null;
}

test("the CLI table is the generated one", () => {
  expect(Object.keys(CLI.commands).length).toBeGreaterThan(30);
  expect(CLI.commands["impact"]?.flags).toContain("--format");
  expect(CLI.proStubs).toContain("briefing");
});

test("the checker catches what it is for", () => {
  const check = (s: string) => invocations(s).map(problem);
  expect(check("ix plans --format json")[0]).toContain("ix plan list");
  expect(check("ix locate foo --limit 5")[0]).toContain("--limit");
  expect(check("ix decisions --format llm")[0]).toContain("no --format llm");
  expect(check("ix bogus")[0]).toContain("not an ix command");
  expect(check("ix impact <target> --format llm")).toEqual([null]);
  expect(check("ix briefing --format json 2>/dev/null; echo \"exit=$?\"")).toEqual([null]);
  expect(check("command -v ix   # check installation")).toEqual([]);
});

test("every ix command in commands/ and agents/ is one the CLI accepts", () => {
  const sources = promptSources();
  expect(sources.length).toBeGreaterThan(0);
  const offences: string[] = [];
  let checked = 0;
  for (const { file, text } of sources) {
    for (const snippet of codeSnippets(text)) {
      for (const inv of invocations(snippet)) {
        checked++;
        const why = problem(inv);
        if (why) offences.push(`${file}: ${inv.text} -- ${why}`);
      }
    }
  }
  expect(checked).toBeGreaterThan(50);
  expect(offences).toEqual([]);
});
