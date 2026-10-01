// Copyright 2026 Ix Infrastructure Inc.

/**
 * Ix error records (Ix#733, v0.12.0).
 *
 * An unmapped workspace, an empty graph or an unresolved target now makes a
 * read command print an error record on stdout and exit 1. `safeRun` keeps
 * that stdout on purpose, so every tool has to recognise the record rather than
 * read it as a result -- before this, ix-smells called an unmapped project
 * "clean", ix-trace called a missing symbol "a root entry point" and ix-decide
 * said ALLOW.
 *
 * The fixtures under tests/fixtures/ix-v0.12.0 are real CLI output except
 * `synthetic/` (see its README). Tools run in a child process with a fake `ix`
 * that replays them, for the reason given in tools.test.ts: Bun resolves `ix`
 * from the real process PATH, so an in-process stub would run the real CLI.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { fakePath, writeFakeIx } from "./fake-ix.ts";
import { ixErrorFromLlm, needsMap, parseIxError, parseLlmRecord } from "../runtime/ix-error.ts";

const FIXTURES = path.resolve(import.meta.dir, "fixtures/ix-v0.12.0");
const MANIFEST = JSON.parse(readFileSync(path.join(FIXTURES, "manifest.json"), "utf8")) as Record<
  string,
  { command: string; exit: number }
>;

const fixture = (rel: string) => path.join(FIXTURES, rel);
const read = (rel: string) => readFileSync(fixture(rel), "utf8");
const exitOf = (rel: string) => MANIFEST[rel]?.exit ?? 0;
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * A fake `ix` that replays one command's fixture pair: the `.txt` (llm) body
 * for `--format llm`, the `.json` body otherwise, each with its recorded exit
 * code. `--version` reports 0.12.0 so the llm fast path is live.
 */
function replay(base: string): string {
  const json = `${base}.json`;
  const llm = `${base}.txt`;
  return `
case "\${1:-}" in --version) echo 0.12.0; exit 0 ;; esac
for _a in "$@"; do
  if [ "$_a" = llm ]; then cat ${sq(fixture(llm))}; exit ${exitOf(llm)}; fi
done
cat ${sq(fixture(json))}
exit ${exitOf(json)}`;
}

