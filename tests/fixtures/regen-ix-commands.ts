// Copyright 2026 Ix Infrastructure Inc.

/**
 * Regenerate tests/fixtures/ix-cli-commands.json: every top-level `ix` command
 * and the long flags it declares, read from an Ix source checkout.
 *
 *   bun tests/fixtures/regen-ix-commands.ts <path-to-Ix-checkout> [git-ref]
 *
 * `git-ref` defaults to `origin/main`; files are read with `git show`, so the
 * checkout's working tree is not touched. Nothing is built or run.
 *
 * ## What it reads (Ix ix-cli/src/cli)
 *
 *   register/oss-table.ts     OSS_COMMAND_TABLE: each OSS command name and the
 *                             commands/*.ts module that registers it
 *   register/oss-fallbacks.ts OSS_FALLBACK_TABLE: commands registered only
 *                             when Pro is not (`note`, `session`)
 *   commands/<module>.ts      every `.option(...)`, `.requiredOption(...)` and
 *                             `new Option(...)` flag spec, and the formats a
 *                             `--format <fmt>` description lists
 *                             ("Output format (text|json|llm)")
 *   register/pro-stubs.ts     PRO_COMMANDS: names a CLI without Pro still
 *                             registers (a stub that says "requires Ix Pro")
 *
 * A module's flags are the union over every command it registers, subcommands
 * included, so a flag is "known" to a command if any command in its module
 * declares it. That is looser than commander, never stricter.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

const [repo, ref = "origin/main"] = process.argv.slice(2);
if (!repo) {
  console.error("usage: bun tests/fixtures/regen-ix-commands.ts <path-to-Ix-checkout> [git-ref]");
  process.exit(2);
}

function show(file: string): string {
  const out = Bun.spawnSync(["git", "-C", repo!, "show", `${ref}:ix-cli/src/cli/${file}`]);
  if (out.exitCode !== 0) throw new Error(`git show ${ref}:ix-cli/src/cli/${file}: ${out.stderr.toString()}`);
  return out.stdout.toString();
}

const commit = Bun.spawnSync(["git", "-C", repo, "rev-parse", "--short", ref]).stdout.toString().trim();

/** `name: async () => (await import("../commands/x.js"))` rows of a command table. */
function tableModules(source: string, table: string): Record<string, string> {
  const start = source.indexOf(table);
  const body = source.slice(start, source.indexOf("};", start));
  const rows: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*"?([a-z][a-z-]*)"?:\s*async[^\n]*import\("\.\.\/commands\/([a-z-]+)\.js"\)/gm)) {
    rows[m[1]!] = m[2]!;
  }
  return rows;
}

/** Long flags and `--format` choices declared in one command module. */
function moduleOptions(source: string): { flags: string[]; formats: string[] } {
  const flags = new Set<string>(["--help"]);
  const formats = new Set<string>();
  const spec = /(?:\.(?:option|requiredOption)|new Option)\(\s*(["'`])([^"'`]*)\1(?:\s*,\s*(["'`])([^"'`]*)\3)?/g;
  for (const m of source.matchAll(spec)) {
    for (const f of m[2]!.matchAll(/--[a-z][a-z0-9-]*/g)) flags.add(f[0]);
    if (/--format\b/.test(m[2]!)) {
      const choices = (m[4] ?? "").match(/\(([a-z|]+)\)/)?.[1];
      for (const c of choices ? choices.split("|") : []) formats.add(c);
    }
  }
  return { flags: [...flags].sort(), formats: [...formats].sort() };
}

const modules = {
  ...tableModules(show("register/oss-table.ts"), "OSS_COMMAND_TABLE"),
  ...tableModules(show("register/oss-fallbacks.ts"), "OSS_FALLBACK_TABLE"),
};
const commands: Record<string, { module: string; flags: string[]; formats: string[] }> = {};
for (const [name, module] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
  commands[name] = { module: `commands/${module}.ts`, ...moduleOptions(show(`commands/${module}.ts`)) };
}

const stubs = show("register/pro-stubs.ts");
const proBody = stubs.slice(stubs.indexOf("PRO_COMMANDS"), stubs.indexOf("];"));
const proStubs = [...proBody.matchAll(/name:\s*"([a-z-]+)"/g)].map((m) => m[1]!).sort();

const out = {
  source: { repo: "ix-infrastructure/Ix", ref, commit, cli: "ix-cli/src/cli" },
  generatedBy: "tests/fixtures/regen-ix-commands.ts",
  commands,
  proStubs,
};
const target = path.join(import.meta.dir, "ix-cli-commands.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${target}: ${Object.keys(commands).length} commands, ${proStubs.length} Pro stubs (${commit})`);
