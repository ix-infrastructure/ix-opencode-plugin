// Copyright 2026 Ix Infrastructure Inc.

/**
 * The Ix Pro check in command and agent prompts.
 *
 * Pro commands (`briefing`, `decisions`, `plans`, ...) have no `--format llm`
 * renderer (see runtime/llm.ts), so a prompt that asks for llm and then looks
 * for JSON never finds Pro. Without Pro, `ix` registers a stub for each of
 * them that prints "The '<name>' command requires Ix Pro." on stderr and exits
 * 1 with nothing on stdout (Ix ix-cli/src/cli/register/pro-stubs.ts), so the
 * check has to read the exit code and treat that answer as "no Pro", not as a
 * failure.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");

/** Ix's PRO_COMMANDS (ix-cli/src/cli/register/pro-stubs.ts). */
const PRO_COMMANDS = [
  "briefing", "bug", "decide", "decisions", "goal", "goals", "plan", "task",
  "plans", "tasks", "truth", "workflow",
];

function promptFiles(): string[] {
  const out = Bun.spawnSync(["git", "ls-files", "agents", "commands", "skills"], { cwd: root });
  return out.stdout.toString().split("\n").filter(Boolean);
}

/** Every prompt line, with an agent JSON's escaped "\n" treated as a line break. */
function promptLines(): { where: string; line: string }[] {
  const lines: { where: string; line: string }[] = [];
  for (const file of promptFiles()) {
    const text = readFileSync(path.join(root, file), "utf8");
    text.split("\n").forEach((physical, i) => {
      for (const line of physical.split("\\n")) lines.push({ where: `${file}:${i + 1}`, line });
    });
  }
  return lines;
}

/** `ix <command> ... --format <fmt>` invocations on one line, stopping at a backtick or quote. */
function invocations(line: string): { command: string; format?: string; text: string }[] {
  const found: { command: string; format?: string; text: string }[] = [];
  for (const m of line.matchAll(/(?<![\w$-])ix ([a-z][a-z-]*)([^`"\\]*)/g)) {
    const format = m[2]!.match(/--format\s+([a-z]+)/)?.[1];
    found.push({ command: m[1]!, format, text: m[0] });
  }
  return found;
}

test("no prompt asks a Pro command for --format llm", () => {
  const offences: string[] = [];
  for (const { where, line } of promptLines()) {
    for (const inv of invocations(line)) {
      if (PRO_COMMANDS.includes(inv.command) && inv.format === "llm") offences.push(`${where}: ${inv.text.trim()}`);
    }
  }
  expect(offences).toEqual([]);
});

test("every `ix briefing` run asks for --format json and keeps stderr out of what it parses", () => {
  const runs = promptLines().flatMap(({ where, line }) =>
    invocations(line).filter((inv) => inv.command === "briefing" && inv.format !== undefined).map((inv) => ({ where, inv })),
  );
  expect(runs.length).toBeGreaterThan(0);
  const offences = runs
    .filter(({ inv }) => inv.format !== "json" || inv.text.includes("2>&1"))
    .map(({ where, inv }) => `${where}: ${inv.text.trim()}`);
  expect(offences).toEqual([]);
});

test("the Pro check reads the exit code and calls the no-Pro answer normal, not an error", () => {
  const offences: string[] = [];
  for (const file of promptFiles()) {
    const text = readFileSync(path.join(root, file), "utf8");
    if (!/ix briefing --format/.test(text)) continue;
    // `revision` is not the signal: the exit code is.
    if (/JSON with a `revision` field/.test(text)) offences.push(`${file}: keys Pro on a \`revision\` field`);
    if (!text.includes('echo \\"exit=$?\\"') && !text.includes('echo "exit=$?"')) offences.push(`${file}: does not show the exit code`);
    if (!text.includes("requires Ix Pro")) offences.push(`${file}: does not describe the answer without Pro`);
  }
  expect(offences).toEqual([]);
});
