// Copyright 2026 Ix Infrastructure Inc.

/**
 * Agent, command and skill prompts must not tell the model to run argv the
 * real `ix` rejects. The tools' own argv is checked against a released CLI in
 * the real-ix job; prompt text is only checked here.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");

const FORBIDDEN: [RegExp, string][] = [
  // `locate` returns one resolved target; it has no --limit.
  // Agents are JSON, so a whole prompt is one line: stop at an escaped "\n".
  [/ix locate (?:(?!\\n)[^\n`])*--limit/, "ix locate --limit"],
];

function promptFiles(): string[] {
  const out = Bun.spawnSync(["git", "ls-files", "agents", "commands", "skills"], { cwd: root });
  return out.stdout.toString().split("\n").filter(Boolean);
}

test("prompts never ask for argv ix rejects", () => {
  const files = promptFiles();
  expect(files.length).toBeGreaterThan(0);
  const offences: string[] = [];
  for (const file of files) {
    const lines = readFileSync(path.join(root, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [pattern, label] of FORBIDDEN) {
        if (pattern.test(line)) offences.push(`${file}:${i + 1}: ${label}`);
      }
    });
  }
  expect(offences).toEqual([]);
});
