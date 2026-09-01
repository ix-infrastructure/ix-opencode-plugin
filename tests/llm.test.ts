/**
 * The `--format llm` gate.
 *
 * Run with: bun test
 *
 * `ix` does not validate `--format`. Every renderer is
 * `if json … else if llm … else text`, so an unrecognised value falls through
 * to human-readable text and exits 0. That is what makes this safe to ship —
 * no version of `ix` breaks on `--format llm` — and equally what makes a wrong
 * floor dangerous: an old CLI answers with prose, successfully, and nothing
 * raises. Most of what follows pins that boundary.
 */

import { describe, test, expect, beforeEach } from "bun:test";

import {
  LLM_MIN_VERSION,
  commandAllowsLlm,
  gte,
  isLlmErrorLine,
  llmDisabled,
  parseSemver,
  resetLlmVersionCache,
} from "../runtime/llm.ts";

beforeEach(() => {
  resetLlmVersionCache();
  delete process.env["IX_DISABLE_LLM_FORMAT"];
});

describe("parseSemver", () => {
  test("parses a plain version", () => {
    expect(parseSemver("0.9.2")).toEqual([0, 9, 2]);
  });

  test("parses a decorated version", () => {
    expect(parseSemver("ix 0.9.2 (linux-amd64)")).toEqual([0, 9, 2]);
  });

  test("returns null for junk", () => {
    expect(parseSemver("unknown")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("gte", () => {
  test("compares across each position", () => {
    expect(gte([0, 9, 2], [0, 9, 2])).toBe(true);
    expect(gte([0, 9, 3], [0, 9, 2])).toBe(true);
    expect(gte([0, 10, 0], [0, 9, 9])).toBe(true);
    expect(gte([1, 0, 0], [0, 99, 99])).toBe(true);
    expect(gte([0, 9, 1], [0, 9, 2])).toBe(false);
    expect(gte([0, 6, 0], [0, 7, 0])).toBe(false);
  });
});

describe("the version table", () => {
  test("Tier 1-4 commands sit at 0.7.0", () => {
    for (const command of [
      "map", "subsystems", "impact", "smells", "overview", "stats",
      "inventory", "rank", "depends", "trace", "callers", "callees",
      "imports", "imported-by", "text", "history", "locate", "diff",
    ]) {
      expect(LLM_MIN_VERSION[command]).toEqual([0, 7, 0]);
    }
  });

  test("Tier 5 commands sit at 0.9.2", () => {
    // The reason this is a table and not one constant. Before 0.9.2 these two
    // accepted `--format llm` and rendered text, so a single 0.7.0 floor would
    // have forwarded prose to the model as though it were records.
    expect(LLM_MIN_VERSION["explain"]).toEqual([0, 9, 2]);
    expect(LLM_MIN_VERSION["read"]).toEqual([0, 9, 2]);
  });

  test("Pro commands are absent at every version", () => {
    // @ix/pro declares only text|json — there is no llm renderer to gate on,
    // so no floor can make these safe and none should try.
    for (const command of ["briefing", "decisions", "goals", "plan", "truth", "bugs"]) {
      expect(LLM_MIN_VERSION[command]).toBeUndefined();
      expect(commandAllowsLlm([command])).toBe(false);
    }
  });
});

describe("commandAllowsLlm", () => {
  test("accepts a known command", () => {
    expect(commandAllowsLlm(["stats"])).toBe(true);
    expect(commandAllowsLlm(["rank", "--by", "dependents"])).toBe(true);
  });

  test("refuses an unknown command", () => {
    expect(commandAllowsLlm(["nonesuch"])).toBe(false);
  });

  test("refuses an empty argv", () => {
    expect(commandAllowsLlm([])).toBe(false);
  });

  test("keeps `diff --content` on text", () => {
    // docs/llm-format.md keeps this on text deliberately: verbatim hunks have
    // no record form.
    expect(commandAllowsLlm(["diff", "1", "5"])).toBe(true);
    expect(commandAllowsLlm(["diff", "1", "5", "--content"])).toBe(false);
  });
});

describe("isLlmErrorLine", () => {
  test("detects the error record ix writes to stdout with exit 0", () => {
    // Checking only the exit status would forward this to the model as though
    // it were a result. Detecting it defers to the JSON path, whose error
    // envelope is what each tool already documents.
    expect(isLlmErrorLine('error code=unknown_target message="No entity named X"')).toBe(true);
    expect(isLlmErrorLine('  error code=ambiguous_target message="…"')).toBe(true);
  });

  test("does not fire on real records", () => {
    expect(isLlmErrorLine("stats nodes=98979 edges=354283")).toBe(false);
    expect(isLlmErrorLine('region id=cli label="Cli / Client" level=2')).toBe(false);
    // A record that merely mentions an error is not an error line.
    expect(isLlmErrorLine('smell kind=has_smell.error_swallow file=a.ts')).toBe(false);
  });
});

describe("kill switch", () => {
  test("IX_DISABLE_LLM_FORMAT forces the JSON path", () => {
    for (const value of ["1", "true", "TRUE", "yes"]) {
      process.env["IX_DISABLE_LLM_FORMAT"] = value;
      expect(llmDisabled()).toBe(true);
    }
    process.env["IX_DISABLE_LLM_FORMAT"] = "0";
    expect(llmDisabled()).toBe(false);
    delete process.env["IX_DISABLE_LLM_FORMAT"];
    expect(llmDisabled()).toBe(false);
  });
});

describe("tool wiring", () => {
  // The envelope is the point of the middle path: each tool keeps its own
  // header and error handling and swaps only the body. A fast-path that
  // returned bare records would strip the header the model orients on.
  const CASES: [string, string][] = [
    ["ix-stats.ts", "## ix-stats"],
    ["ix-subsystems.ts", "## ix-subsystems"],
    ["ix-smells.ts", "## ix-smells"],
    ["ix-trace.ts", "## ix-trace:"],
    ["ix-locate.ts", "## ix-locate:"],
    ["ix-rank.ts", "## ix-rank:"],
    ["ix-inventory.ts", "## ix-inventory:"],
    ["ix-explain.ts", "## ix-explain:"],
  ];

  for (const [file, header] of CASES) {
    test(`${file} keeps its header on the fast path`, async () => {
      const source = await Bun.file(`${import.meta.dir}/../tools/${file}`).text();
      const index = source.indexOf("tryLlm(");
      expect(index).toBeGreaterThan(-1);
      // The header has to appear in the fast-path return, which is the few
      // lines after the tryLlm call. Window is generous because some of those
      // call sites carry a paragraph of comment before the return.
      expect(source.slice(index, index + 900)).toContain(header);
    });
  }

  test("ix-neighbors labels each section on the fast path", async () => {
    const source = await Bun.file(`${import.meta.dir}/../tools/ix-neighbors.ts`).text();
    const index = source.indexOf("tryLlm(");
    expect(source.slice(index, index + 400)).toContain("capitalize(direction)");
  });

  test("no tool sends a Pro command down the fast path", async () => {
    const { readdirSync } = await import("node:fs");
    const dir = `${import.meta.dir}/../tools`;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const source = await Bun.file(`${dir}/${file}`).text();
      for (const match of source.matchAll(/tryLlm\(\s*\[\s*"([a-z-]+)"/g)) {
        expect(LLM_MIN_VERSION[match[1]!]).toBeDefined();
      }
    }
  });
});
