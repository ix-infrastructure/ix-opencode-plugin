// Copyright 2026 Ix Infrastructure Inc.

/**
 * RealIxCli: the tools against a released `ix`, with no backend.
 *
 * Every other suite drives the tools with a fake `ix` (tests/fake-ix.ts) that
 * replays captured output. A fake only refuses the flags someone thought to
 * teach it, so a tool can pass `--whatever` to the real CLI and still go green.
 * This suite runs the real thing: whatever `ix` is first on PATH (CI installs
 * the pinned release, see the `real-ix` job in .github/workflows/ci.yml).
 *
 * There is no backend. IX_ENDPOINT points at a port nothing listens on and
 * IX_HOME is a fresh temp dir, so no workspace is registered. From a temp
 * directory every graph read then answers `workspace_not_mapped` (an error
 * record on stdout, exit 1) without a network call, `ix text` works (ripgrep),
 * and `ix --version` works. That is enough to check, against the real CLI:
 *
 *   - every argv the tools build is one `ix` accepts (no "unknown option" or
 *     "unknown command" on stderr) -- pin a CLI that lacks a flag a tool uses
 *     and this suite fails;
 *   - the tools read ix's real error record as an error, not as "nothing
 *     found" or "ix unavailable";
 *   - the tools that can succeed without a backend return a real result.
 *
 * Skipped unless IX_REAL_TESTS=1. Run it with the CLI on PATH:
 *
 *   IX_REAL_TESTS=1 bun test tests/real-ix.test.ts
 *
 * IX_REAL_DUMP=1 also prints every tool's output. Never point IX_ENDPOINT at a
 * real backend for this suite: it sets its own.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ENABLED = process.env["IX_REAL_TESTS"] === "1";

/**
 * [label, tool file, params]. Every tool, with the arguments that reach the
 * most argv. ix-neighbors stops at the first error record, so each direction
 * is its own call.
 */
const CALLS: [string, string, Record<string, unknown>][] = [
  ["ix-query.ts", "ix-query.ts", { symbol: "Foo", kind: "function", path: "src" }],
  ["ix-neighbors.ts", "ix-neighbors.ts", { symbol: "Foo", direction: "all" }],
  ["ix-neighbors.ts depends", "ix-neighbors.ts", { symbol: "Foo", direction: "depends", depth: 2 }],
  ["ix-neighbors.ts imported-by", "ix-neighbors.ts", { symbol: "probe.ts", direction: "imported-by" }],
  ["ix-impact.ts", "ix-impact.ts", { target: "Foo" }],
  ["ix-map.ts", "ix-map.ts", { scope: "Runtime" }],
  ["ix-ingest.ts", "ix-ingest.ts", {}],
  ["ix-history.ts", "ix-history.ts", { topic: "Foo", include: ["briefing", "decisions", "bugs", "changes"] }],
  ["ix-docs-tool.ts", "ix-docs-tool.ts", { target: "Foo", depth: "full" }],
  ["ix-explain.ts", "ix-explain.ts", { symbol: "Foo" }],
  ["ix-rank.ts", "ix-rank.ts", { by: "dependents", kind: "class", top: 5, path: "src" }],
  ["ix-stats.ts", "ix-stats.ts", {}],
  ["ix-subsystems.ts", "ix-subsystems.ts", {}],
  ["ix-inventory.ts", "ix-inventory.ts", { path: "src", kind: "file" }],
  ["ix-trace.ts", "ix-trace.ts", { symbol: "Foo" }],
  ["ix-trace.ts to", "ix-trace.ts", { symbol: "Foo", to: "Bar" }],
  ["ix-decide.ts", "ix-decide.ts", { touched_paths: ["probe.ts"] }],
  ["ix-health.ts", "ix-health.ts", {}],
  ["ix-smells.ts", "ix-smells.ts", {}],
  ["ix-locate.ts", "ix-locate.ts", { pattern: "realIxProbeMarker", limit: 5, path: ".", language: "typescript" }],
];

/** Tools whose every answer here must be Ix's `workspace_not_mapped` record. */
const GRAPH_READS = [
  "ix-query.ts",
  "ix-neighbors.ts",
  "ix-neighbors.ts depends",
  "ix-neighbors.ts imported-by",
  "ix-map.ts",
  "ix-ingest.ts",
  "ix-docs-tool.ts",
  "ix-impact.ts",
  "ix-explain.ts",
  "ix-rank.ts",
  "ix-stats.ts",
  "ix-subsystems.ts",
  "ix-inventory.ts",
  "ix-trace.ts",
  "ix-trace.ts to",
  "ix-smells.ts",
];

let work = "";
let repo = "";
let argvLog = "";
let stderrLog = "";
const outputs = new Map<string, string>();

