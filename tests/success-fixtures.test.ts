// Copyright 2026 Ix Infrastructure Inc.

/**
 * Every tool against real successful `ix` output.
 *
 * Until these fixtures existed every success case in this suite was written by
 * hand, and the hand-written shapes were wrong in the same way the parsers
 * were: `risk` for `riskLevel`, `items` for `results`, `regions[].name` for
 * `label`, `names` for `scores`. Each test below drives a tool through a fake
 * `ix` that replays what the real CLI printed (tests/fixtures/ix-v0.12.0/
 * success, empty-repo, empty-graph; see the README there) and checks the
 * values a correct parse must surface.
 *
 * Tools run in a child process, for the reason given in tools.test.ts: Bun
 * resolves `ix` from the real process PATH, so an in-process stub would run
 * the real CLI.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { fakePath, writeFakeIx } from "./fake-ix.ts";

const FIXTURES = path.resolve(import.meta.dir, "fixtures/ix-v0.12.0");
const MANIFEST = JSON.parse(readFileSync(path.join(FIXTURES, "manifest.json"), "utf8")) as Record<
  string,
  { command: string; exit: number }
>;
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * `[argv glob, fixture base]`. The glob is matched against `$*` (the whole
 * argv, `--format` included); the base names a `.json`/`.txt` pair. A base of
 * `null` exits 1 with no output, as an `ix` that cannot answer does.
 */
type Route = [glob: string, base: string | null];

/** A fake `ix` that answers each routed command from its fixture. */
function router(routes: Route[]): string {
  const arms = routes.map(([glob, base]) => {
    if (base === null) return `  ${glob}) exit 1 ;;`;
    const json = `${base}.json`;
    const txt = `${base}.txt`;
    const exitJson = MANIFEST[json]?.exit ?? 0;
    const exitTxt = MANIFEST[txt]?.exit ?? 0;
    return [
      `  ${glob})`,
      `    if [ "$_fmt" = llm ]; then`,
      existsSync(path.join(FIXTURES, txt))
        ? `      cat ${sq(path.join(FIXTURES, txt))}; exit ${exitTxt}`
        : `      echo "fake ix: no llm fixture for ${base}" >&2; exit 3`,
      `    fi`,
      `    cat ${sq(path.join(FIXTURES, json))}; exit ${exitJson} ;;`,
    ].join("\n");
  });
  return `
case "\${1:-}" in --version) echo 0.12.0; exit 0 ;; esac
_fmt=json
for _a in "$@"; do [ "$_a" = llm ] && _fmt=llm; done
case "$*" in
${arms.join("\n")}
  *) echo "fake ix: no fixture for: $*" >&2; exit 3 ;;
esac`;
}

type RunOpts = {
  /** Allow the `--format llm` fast path (default: off, so the JSON path runs). */
  llm?: boolean;
  /** Extra context fields; `directory` defaults to the fake's own temp dir. */
  context?: Record<string, unknown>;
};