/** Run `tools/<toolFile>` with `params` against a fake `ix` running `script`. */
async function runTool(
  toolFile: string,
  params: Record<string, unknown>,
  script: string | null,
  env: Record<string, string> = {},
): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-errors-"));
  try {
    if (script !== null) writeFakeIx(dir, script);
    const runner = path.join(dir, "runner.ts");
    const toolPath = path.resolve(import.meta.dir, `../tools/${toolFile}`);
    writeFileSync(
      runner,
      `import * as tool from ${JSON.stringify(toolPath)};\n` +
        `const out = await tool.execute(${JSON.stringify(params)}, { directory: ${JSON.stringify(dir)} });\n` +
        `process.stdout.write(String(out));\n`,
    );
    const proc = Bun.spawn([process.execPath, runner], {
      env: { ...process.env, PATH: fakePath(dir), IX_DISABLE_LLM_FORMAT: "", ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    return output;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─── The parser ──────────────────────────────────────────────────────────────

describe("parseIxError on real v0.12.0 output", () => {
  const unmapped = readdirSync(fixture("unmapped"));

  test("there are unmapped fixtures in both formats", () => {
    expect(unmapped.filter((f) => f.endsWith(".json")).length).toBeGreaterThanOrEqual(4);
    expect(unmapped.filter((f) => f.endsWith(".txt")).length).toBeGreaterThanOrEqual(4);
  });

  for (const file of unmapped) {
    test(`unmapped/${file} is workspace_not_mapped, with Ix's hint`, () => {
      const err = parseIxError(read(`unmapped/${file}`));
      expect(err).not.toBeNull();
      expect(err!.code).toBe("workspace_not_mapped");
      expect(err!.message).toContain("is not inside a mapped Ix workspace");
      expect(err!.hint).toContain("ix map");
      expect(needsMap(err!)).toBe(true);
    });
  }

  for (const name of ["impact", "impact-file", "callers", "trace", "explain"]) {
    for (const ext of ["json", "txt"]) {
      test(`empty-graph/${name}.${ext} is unresolved_target on an empty graph`, () => {
        const err = parseIxError(read(`empty-graph/${name}.${ext}`));
        expect(err).not.toBeNull();
        expect(err!.code).toBe("unresolved_target");
        expect(err!.graphStatus).toBe("empty");
        expect(err!.graphReason).toBe("no_nodes");
        expect(err!.fix).toBe("ix map");
        expect(needsMap(err!)).toBe(true);
      });
    }
  }

  test("a file target keeps its own reason", () => {
    expect(parseIxError(read("empty-graph/impact-file.json"))!.reason).toBe("file_not_found");
    expect(parseIxError(read("empty-graph/impact-file.txt"))!.reason).toBe("file_not_found");
  });

  test("llm and JSON forms of the same miss agree", () => {
    const json = parseIxError(read("empty-graph/impact.json"))!;
    const llm = parseIxError(read("empty-graph/impact.txt"))!;
    expect(llm.code).toBe(json.code);
    expect(llm.message).toBe(json.message);
    expect(llm.message).toBe('No entity found matching "Foo".');
  });

  test("records that are not errors are not mistaken for one", () => {
    for (const rel of [
      "empty-graph/locate.json",
      "empty-graph/smells-list.json",
      "empty-graph/smells-list.txt",
      "empty-graph/stats.json",
      "empty-graph/stats.txt",
      "synthetic/impact-file-low.json",
      "synthetic/impact-degraded.json",
    ]) {
      expect(parseIxError(read(rel))).toBeNull();
    }
    expect(parseIxError("[]")).toBeNull();
    expect(parseIxError("not json")).toBeNull();
    expect(parseIxError('{"error":42}')).toBeNull();
    expect(parseIxError("")).toBeNull();
  });

  test("llm records unescape quoted values", () => {
    const { kind, fields } = parseLlmRecord('error code=x message="a \\"b\\" c\\\\d" dir=/tmp/x');
    expect(kind).toBe("error");
    expect(fields).toEqual({ code: "x", message: 'a "b" c\\d', dir: "/tmp/x" });
    expect(ixErrorFromLlm("graph status=empty")).toBeNull();
  });
});

// ─── Every tool, on every error fixture ──────────────────────────────────────

/** What a tool says when it took the record for a result. */
const SUCCESS_MARKERS = [
  "No code smells detected",
  "Architecture looks clean",
  "root entry point",
  "SAFE TO PROCEED",
  "No matches found",
  "No results.",
  "No subsystems found",
  "none found",
  ":** none",
  "Not found in graph",
  "Verdict:** ALLOW",
  "ix unavailable",
];

type Case = { tool: string; params: Record<string, unknown>; fixture: string };

const CASES: Case[] = [
  { tool: "ix-impact.ts", params: { target: "Foo" }, fixture: "impact" },
  { tool: "ix-trace.ts", params: { symbol: "Foo" }, fixture: "trace" },
  { tool: "ix-neighbors.ts", params: { symbol: "Foo", direction: "callers" }, fixture: "callers" },
  { tool: "ix-explain.ts", params: { symbol: "Foo" }, fixture: "explain" },
];
const UNMAPPED_ONLY: Case[] = [
  // `ix smells` (no --list) fails where `ix smells --list` does; see the README.
  { tool: "ix-smells.ts", params: {}, fixture: "smells-list" },
  { tool: "ix-query.ts", params: { symbol: "Foo" }, fixture: "locate" },
  { tool: "ix-stats.ts", params: {}, fixture: "stats" },
  { tool: "ix-subsystems.ts", params: {}, fixture: "subsystems" },
  { tool: "ix-rank.ts", params: {}, fixture: "rank" },
  { tool: "ix-inventory.ts", params: { path: "src/" }, fixture: "inventory" },
  { tool: "ix-map.ts", params: { include_stats: false }, fixture: "subsystems" },
];

const MATRIX: Array<Case & { scenario: string }> = [
  ...[...CASES, ...UNMAPPED_ONLY].map((c) => ({ ...c, scenario: "unmapped" })),
  ...CASES.map((c) => ({ ...c, scenario: "empty-graph" })),
];

describe("tools report Ix error records as errors", () => {
  for (const c of MATRIX) {
    for (const mode of ["json", "llm"] as const) {
      test(`${c.tool.replace(".ts", "")} on ${c.scenario}/${c.fixture} (${mode} path)`, async () => {
        const out = await runTool(c.tool, c.params, replay(`${c.scenario}/${c.fixture}`), {
          IX_DISABLE_LLM_FORMAT: mode === "json" ? "1" : "",
        });
        expect(out).toContain("Ix returned an error");
        expect(out).toContain(c.scenario === "unmapped" ? "workspace_not_mapped" : "unresolved_target");
        expect(out).toContain("`ix map`");
        for (const marker of SUCCESS_MARKERS) expect(out).not.toContain(marker);
      });
    }
  }

  test("ix-smells on an unmapped project is not 'clean'", async () => {
    const out = await runTool("ix-smells.ts", {}, replay("unmapped/smells-list"), { IX_DISABLE_LLM_FORMAT: "1" });
    expect(out).toContain("This project is not mapped in Ix");
    expect(out).toContain("ix-ingest");
  });

  test("ix-trace on an empty graph passes on Ix's own fix", async () => {
    const out = await runTool("ix-trace.ts", { symbol: "Foo" }, replay("empty-graph/trace"));
    expect(out).toContain("## ix-trace: Foo");
    expect(out).toContain("Ix's fix: `ix map`");
    expect(out).toContain("graph is empty");
  });

  test("a non-map error says it is an error, without the mapping advice", async () => {
    const out = await runTool(
      "ix-trace.ts",
      { symbol: "Foo" },
      `echo '{"error":"ambiguous_target","message":"Ambiguous symbol \\"Foo\\".","candidates":[]}'; exit 1`,
      { IX_DISABLE_LLM_FORMAT: "1" },
    );
    expect(out).toContain("`ambiguous_target`");
    expect(out).toContain("not an empty result");
    expect(out).not.toContain("root entry point");
    expect(out).not.toContain("not mapped");
  });

  test("ix missing is still reported as unavailable, not as an Ix error", async () => {
    const out = await runTool("ix-trace.ts", { symbol: "Foo" }, null);
    expect(out).toContain("ix unavailable");
    expect(out).toContain("ix CLI not found");
    expect(out).not.toContain("Ix returned an error");
  });

  test("a timeout is still reported as unavailable, not as an Ix error", async () => {
    const out = await runTool("ix-smells.ts", {}, "sleep 10", {
      IX_DISABLE_LLM_FORMAT: "1",
      IX_CLI_TIMEOUT_MS: "300",
    });
    expect(out).toContain("ix unavailable");
    expect(out).toContain("timed out");
    expect(out).not.toContain("Ix returned an error");
  }, 20_000);
});

// ─── ix-decide fails closed ──────────────────────────────────────────────────

/** A fake `ix` whose `impact <path>` replays the fixture mapped to that path. */
function impactByPath(map: Record<string, string>): string {
  const arms = Object.entries(map)
    .map(([p, rel]) => `    ${sq(p)}) cat ${sq(fixture(rel))}; exit ${exitOf(rel)} ;;`)
    .join("\n");
  return `
case "\${1:-}" in
  impact)
    case "\${2:-}" in
${arms}
    esac
    ;;
esac
exit 1`;
}

const decide = (params: Record<string, unknown>, script: string | null, env: Record<string, string> = {}) =>
  runTool("ix-decide.ts", params, script, { IX_DISABLE_LLM_FORMAT: "1", ...env });

describe("ix-decide", () => {
  const one = { touched_paths: ["src/foo.ts"] };

  test("REVIEW when ix is not installed", async () => {
    const out = await decide(one, null);
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("ix CLI not found");
  });

  test("REVIEW when ix times out", async () => {
    const out = await decide(one, "sleep 10", { IX_CLI_TIMEOUT_MS: "300" });
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("timed out");
  }, 20_000);

  test("REVIEW on a workspace_not_mapped record", async () => {
    const out = await decide(one, impactByPath({ "src/foo.ts": "unmapped/impact.json" }));
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("workspace_not_mapped");
    expect(out).toContain("`ix map`");
    expect(out).toContain("**Risk:** UNKNOWN");
  });

  test("REVIEW on an unresolved_target record from an empty graph", async () => {
    const out = await decide(one, impactByPath({ "src/foo.ts": "empty-graph/impact-file.json" }));
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("unresolved_target");
    expect(out).toContain("Ix's fix: `ix map`");
  });

  test("REVIEW on garbage output", async () => {
    const out = await decide(one, "echo 'Segmentation fault (core dumped)'");
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("did not parse");
  });

  test("REVIEW on JSON that is not an impact record", async () => {
    for (const body of ["{}", "[]", '{"risk":"low","dependentCount":0}']) {
      const out = await decide(one, `echo '${body}'`);
      expect(out).toContain("**Verdict:** REVIEW");
      expect(out).not.toContain("ALLOW");
    }
  });

  test("REVIEW when ix exits non-zero with nothing on stdout", async () => {
    const out = await decide(one, "echo 'backend unreachable' >&2; exit 1");
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("backend unreachable");
  });

  test("REVIEW when Ix withholds the risk on a hollow graph", async () => {
    const out = await decide(one, impactByPath({ "src/foo.ts": "synthetic/impact-degraded.json" }));
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("degraded");
  });

  test("ALLOW on a real low-risk file record, counting Ix's own dependent fields", async () => {
    const out = await decide(one, impactByPath({ "src/foo.ts": "synthetic/impact-file-low.json" }));
    expect(out).toContain("**Verdict:** ALLOW");
    expect(out).toContain("**Risk:** LOW");
    // directImporters 1 + directDependents 0 + memberLevelCallers 1
    expect(out).toContain("**Total dependents:** 2");
    expect(out).toContain("**Subsystems affected:** Util");
  });

  test("ALLOW on a real low-risk function record", async () => {
    const out = await decide(
      { touched_paths: ["formatDuration"] },
      impactByPath({ formatDuration: "synthetic/impact-leaf-low.json" }),
    );
    expect(out).toContain("**Verdict:** ALLOW");
    expect(out).toContain("**Total dependents:** 1");
  });

  test("REVIEW on riskLevel high, BLOCK on critical", async () => {
    const high = await decide(one, impactByPath({ "src/foo.ts": "synthetic/impact-file-high.json" }));
    expect(high).toContain("**Verdict:** REVIEW");
    expect(high).toContain("**Risk:** HIGH");
    expect(high).toContain("**Subsystems affected:** CLI, Client");

    const critical = await decide(one, impactByPath({ "src/foo.ts": "synthetic/impact-file-critical.json" }));
    expect(critical).toContain("**Verdict:** BLOCK");
    expect(critical).not.toContain("(unmapped)");
  });

  test("one unassessed file is enough to withhold ALLOW", async () => {
    const out = await decide(
      { touched_paths: ["src/a.ts", "src/b.ts"] },
      impactByPath({ "src/a.ts": "synthetic/impact-file-low.json", "src/b.ts": "empty-graph/impact-file.json" }),
    );
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("`src/a.ts` — LOW, 2 dependents");
    expect(out).toContain("`src/b.ts` — UNKNOWN (not assessed)");
  });

  test("paths past the checked five withhold ALLOW", async () => {
    const paths = ["a", "b", "c", "d", "e", "f"].map((n) => `src/${n}.ts`);
    const out = await decide(
      { touched_paths: paths },
      impactByPath(Object.fromEntries(paths.map((p) => [p, "synthetic/impact-leaf-low.json"]))),
    );
    expect(out).toContain("**Verdict:** REVIEW");
    expect(out).toContain("1 path beyond the first 5");
  });

  test("no paths is not a clearance", async () => {
    const out = await decide({ touched_paths: [] }, impactByPath({}));
    expect(out).toContain("**Verdict:** REVIEW");
  });
});
