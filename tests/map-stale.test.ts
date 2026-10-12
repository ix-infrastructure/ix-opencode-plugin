// Copyright 2026 Ix Infrastructure Inc.

/**
 * A deferred map (Ix#841, CL-13) is labelled; a fresh or older Ix is not.
 *
 * The tools run against a fake `ix` replaying the real v0.12.0 `subsystems`
 * output (which has none of the new fields) and the same output with the
 * fields Ix#841 adds. Without them, or with them saying "fresh", the output
 * must be exactly what it was.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { fakePath, writeFakeIx } from "./fake-ix.ts";
import { mapStaleFromJson, mapStaleFromLlm, mapStaleNote } from "../runtime/map-stale.ts";

const SUCCESS = path.resolve(import.meta.dir, "fixtures/ix-v0.12.0/success");
const read = (name: string) => readFileSync(path.join(SUCCESS, name), "utf8");
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const STDERR_LINE =
  "ix: architecture map is stale (another ix map is running); regions shown may predate recent edits. Run ix map --remap to refresh.";
const NOTE_NAMED = "_Stale map: regions as of map rev 7, 38 files; the map is refreshing — re-run after it completes._";
const NOTE_PLAIN = "_Stale map: regions are from the previous map; the map is refreshing — re-run after it completes._";
/** The stderr line for a refresh that was debounced or failed (Ix#841 `ensureFreshMap`). */
const staleLine = (why: string) =>
  `ix: architecture map is stale (${why}); regions shown may predate recent edits. Run ix map --remap to refresh.`;
const DEBOUNCED_LINE = staleLine("a refresh was tried moments ago");
const FAILED_LINE = staleLine("its refresh failed");
const NOTE_REMAP_NAMED = "_Stale map: regions as of map rev 7, 38 files; not recomputed since recent edits — run `ix map --remap` to refresh._";
const NOTE_REMAP_PLAIN = "_Stale map: regions are from the previous map; not recomputed since recent edits — run `ix map --remap` to refresh._";

/** `subsystems` (and `--list`, `stats`) answers for one run of a tool. */
type Answers = {
  json?: string;
  llm?: string;
  scoped?: string;
  stderr?: string;
};