/** Run `tools/<toolFile>` against `routes`; returns its output and the calls it made. */
async function runTool(
  toolFile: string,
  params: Record<string, unknown>,
  routes: Route[],
  opts: RunOpts = {},
): Promise<{ output: string; calls: string[]; dir: string }> {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-success-"));
  const log = path.join(dir, "calls.log");
  try {
    writeFakeIx(dir, router(routes));
    const runner = path.join(dir, "runner.ts");
    const toolPath = path.resolve(import.meta.dir, `../tools/${toolFile}`);
    const context = { directory: dir, ...opts.context };
    writeFileSync(
      runner,
      `import * as tool from ${JSON.stringify(toolPath)};\n` +
        `const out = await tool.execute(${JSON.stringify(params)}, ${JSON.stringify(context)});\n` +
        `process.stdout.write(String(out));\n`,
    );
    const proc = Bun.spawn([process.execPath, runner], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: fakePath(dir),
        IX_FAKE_LOG: log,
        IX_DISABLE_LLM_FORMAT: opts.llm ? "" : "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
    return { output, calls, dir };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Output a correct parse never produces: a field read that missed. */
function expectNoMissedFields(output: string): void {
  expect(output).not.toContain("undefined");
  expect(output).not.toContain("[object Object]");
  expect(output).not.toContain("NaN");
}

// ─── ix-impact ───────────────────────────────────────────────────────────────

describe("ix-impact on real output", () => {
  test("a function: riskLevel, summary.callers and the callers' results", async () => {
    const { output } = await runTool("ix-impact.ts", { target: "runIx" }, [
      ["'impact runIx '*", "success/impact-function"],
      ["'callers runIx '*", "success/callers"],
    ]);
    expect(output).toContain("**Risk level:** MEDIUM");
    expect(output).toContain("**Verdict:** REVIEW CALLERS FIRST");
    expect(output).toContain("- Direct callers: 11");
    expect(output).toContain("`execute` — tools/ix-rank.ts");
    expect(output).toContain("Multiple callers across different subsystems");
    expectNoMissedFields(output);
  });

  test("a file: importers, member callers, regions and its most-called members", async () => {
    const { output, calls } = await runTool("ix-impact.ts", { target: "runtime/cli.ts" }, [
      ["'impact runtime/cli.ts '*", "success/impact-file"],
    ]);
    expect(output).toContain("**Risk level:** HIGH");
    expect(output).toContain("**Verdict:** NEEDS CHANGE PLAN");
    expect(output).toContain("- Direct importers: 18");
    expect(output).toContain("- Callers of its members: 33");
    expect(output).toContain("- Total reaching it: 51");
    expect(output).toContain("- Subsystems affected: Runtime, Explain, Plugins, Impact");
    expect(output).toContain("`safeRun` (12 callers) — runtime/cli.ts");
    // A file has no callers of its own: `ix callers <file>` is a text search.
    expect(calls.some((c) => c.includes("|callers "))).toBe(false);
    expectNoMissedFields(output);
  });

  test("a leaf: low risk, few callers, safe", async () => {
    const { output } = await runTool("ix-impact.ts", { target: "capitalize" }, [
      ["'impact capitalize '*", "success/impact-leaf"],
    ]);
    expect(output).toContain("**Risk level:** LOW");
    expect(output).toContain("**Verdict:** SAFE TO PROCEED");
    expect(output).toContain("- Direct callers: 1");
  });

  test("a withheld risk level on a hollow graph is not a verdict", async () => {
    const { output } = await runTool("ix-impact.ts", { target: "config.ts" }, [
      ["'impact config.ts '*", "synthetic/impact-degraded"],
    ]);
    expect(output).toContain("**Verdict:** CANNOT ASSESS");
    expect(output).toContain("**Graph:** degraded");
    expect(output).toContain("ix reset --workspace --yes --ingest");
    expect(output).not.toContain("NEEDS CHANGE PLAN");
  });
});

// ─── ix-query ────────────────────────────────────────────────────────────────

describe("ix-query on real output", () => {
  test("locate's single resolvedTarget, and explain's nested role and importance", async () => {
    const { output, calls } = await runTool("ix-query.ts", { symbol: "runIx" }, [
      ["'locate runIx '*", "success/locate"],
      ["'explain runIx '*", "success/explain"],
    ]);
    expect(output).toContain("**Name:** `runIx`");
    expect(output).toContain("**Kind:** function");
    expect(output).toContain("**File:** runtime/cli.ts:37");
    expect(output).toContain("**Subsystem:** Tools › Impact");
    expect(output).toContain("**Role:** shared-utility (medium confidence)");
    expect(output).toContain("**Importance:** high — broad-shared-dependency");
    expect(output).toContain("**Callers:** 11");
    // explain is narrowed to the entity locate found.
    expect(calls.some((c) => /\|explain runIx .*--kind function --path runtime\/cli\.ts/.test(c))).toBe(true);
    expectNoMissedFields(output);
  });

  test("an ambiguous name lists the candidates", async () => {
    const { output } = await runTool("ix-query.ts", { symbol: "execute" }, [
      ["'locate execute '*", "success/locate-ambiguous"],
    ]);
    expect(output).toContain("**Ambiguous:** 8 entities match");
    expect(output).toContain("`execute` (function) — tools/ix-rank.ts");
  });

  test("an unresolved name is not found", async () => {
    const { output } = await runTool("ix-query.ts", { symbol: "Foo" }, [
      ["'locate Foo '*", "empty-graph/locate"],
    ]);
    expect(output).toContain("No matches found in the graph");
  });
});

// ─── ix-map ──────────────────────────────────────────────────────────────────

const MAP_ROUTES: Route[] = [
  ["'subsystems --list '*", "success/subsystems-list"],
  ["'subsystems Runtime '*", "success/subsystems-scope"],
  ["'subsystems --format '*", "success/subsystems"],
  ["'stats '*", "success/stats"],
];

describe("ix-map on real output", () => {
  test("regions by label, health scores, stats objects", async () => {
    const { output } = await runTool("ix-map.ts", {}, MAP_ROUTES);
    expect(output).toContain("**Codebase:** 55 files · 870 nodes · 1745 edges");
    expect(output).toContain("**Subsystems** (11, 38 files)");
    expect(output).toContain("| Explain | module | 1 | 7 | 0.45 | 28.98 | 0.38 |");
    expect(output).toContain("| Tools ⚠ | system | 5 | 24 | 0.31 | 0 | 0.78 |");
    expect(output).toContain("**Subsystem health:** Tools (0.63), Agents (0.59)");
    expectNoMissedFields(output);
  });

  test("a scope answers with the target region, not a region list", async () => {
    const { output } = await runTool("ix-map.ts", { scope: "Runtime", include_stats: false }, MAP_ROUTES);
    expect(output).toContain("**Subsystem Runtime** (module, level 1, 8 files, confidence 0.40)");
    expect(output).toContain("Part of: Tools");
    expect(output).not.toContain("none found");
  });

  test("an empty map says so", async () => {
    const { output } = await runTool("ix-map.ts", {}, [
      ["'subsystems --list '*", "empty-repo/subsystems-list"],
      ["'subsystems --format '*", "empty-repo/subsystems"],
      ["'stats '*", "empty-repo/stats"],
    ]);
    expect(output).toContain("**Subsystems:** none found. Run `ix map` to build the graph.");
    expect(output).toContain("**Codebase:** 0 files · 0 nodes · 0 edges");
  });
});

// ─── ix-docs-tool ────────────────────────────────────────────────────────────

describe("ix-docs-tool on real output", () => {
  test("overview keyItems are the components; explain's role and callers are nested", async () => {
    const { output } = await runTool("ix-docs-tool.ts", { target: "runtime/cli.ts", depth: "full" }, [
      ["'locate runtime/cli.ts '*", "success/locate"],
      ["'overview runtime/cli.ts '*", "success/overview"],
      ["'stats '*", "success/stats"],
      // Every component explains as runIx: one real explain record is enough
      // to prove the nested fields are read.
      ["'explain '*", "success/explain"],
      ["'impact runtime/cli.ts '*", "success/impact-file"],
    ]);
    expect(output).toContain("_55 files · 870 nodes_");
    expect(output).toContain("**Kind:** file");
    expect(output).toContain("**Path:** runtime/cli.ts");
    expect(output).toContain("**Subsystem:** Tools › Impact");
    expect(output).toContain("**Contains:** 1 interface, 3 functions");
    expect(output).toContain("- `safeRun` (11 callers) — shared-utility");
    expect(output).toContain("- `IxRun` (11 callers) — shared-utility");
    expect(output).toContain("**Change risk:** HIGH (51 callers/importers/dependents reach it)");
    expectNoMissedFields(output);
  });
});

// ─── ix-ingest / ix-health ───────────────────────────────────────────────────

describe("ix-ingest status on real output", () => {
  test("backend, graphCompleted, currentRev, lastIngestAt, staleFiles", async () => {
    const { output } = await runTool("ix-ingest.ts", {}, [["'status '*", "success/status"]]);
    expect(output).toContain("**Backend:** ok");
    expect(output).toContain("**Graph:** ingested (rev 1)");
    expect(output).toContain("**Last ingest:** 2026-10-02T01:14:41.855Z");
    expect(output).toContain("**Freshness:** current");
  });

  test("an empty, never-ingested repo is not mapped", async () => {
    const { output } = await runTool("ix-ingest.ts", {}, [["'status '*", "empty-repo/status"]]);
    expect(output).toContain("**Graph:** not mapped");
  });

  test("the subsystems probe reads scores[].name", async () => {
    const { output } = await runTool("ix-ingest.ts", {}, [
      ["'status '*", null],
      ["'subsystems --list '*", "success/subsystems-list"],
    ]);
    expect(output).toContain("**Status:** Graph is present.");
    expect(output).toContain("**Subsystems found:** 11 (Tools, Agents, .github, Workflows, Runtime...)");
  });
});

describe("ix-health on real output", () => {
  test("graphCompleted and currentRev", async () => {
    const { output } = await runTool("ix-health.ts", {}, [["'status '*", "success/status"]]);
    expect(output).toContain("**Status:** OK");
    expect(output).toContain("**Graph:** indexed (rev 1)");
  });

  test("an empty repo is not indexed", async () => {
    const { output } = await runTool("ix-health.ts", {}, [["'status '*", "empty-repo/status"]]);
    expect(output).toContain("**Status:** DEGRADED");
    expect(output).toContain("not indexed");
  });

  test("the subsystems fallback reads scores", async () => {
    const { output } = await runTool("ix-health.ts", {}, [
      ["'status '*", null],
      ["'subsystems --list '*", "success/subsystems-list"],
    ]);
    expect(output).toContain("**Status:** OK");
  });
});

// ─── ix-neighbors ────────────────────────────────────────────────────────────

const NEIGHBOR_ROUTES: Route[] = [
  ["'callers runIx '*", "success/callers"],
  ["'callees runIx '*", "success/callees"],
  ["'depends runIx '*", "success/depends"],
  ["'imported-by runIx '*", "success/imported-by"],
];

describe("ix-neighbors on real output", () => {
  test("JSON path: callers and callees are `results`, totals under `summary`", async () => {
    const { output } = await runTool("ix-neighbors.ts", { symbol: "runIx" }, NEIGHBOR_ROUTES);
    expect(output).toContain("**Callers** (11 total, showing 11):");
    expect(output).toContain("- `execute` (function) — tools/ix-rank.ts:78");
    expect(output).toContain("**Callees** (7 total, showing 7):");
    expect(output).toContain("- `commandAllowsLlm` (function) — runtime/llm.ts:163");
    expectNoMissedFields(output);
  });

  test("JSON path: depends is a tree", async () => {
    const { output } = await runTool("ix-neighbors.ts", { symbol: "runIx", direction: "depends" }, NEIGHBOR_ROUTES);
    expect(output).toContain("**Depends** (23 nodes):");
    expect(output).toContain("- `safeRun` (function) — runtime/cli.ts");
    expect(output).toContain("  - `fetchSubsystemList` (function) — tools/ix-map.ts");
    expect(output).toContain("depth limit reached");
  });

  test("JSON path: imported-by", async () => {
    const { output } = await runTool("ix-neighbors.ts", { symbol: "runIx", direction: "imported-by" }, NEIGHBOR_ROUTES);
    expect(output).toContain("**Imported-by** (18 total, showing 15):");
  });

  test("llm path keeps the records, ids and paths intact", async () => {
    const { output } = await runTool("ix-neighbors.ts", { symbol: "runIx", direction: "depends" }, NEIGHBOR_ROUTES, {
      llm: true,
    });
    expect(output).toContain("**Depends:**");
    expect(output).toContain("dep name=safeRun kind=function id=e6c0b0e6 parent=ee807471 rel=called_by path=runtime/cli.ts");
    expect(output).not.toContain("[REDACTED]");
  });
});

// ─── ix-explain ──────────────────────────────────────────────────────────────

describe("ix-explain on real output", () => {
  const routes: Route[] = [["'explain runIx '*", "success/explain"]];

  test("JSON path: the path is under facts", async () => {
    const { output } = await runTool("ix-explain.ts", { symbol: "runIx" }, routes);
    expect(output).toContain("**Kind:** function");
    expect(output).toContain("**Path:** `runtime/cli.ts`");
    expect(output).toContain("**Role:** shared-utility (medium confidence)");
    expect(output).toContain("**Importance:** high — broad-shared-dependency");
    expect(output).toContain("**Graph:** callers: 11 · callees: 0 · dependents: 11 · members: 0");
    expectNoMissedFields(output);
  });

  test("llm path", async () => {
    const { output } = await runTool("ix-explain.ts", { symbol: "runIx" }, routes, { llm: true });
    expect(output).toContain("entity id=ee807471 name=runIx kind=function path=runtime/cli.ts rev=1");
    expect(output).toContain("role role=shared-utility confidence=medium");
  });
});

// ─── ix-locate / ix-rank / ix-stats / ix-subsystems / ix-inventory ──────────

describe("search and listing tools on real output", () => {
  test("ix-locate: `ix text` hits", async () => {
    const { output } = await runTool("ix-locate.ts", { pattern: "runIx", limit: 5 }, [["'text runIx '*", "success/text"]]);
    expect(output).toContain("**5 matches:**");
    expect(output).toContain("**`runtime/cli.ts:37`** (typescript)");
  });

  test("ix-rank: results and the evaluated count", async () => {
    const { output } = await runTool("ix-rank.ts", { by: "dependents", kind: "function" }, [
      ["'rank --by dependents --kind function '*", "success/rank"],
    ]);
    expect(output).toContain("| 1 | `safeRun` | 12 | — |");
    expect(output).toContain("_Evaluated 98 total, showing 10_");
  });

  test("ix-rank: no entities of a kind is not an empty graph", async () => {
    const { output } = await runTool("ix-rank.ts", { by: "dependents", kind: "class" }, [
      ["'rank --by dependents --kind class '*", "success/rank-empty-kind"],
    ]);
    expect(output).toContain("Ix: No entities found for the given kind.");
    expect(output).not.toContain("The graph may be empty");
  });

  test("ix-stats: edge counts are keyed by predicate, files by node kind", async () => {
    const { output } = await runTool("ix-stats.ts", {}, [["'stats '*", "success/stats"]]);
    expect(output).toContain("- Files indexed: 55");
    expect(output).toContain("- Total nodes: 870");
    expect(output).toContain("- CALLS: 555");
    expect(output).toContain("- IMPORTS: 104");
    expectNoMissedFields(output);
  });

  test("ix-stats llm path", async () => {
    const { output } = await runTool("ix-stats.ts", {}, [["'stats '*", "success/stats"]], { llm: true });
    expect(output).toContain("edges total=1745 CALLS=555");
  });

  test("ix-subsystems: regions by label", async () => {
    const { output } = await runTool("ix-subsystems.ts", {}, [["'subsystems '*", "success/subsystems"]]);
    expect(output).toContain("**11 subsystems** — 38 files, 2 levels");
    expect(output).toContain("| Explain | module | 1 | 7 | 0 | 7 | 0.38 |");
  });

  test("ix-inventory: files and symbols by file", async () => {
    const files = await runTool("ix-inventory.ts", { path: "runtime" }, [
      ["'inventory --kind file '*", "success/inventory-file"],
    ]);
    expect(files.output).toContain("**4 files** under `runtime`");
    expect(files.output).toContain("- `runtime/llm.ts`");
    const fns = await runTool("ix-inventory.ts", { path: "runtime", kind: "function" }, [
      ["'inventory --kind function '*", "success/inventory-function"],
    ]);
    expect(fns.output).toContain("**19 functions** under `runtime`");
    expect(fns.output).toContain("  - `redactSecrets`");
  });
});

// ─── ix-trace ────────────────────────────────────────────────────────────────

describe("ix-trace on real output", () => {
  test("directional: upstream and downstream trees", async () => {
    const { output } = await runTool("ix-trace.ts", { symbol: "safeRun" }, [["'trace safeRun '*", "success/trace"]]);
    expect(output).toContain("**Path:** `runtime/cli.ts`");
    expect(output).toContain("**Upstream** (100 nodes, depth 3):");
    expect(output).toContain("**Downstream** (1 node, depth 2):");
    expect(output).toContain("- `runIx` (function)");
  });

  test("--to: the path between two symbols", async () => {
    const { output } = await runTool("ix-trace.ts", { symbol: "safeRun", to: "runIx" }, [
      ["'trace safeRun --format json --to runIx'*", "success/trace-to"],
    ]);
    expect(output).toContain("**Path to `runIx`** (2 steps):");
    expect(output).toContain("1. `safeRun` (function)");
    expect(output).toContain("2. `runIx` (function)");
    expect(output).not.toContain("No trace paths found");
  });
});

// ─── ix-decide ───────────────────────────────────────────────────────────────

describe("ix-decide on real output", () => {
  test("a high-risk file with 51 dependents is BLOCK, with its real count", async () => {
    const { output } = await runTool("ix-decide.ts", { touched_paths: ["runtime/cli.ts"] }, [
      ["'impact runtime/cli.ts '*", "success/impact-file"],
    ]);
    expect(output).toContain("**Verdict:** BLOCK");
    expect(output).toContain("**Risk:** HIGH");
    expect(output).toContain("**Total dependents:** 51");
  });

  test("a leaf function is ALLOW", async () => {
    const { output } = await runTool("ix-decide.ts", { touched_paths: ["capitalize"] }, [
      ["'impact capitalize '*", "success/impact-leaf"],
    ]);
    expect(output).toContain("**Verdict:** ALLOW");
  });
});

// ─── ix-smells ───────────────────────────────────────────────────────────────

describe("ix-smells on real output", () => {
  const listed = (smells: string, status: string, stats: string): Route[] => [
    ["'smells --list '*", smells],
    ["'status '*", status],
    ["'stats '*", stats],
  ];

  for (const llm of [false, true]) {
    const via = llm ? "llm path" : "JSON path";

    test(`${via}: lists stored claims, and never runs detection`, async () => {
      const { output, calls } = await runTool(
        "ix-smells.ts",
        {},
        listed("success/smells-list", "success/status", "success/stats"),
        { llm },
      );
      expect(output).toContain(llm ? "smells count=31" : "**31 smell claims stored**");
      expect(output).toContain(llm ? "smell kind=has_smell.god_module entity=34c179f9-815" : "### god_module (3)");
      for (const call of calls.filter((c) => c.includes("|smells"))) expect(call).toContain("--list");
    });

    test(`${via}: an empty, never-ingested repo is not mapped, not clean`, async () => {
      const { output } = await runTool(
        "ix-smells.ts",
        {},
        listed("empty-repo/smells-list", "empty-repo/status", "empty-repo/stats"),
        { llm },
      );
      expect(output).toContain("**The Ix graph for this project is not mapped**");
      expect(output).not.toContain("clean.");
      expect(output).not.toContain("Architecture looks clean");
    });

    test(`${via}: a registered workspace the backend holds nothing for is not mapped`, async () => {
      const { output } = await runTool(
        "ix-smells.ts",
        {},
        listed("empty-graph/smells-list", "empty-graph/status", "empty-graph/stats"),
        { llm },
      );
      expect(output).toContain("**The Ix graph for this project is not mapped**");
    });

    test(`${via}: a mapped graph with no stored claims is not called clean either`, async () => {
      const { output } = await runTool(
        "ix-smells.ts",
        {},
        listed("success/smells-list-before-run", "success/status", "success/stats"),
        { llm },
      );
      expect(output).toContain("**No smell claims are stored for this graph.**");
      expect(output).toContain("Run `ix smells`");
      expect(output).not.toContain("Architecture looks clean");
    });
  }

  test("graph health unknown: still not called clean", async () => {
    const { output } = await runTool("ix-smells.ts", {}, [
      ["'smells --list '*", "success/smells-list-before-run"],
      ["'status '*", null],
      ["'stats '*", null],
    ]);
    expect(output).toContain("Ix could not confirm the graph is mapped");
  });
});

// ─── cwd ─────────────────────────────────────────────────────────────────────

describe("tools run ix in the session directory", () => {
  // Outside git OpenCode's worktree is "/", and `worktree ?? directory` ran
  // every `ix` call there.
  test("a worktree of / is not used as the cwd", async () => {
    const { calls, dir } = await runTool("ix-stats.ts", {}, [["'stats '*", "success/stats"]], {
      context: { worktree: "/" },
    });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.split("|")[0]).toBe(dir);
  });

  test("directory wins over a real worktree too", async () => {
    const { calls, dir } = await runTool("ix-explain.ts", { symbol: "runIx" }, [["'explain runIx '*", "success/explain"]], {
      context: { worktree: tmpdir() },
    });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.split("|")[0]).toBe(dir);
  });
});