/** Run one tool in a child Bun, with the logging shim first on PATH. */
async function runTool(file: string, params: Record<string, unknown>): Promise<string> {
  const toolPath = path.resolve(import.meta.dir, "../tools", file);
  const runner = path.join(work, `run-${outputs.size}-${file}`);
  writeFileSync(
    runner,
    `import * as tool from ${JSON.stringify(toolPath)};\n` +
      `const out = await tool.execute(${JSON.stringify(params)}, { directory: ${JSON.stringify(repo)} });\n` +
      `if (typeof out !== "string") throw new Error("non-string result: " + typeof out);\n` +
      `process.stdout.write(out);\n`,
  );
  // The child gets the shim dir first on PATH: Bun resolves `ix` from the
  // child's PATH at spawn, so this is what the tool really runs.
  const proc = Bun.spawn([process.execPath, runner], {
    cwd: repo,
    env: { ...process.env, PATH: `${path.join(work, "bin")}${path.delimiter}${process.env["PATH"]}` },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${file} threw (exit ${code}):\n${err}`);
  return out;
}

describe.skipIf(!ENABLED)("RealIxCli (released ix, no backend)", () => {
  beforeAll(async () => {
    work = mkdtempSync(path.join(tmpdir(), "ix-real-"));
    repo = mkdtempSync(path.join(tmpdir(), "ix-real-repo-"));
    argvLog = path.join(work, "argv.log");
    stderrLog = path.join(work, "stderr.log");
    writeFileSync(argvLog, "");
    writeFileSync(stderrLog, "");
    writeFileSync(path.join(repo, "probe.ts"), "export function realIxProbeMarker(): number {\n  return 1;\n}\n");

    // Resolve the real `ix` before the shim shadows it.
    const real = Bun.which("ix");
    if (!real) throw new Error("IX_REAL_TESTS=1 but no `ix` on PATH");

    // A transparent wrapper: logs argv and stderr, passes everything through.
    const bin = path.join(work, "bin");
    await Bun.$`mkdir -p ${bin}`;
    const shim = path.join(bin, "ix");
    writeFileSync(
      shim,
      `#!/bin/sh
printf '%s\\n' "$*" >> '${argvLog}'
_err=$(mktemp)
'${real}' "$@" 2>"$_err"
_code=$?
cat "$_err" >> '${stderrLog}'
cat "$_err" >&2
rm -f "$_err"
exit $_code
`,
    );
    chmodSync(shim, 0o755);

    // No backend, no registered workspace, no update check. Inherited by
    // every child below; overrides anything the caller had set.
    process.env["IX_ENDPOINT"] = "http://127.0.0.1:1";
    process.env["IX_HOME"] = path.join(work, "ix-home");
    process.env["IX_NO_UPDATE_CHECK"] = "1";
    process.env["IX_DISABLE_LLM_FORMAT"] = "";

    for (const [label, file, params] of CALLS) outputs.set(label, await runTool(file, params));
    if (process.env["IX_REAL_DUMP"]) for (const [k, v] of outputs) console.log(`===== ${k}\n${v}`);
  }, 300_000);

  afterAll(() => {
    if (work) rmSync(work, { recursive: true, force: true });
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  test("every tool returns a non-empty markdown result without throwing", () => {
    for (const [file] of CALLS) {
      const out = outputs.get(file) ?? "";
      expect(out.trim().length, file).toBeGreaterThan(0);
      expect(out.trimStart().startsWith("#") || out.trimStart().startsWith("**"), `${file}:\n${out}`).toBe(true);
    }
  });

  test("ix accepts every argv the tools build (no unknown option or command)", () => {
    const argv = readFileSync(argvLog, "utf8");
    // The shim saw the tools' calls, so the check below is not vacuous.
    for (const cmd of ["locate", "explain", "impact", "callers", "callees", "depends", "imported-by",
      "trace", "rank", "stats", "subsystems", "inventory", "smells", "status", "text", "overview"]) {
      expect(argv, `no tool ran \`ix ${cmd}\``).toMatch(new RegExp(`^${cmd}( |$)`, "m"));
    }
    const stderr = readFileSync(stderrLog, "utf8");
    const rejected = stderr.split("\n").filter((l) => /unknown (option|command)|too many arguments|missing required argument/i.test(l));
    expect(rejected, `ix rejected an argv. stderr lines:\n${rejected.join("\n")}\nargv log:\n${argv}`).toEqual([]);
  });

  test("graph reads report ix's workspace_not_mapped record, not an empty result", () => {
    for (const file of GRAPH_READS) {
      const out = outputs.get(file) ?? "";
      expect(out, `${file}:\n${out}`).toContain("workspace_not_mapped");
      expect(out, file).not.toContain("ix unavailable");
      expect(out, file).not.toMatch(/No matches found|No smells detected|BLOCK|ALLOW/);
    }
  });

  test("ix-decide does not ALLOW an edit on a project Ix cannot read", () => {
    const out = outputs.get("ix-decide.ts") ?? "";
    expect(out).not.toMatch(/Verdict:\*?\*?\s*ALLOW/);
    expect(out).toContain("workspace_not_mapped");
  });

  test("ix-health reads the real version and reports the graph as not indexed", () => {
    const out = outputs.get("ix-health.ts") ?? "";
    const version = Bun.spawnSync(["ix", "--version"]).stdout.toString().trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(out).toContain(`**CLI:** ix ${version}`);
    expect(out).toContain("DEGRADED");
    expect(out).toContain("workspace_not_mapped");
  });

  test("ix-locate returns the real `ix text` hit with no backend", () => {
    const out = outputs.get("ix-locate.ts") ?? "";
    expect(out).toContain("probe.ts");
    expect(out).not.toContain("ix unavailable");
    expect(out).not.toContain("No matches found");
  });
});