/** Run `tools/<toolFile>` against a fake `ix` that answers from `answers`. */
async function runTool(
  toolFile: string,
  params: Record<string, unknown>,
  answers: Answers,
  opts: { llm?: boolean } = {},
): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-map-stale-"));
  try {
    const file = (name: string, body: string | undefined) => {
      const p = path.join(dir, name);
      writeFileSync(p, body ?? "");
      return sq(p);
    };
    const json = file("subsystems.json", answers.json ?? read("subsystems.json"));
    const llm = file("subsystems.txt", answers.llm ?? read("subsystems.txt"));
    const scoped = file("scoped.json", answers.scoped ?? read("subsystems-scope.json"));
    const list = file("list.json", read("subsystems-list.json"));
    const stats = file("stats.json", read("stats.json"));
    const stderr = file("stderr.txt", answers.stderr ? `${answers.stderr}\n` : "");
    writeFakeIx(
      dir,
      `
case "\${1:-}" in --version) echo 0.12.0; exit 0 ;; esac
_fmt=json
for _a in "$@"; do [ "$_a" = llm ] && _fmt=llm; done
case "$*" in
  'subsystems --list '*) cat ${list} ;;
  'stats '*) cat ${stats} ;;
  'subsystems Runtime '*) cat ${stderr} >&2; cat ${scoped} ;;
  'subsystems '*)
    cat ${stderr} >&2
    if [ "$_fmt" = llm ]; then cat ${llm}; else cat ${json}; fi ;;
  *) echo "fake ix: no answer for: $*" >&2; exit 3 ;;
esac`,
    );
    const runner = path.join(dir, "runner.ts");
    const toolPath = path.resolve(import.meta.dir, `../tools/${toolFile}`);
    writeFileSync(
      runner,
      `import * as tool from ${JSON.stringify(toolPath)};\n` +
        `const out = await tool.execute(${JSON.stringify(params)}, ${JSON.stringify({ directory: dir })});\n` +
        `process.stdout.write(String(out));\n`,
    );
    const proc = Bun.spawn([process.execPath, runner], {
      cwd: dir,
      env: { ...process.env, PATH: fakePath(dir), IX_DISABLE_LLM_FORMAT: opts.llm ? "" : "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    return output;
  } finally {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}

/** The v0.12.0 `subsystems` JSON with fields merged in. */
function withFields(base: string, fields: Record<string, unknown>): string {
  return JSON.stringify({ ...JSON.parse(base), ...fields });
}

const FRESH = { map_stale: false, regions_as_of: null };
const STALE = { map_stale: true, regions_as_of: { map_rev: 7, file_count: 38 } };

describe("mapStaleFromJson / mapStaleFromLlm", () => {
  test("absent or fresh fields, and no stderr line, are not stale", () => {
    expect(mapStaleFromJson({ regions: [] })).toBeNull();
    expect(mapStaleFromJson({ ...FRESH })).toBeNull();
    expect(mapStaleFromJson(null, "")).toBeNull();
    expect(mapStaleFromLlm(read("subsystems.txt"))).toBeNull();
    expect(mapStaleFromLlm(read("subsystems.txt"), "some other warning\n")).toBeNull();
  });

  test("map_stale and regions_as_of name the map", () => {
    expect(mapStaleFromJson(STALE)).toEqual({ rev: 7, files: 38 });
    expect(mapStaleFromJson({ regions_as_of: { map_rev: 7, file_count: 38 } })).toEqual({ rev: 7, files: 38 });
    expect(mapStaleFromJson({ map_stale: true, regions_as_of: null })).toEqual({ rev: undefined, files: undefined });
    expect(
      mapStaleFromLlm("map files=38 regions=11 levels=2 rev=9 outcome=ok map_stale=true regions_as_of_rev=7 regions_as_of_files=38\nregion id=x"),
    ).toEqual({ rev: 7, files: 38 });
    expect(mapStaleFromLlm("map files=1 regions=0 levels=1 rev=1 outcome=ok map_stale=true")).toEqual({ rev: undefined, files: undefined });
  });

  test("a diagnostic code=map_stale record counts as the map record's flag", () => {
    const diag = 'diagnostic code=map_stale message="Stale map: not recomputed after this edit. Every count and region here is from the last map (map rev 7, 38 files). Run ix map --remap to recompute it now; region views refresh it in the background."';
    const record = "map files=38 regions=11 levels=2 rev=7 outcome=ok map_stale=true regions_as_of_rev=7 regions_as_of_files=38";
    expect(mapStaleFromLlm(`${record}\n${diag}\nregion id=x`)).toEqual({ rev: 7, files: 38 });
    expect(mapStaleFromLlm(`map files=38 regions=11 levels=2 rev=7 outcome=ok\n${diag}`)).toEqual({ rev: undefined, files: undefined });
    // Another diagnostic is not a stale map.
    expect(mapStaleFromLlm('map files=38 regions=11 levels=2 rev=7 outcome=ok\ndiagnostic code=other message="map_stale"')).toBeNull();
  });

  test("the region view's stderr line is stale, coloured or not", () => {
    expect(mapStaleFromJson({ regions: [] }, `${STDERR_LINE}\n`)).toEqual({
      rev: undefined,
      files: undefined,
      reason: "another ix map is running",
    });
    expect(mapStaleFromLlm(read("subsystems.txt"), `\u001b[2m${STDERR_LINE}\u001b[22m\n`)).not.toBeNull();
  });

  test("the note", () => {
    expect(mapStaleNote({ rev: 7, files: 38 })).toBe(NOTE_NAMED);
    expect(mapStaleNote({})).toBe(NOTE_PLAIN);
    expect(mapStaleNote({ reason: "another ix map is running" })).toBe(NOTE_PLAIN);
  });

  test("a refresh under way says re-run shortly", () => {
    for (const why of ["refreshing in background", "another ix map is running"]) {
      const stale = mapStaleFromJson({ regions: [] }, `${staleLine(why)}\n`);
      expect(stale).toEqual({ rev: undefined, files: undefined, reason: why });
      expect(mapStaleNote(stale!)).toBe(NOTE_PLAIN);
      expect(mapStaleNote(mapStaleFromLlm(read("subsystems.txt"), `\u001b[2m${staleLine(why)}\u001b[22m\n`)!)).toBe(NOTE_PLAIN);
      expect(mapStaleNote({ rev: 7, files: 38, reason: why })).toBe(NOTE_NAMED);
    }
  });

  test("a debounced, failed, unstartable or disabled refresh points to ix map --remap, not a re-run", () => {
    for (const why of [
      "its last background refresh failed",
      "its refresh could not start",
      "its refresh failed",
      "a refresh was tried moments ago",
      "background refresh is off",
      // Older #841 builds; still harmless.
      "its refresh did not complete",
      "files changed while it was refreshed",
      // A reason this plugin does not know yet: the same as today.
      "some future reason",
    ]) {
      const stale = mapStaleFromJson({ regions: [] }, `${staleLine(why)}\n`);
      expect(stale).toEqual({ rev: undefined, files: undefined, reason: why });
      expect(mapStaleNote(stale!)).toBe(NOTE_REMAP_PLAIN);
      expect(mapStaleNote(mapStaleFromLlm(read("subsystems.txt"), `\u001b[2m${staleLine(why)}\u001b[22m\n`)!)).toBe(NOTE_REMAP_PLAIN);
    }
    expect(mapStaleNote({ rev: 7, files: 38, reason: "its refresh failed" })).toBe(NOTE_REMAP_NAMED);
  });
});

describe("ix-subsystems", () => {
  test("absent and fresh fields give byte-identical output", async () => {
    const absent = await runTool("ix-subsystems.ts", {}, {});
    expect(absent).toContain("**11 subsystems** — 38 files, 2 levels\n\n| Subsystem |");
    expect(absent).not.toContain("Stale map");
    const fresh = await runTool("ix-subsystems.ts", {}, { json: withFields(read("subsystems.json"), FRESH) });
    expect(fresh).toBe(absent);
  });

  test("a stale map labels the counts with the map they come from", async () => {
    const out = await runTool("ix-subsystems.ts", {}, { json: withFields(read("subsystems.json"), STALE) });
    expect(out).toContain(`**11 subsystems** — 38 files, 2 levels\n${NOTE_NAMED}\n\n| Subsystem |`);
  });

  test("the stderr line alone labels them", async () => {
    const out = await runTool("ix-subsystems.ts", {}, { stderr: STDERR_LINE });
    expect(out).toContain(`**11 subsystems** — 38 files, 2 levels\n${NOTE_PLAIN}\n\n| Subsystem |`);
  });

  test("a debounced or failed refresh points to ix map --remap", async () => {
    const json = await runTool("ix-subsystems.ts", {}, { stderr: DEBOUNCED_LINE });
    expect(json).toContain(`**11 subsystems** — 38 files, 2 levels\n${NOTE_REMAP_PLAIN}\n\n| Subsystem |`);
    expect(json).not.toContain("re-run after it completes");
    const llm = await runTool("ix-subsystems.ts", {}, { stderr: FAILED_LINE }, { llm: true });
    expect(llm).toBe(`## ix-subsystems\n\n${NOTE_REMAP_PLAIN}\n\n${read("subsystems.txt").trim()}`);
  });

  test("llm path: unchanged when fresh, labelled when stale", async () => {
    const fresh = await runTool("ix-subsystems.ts", {}, {}, { llm: true });
    expect(fresh).toBe(`## ix-subsystems\n\n${read("subsystems.txt").trim()}`);

    const llm = read("subsystems.txt").replace(
      /^(map [^\n]*)/,
      "$1 map_stale=true regions_as_of_rev=7 regions_as_of_files=38",
    );
    const stale = await runTool("ix-subsystems.ts", {}, { llm }, { llm: true });
    expect(stale).toBe(`## ix-subsystems\n\n${NOTE_NAMED}\n\n${llm.trim()}`);

    const viaStderr = await runTool("ix-subsystems.ts", {}, { stderr: STDERR_LINE }, { llm: true });
    expect(viaStderr).toBe(`## ix-subsystems\n\n${NOTE_PLAIN}\n\n${read("subsystems.txt").trim()}`);
  });

  test("llm path: a diagnostic code=map_stale record is kept and parsed without breaking", async () => {
    const llm = read("subsystems.txt").replace(
      /^(map [^\n]*)/,
      '$1 map_stale=true regions_as_of_rev=7 regions_as_of_files=38\ndiagnostic code=map_stale message="Stale map: not recomputed after this edit."',
    );
    const out = await runTool("ix-subsystems.ts", {}, { llm, stderr: staleLine("refreshing in background") }, { llm: true });
    expect(out).toBe(`## ix-subsystems\n\n${NOTE_NAMED}\n\n${llm.trim()}`);
  });

  test("llm path: each stderr reason picks its note", async () => {
    for (const why of ["refreshing in background", "another ix map is running"]) {
      const out = await runTool("ix-subsystems.ts", {}, { stderr: staleLine(why) }, { llm: true });
      expect(out).toBe(`## ix-subsystems\n\n${NOTE_PLAIN}\n\n${read("subsystems.txt").trim()}`);
    }
    for (const why of ["its last background refresh failed", "its refresh could not start", "background refresh is off"]) {
      const out = await runTool("ix-subsystems.ts", {}, { stderr: staleLine(why) }, { llm: true });
      expect(out).toBe(`## ix-subsystems\n\n${NOTE_REMAP_PLAIN}\n\n${read("subsystems.txt").trim()}`);
    }
  });
});

describe("ix-map", () => {
  test("absent and fresh fields give byte-identical output", async () => {
    const absent = await runTool("ix-map.ts", {}, {});
    expect(absent).toContain("**Subsystems** (11, 38 files):\n\n| Subsystem |");
    expect(absent).not.toContain("Stale map");
    const fresh = await runTool("ix-map.ts", {}, { json: withFields(read("subsystems.json"), FRESH) });
    expect(fresh).toBe(absent);
  });

  test("a stale map labels the subsystem counts", async () => {
    const out = await runTool("ix-map.ts", {}, { json: withFields(read("subsystems.json"), STALE) });
    expect(out).toContain(`**Subsystems** (11, 38 files):\n${NOTE_NAMED}\n\n| Subsystem |`);
    const viaStderr = await runTool("ix-map.ts", {}, { stderr: STDERR_LINE });
    expect(viaStderr).toContain(`**Subsystems** (11, 38 files):\n${NOTE_PLAIN}\n\n| Subsystem |`);
  });

  test("a debounced or failed refresh points to ix map --remap", async () => {
    const out = await runTool("ix-map.ts", {}, { json: withFields(read("subsystems.json"), STALE), stderr: FAILED_LINE });
    expect(out).toContain(`**Subsystems** (11, 38 files):\n${NOTE_REMAP_NAMED}\n\n| Subsystem |`);
    const debounced = await runTool("ix-map.ts", {}, { stderr: DEBOUNCED_LINE });
    expect(debounced).toContain(`**Subsystems** (11, 38 files):\n${NOTE_REMAP_PLAIN}\n\n| Subsystem |`);
  });

  test("a scoped region is labelled too, and unchanged when fresh", async () => {
    const params = { scope: "Runtime", include_stats: false };
    const absent = await runTool("ix-map.ts", params, {});
    expect(absent).not.toContain("Stale map");
    const fresh = await runTool("ix-map.ts", params, { scoped: withFields(read("subsystems-scope.json"), FRESH) });
    expect(fresh).toBe(absent);
    const stale = await runTool("ix-map.ts", params, { scoped: withFields(read("subsystems-scope.json"), STALE) });
    expect(stale).toContain(`(module, level 1, 8 files, confidence 0.40)\n${NOTE_NAMED}\nPart of: Tools`);
  });
});
