/**
 * OpenCodeToolContractParity + RuntimeUnavailableFallback + BunCompatibility
 *
 * Run with: bun test
 *
 * These tests verify:
 * 1. All 17 tool modules export the required fields
 * 2. All tools return strings (never throw) when ix is unavailable
 * 3. Tool parameter schemas are valid JSON Schema objects
 *
 * Tests that require a live OpenCode session or ix CLI are marked @live
 * and skipped in CI unless IX_LIVE_TESTS=1 is set.
 */

import { describe, test, expect } from "bun:test";

// ─── Import all 17 tools ─────────────────────────────────────────────────────

import * as ixQuery from "../tools/ix-query";
import * as ixNeighbors from "../tools/ix-neighbors";
import * as ixImpact from "../tools/ix-impact";
import * as ixMap from "../tools/ix-map";
import * as ixIngest from "../tools/ix-ingest";
import * as ixHistory from "../tools/ix-history";
import * as ixDocsTool from "../tools/ix-docs-tool";
import * as ixLocate from "../tools/ix-locate";
import * as ixExplain from "../tools/ix-explain";
import * as ixRank from "../tools/ix-rank";
import * as ixStats from "../tools/ix-stats";
import * as ixSubsystems from "../tools/ix-subsystems";
import * as ixInventory from "../tools/ix-inventory";
import * as ixTrace from "../tools/ix-trace";
import * as ixDecide from "../tools/ix-decide";
import * as ixHealth from "../tools/ix-health";
import * as ixSmells from "../tools/ix-smells";

const ALL_TOOLS = [
  ixQuery, ixNeighbors, ixImpact, ixMap, ixIngest, ixHistory, ixDocsTool,
  ixLocate, ixExplain, ixRank, ixStats, ixSubsystems, ixInventory,
  ixTrace, ixDecide, ixHealth, ixSmells,
];

const EXPECTED_TOOL_NAMES = [
  "ix-query", "ix-neighbors", "ix-impact", "ix-map", "ix-ingest",
  "ix-history", "ix-docs-tool", "ix-locate", "ix-explain", "ix-rank",
  "ix-stats", "ix-subsystems", "ix-inventory", "ix-trace", "ix-decide",
  "ix-health", "ix-smells",
];

// Invalid directory — guarantees ix CLI and runtime are both unavailable
const DEAD_CTX = { directory: "/tmp/ix-test-nonexistent-workspace-99999" };

// ─── BunCompatibility ────────────────────────────────────────────────────────

describe("BunCompatibility", () => {
  test("all tool modules import successfully under Bun", () => {
    expect(ALL_TOOLS).toHaveLength(17);
    for (const tool of ALL_TOOLS) {
      expect(typeof tool).toBe("object");
    }
  });
});

// ─── OpenCodeToolContractParity ──────────────────────────────────────────────

describe("OpenCodeToolContractParity", () => {
  test("all 17 tools are present", () => {
    expect(ALL_TOOLS).toHaveLength(17);
  });

  for (const tool of ALL_TOOLS) {
    describe(`${(tool as { name?: string }).name ?? "unknown"}`, () => {
      test("exports name (string)", () => {
        expect(typeof (tool as { name: string }).name).toBe("string");
        expect((tool as { name: string }).name.length).toBeGreaterThan(0);
      });

      test("exports description (string)", () => {
        expect(typeof (tool as { description: string }).description).toBe("string");
        expect((tool as { description: string }).description.length).toBeGreaterThan(10);
      });

      test("exports parameters (JSON Schema object)", () => {
        const params = (tool as { parameters: unknown }).parameters;
        expect(params).toBeDefined();
        expect(typeof params).toBe("object");
        expect((params as { type: string }).type).toBe("object");
        expect((params as { properties: unknown }).properties).toBeDefined();
      });

      test("exports execute (async function)", () => {
        const execute = (tool as { execute: unknown }).execute;
        expect(typeof execute).toBe("function");
      });
    });
  }

  test("tool names match expected set", () => {
    const names = ALL_TOOLS.map((t) => (t as { name: string }).name);
    expect(names.sort()).toEqual(EXPECTED_TOOL_NAMES.sort());
  });
});

// ─── RuntimeUnavailableFallback ──────────────────────────────────────────────

describe("RuntimeUnavailableFallback", () => {
  // Tools that require at least one argument
  const toolCalls: Array<[string, () => Promise<string>]> = [
    ["ix-query", () => ixQuery.execute({ symbol: "TestSymbol" }, DEAD_CTX)],
    ["ix-neighbors", () => ixNeighbors.execute({ symbol: "TestSymbol" }, DEAD_CTX)],
    ["ix-impact", () => ixImpact.execute({ target: "TestSymbol" }, DEAD_CTX)],
    ["ix-map", () => ixMap.execute({}, DEAD_CTX)],
    ["ix-ingest", () => ixIngest.execute({}, DEAD_CTX)],
    ["ix-history", () => ixHistory.execute({}, DEAD_CTX)],
    ["ix-docs-tool", () => ixDocsTool.execute({ target: "TestSymbol" }, DEAD_CTX)],
    ["ix-locate", () => ixLocate.execute({ pattern: "test" }, DEAD_CTX)],
    ["ix-explain", () => ixExplain.execute({ symbol: "TestSymbol" }, DEAD_CTX)],
    ["ix-rank", () => ixRank.execute({}, DEAD_CTX)],
    ["ix-stats", () => ixStats.execute({} as Parameters<typeof ixStats.execute>[0], DEAD_CTX)],
    ["ix-subsystems", () => ixSubsystems.execute({} as Parameters<typeof ixSubsystems.execute>[0], DEAD_CTX)],
    ["ix-inventory", () => ixInventory.execute({ path: "src/" }, DEAD_CTX)],
    ["ix-trace", () => ixTrace.execute({ symbol: "TestSymbol" }, DEAD_CTX)],
    ["ix-decide", () => ixDecide.execute({ touched_paths: ["src/test.ts"] }, DEAD_CTX)],
    ["ix-health", () => ixHealth.execute({} as Parameters<typeof ixHealth.execute>[0], DEAD_CTX)],
    ["ix-smells", () => ixSmells.execute({}, DEAD_CTX)],
  ];

  for (const [name, call] of toolCalls) {
    test(`${name} returns a string (does not throw) when ix and runtime unavailable`, async () => {
      let result: string;
      let threw = false;
      try {
        result = await call();
      } catch {
        threw = true;
        result = "";
      }
      expect(threw).toBe(false);
      expect(typeof result!).toBe("string");
      expect(result!.length).toBeGreaterThan(0);
    });
  }
});

// ─── Hook contract (structural) ──────────────────────────────────────────────

describe("PluginHookContract", () => {
  // The v1.4.2 plugin format (migrated in f9ea81e) exports a named `server`
  // Plugin function. Invoking it yields the registration object: a `tool` map
  // plus hook handlers keyed by event name (e.g. "tool.execute.after"). `ix` is
  // unavailable here, so the startup probe inside `server` falls through its
  // try/catch and the function still resolves.
  const PLUGIN_CTX = {
    directory: DEAD_CTX.directory,
    worktree: DEAD_CTX.directory,
  };

  async function loadRegistration(): Promise<Record<string, unknown>> {
    const mod = await import("../plugins/ix-plugin");
    expect(typeof mod.server).toBe("function");
    return (await mod.server(PLUGIN_CTX as never)) as Record<string, unknown>;
  }

  test("plugin module exports a server Plugin function", async () => {
    const reg = await loadRegistration();
    expect(reg).toBeDefined();
    expect(typeof reg).toBe("object");
  });

  test("plugin registers 17 tools", async () => {
    const reg = await loadRegistration();
    const tools = reg.tool as Record<string, unknown>;
    expect(typeof tools).toBe("object");
    expect(Object.keys(tools)).toHaveLength(17);
    expect(Object.keys(tools).sort()).toEqual([...EXPECTED_TOOL_NAMES].sort());
  });

  test("plugin registers the tool.execute.after hook", async () => {
    const reg = await loadRegistration();
    expect(typeof reg["tool.execute.after"]).toBe("function");
  });
});


// ─── NonZeroExitDiagnostics (Ix#539) ─────────────────────────────────────────
//
// Several `ix` commands exit 1 to mean "you asked for something that does not
// exist" while still printing a useful JSON body, and `locate` is about to join
// them. Bun's `$` throws on a non-zero exit and `.text()` discards stdout along
// with it, so those diagnostics vanished and the tool fell back to a generic
// "Not found in graph" — losing the guidance ix had actually supplied.
//
// These run in a CHILD process. Bun's shell resolves binaries from the real
// process PATH: neither mutating `process.env.PATH` nor `$.env({PATH})` /
// `.env({PATH})` redirects it, so an in-process stub is silently ignored and
// the test would exercise the developer's real `ix` against their real graph.
// A child process with its own PATH is the only way to stub it, and it has the
// side benefit of covering the actual spawn path.

import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const TOOL_PATH = path.resolve(import.meta.dir, "../tools/ix-docs-tool.ts");

async function runToolWithStubIx(stubScript: string | null): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-stub-"));
  try {
    if (stubScript !== null) {
      const bin = path.join(dir, "ix");
      writeFileSync(bin, `#!/bin/sh\n${stubScript}\n`);
      chmodSync(bin, 0o755);
    }

    const runner = path.join(dir, "runner.ts");
    writeFileSync(
      runner,
      `import * as tool from ${JSON.stringify(TOOL_PATH)};\n` +
      `const out = await tool.execute({ target: "SomeSymbol", depth: "brief" }, { directory: ${JSON.stringify(dir)} });\n` +
      `process.stdout.write(out);\n`,
    );

    // PATH is exactly the stub dir plus the system dirs `sh` needs, so the real
    // `ix` cannot be reached even if one is installed.
    // process.execPath, not "bun": the restricted PATH below deliberately does
    // not contain bun's own directory.
    const proc = Bun.spawn([process.execPath, runner], {
      env: { ...process.env, PATH: `${dir}${path.delimiter}/usr/bin${path.delimiter}/bin` },
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

describe("NonZeroExitDiagnostics", () => {
  test("keeps the JSON body when ix exits non-zero", async () => {
    const output = await runToolWithStubIx(`
case "$1" in
  locate)   echo '{"resolvedTarget":null,"resolutionMode":"none","diagnostics":["No graph entity found."]}'; exit 1 ;;
  overview) echo '{"summary":"Overview body retained."}'; exit 1 ;;
  *)        echo '{}'; exit 1 ;;
esac`);

    // The generic fallback would mean both payloads were thrown away.
    expect(output).not.toContain("**Not found in graph.**");
    expect(output).toContain("Overview body retained.");
  });

  test("still reports not-found when ix exits non-zero with no output", async () => {
    const output = await runToolWithStubIx("exit 1");
    expect(output).toContain("**Not found in graph.**");
  });

  test("still reports not-found when ix is absent entirely", async () => {
    const output = await runToolWithStubIx(null);
    expect(output).toContain("**Not found in graph.**");
  });
});

// ─── RuntimeClientTimers ─────────────────────────────────────────────────────
//
// `callRuntime` cleared its abort timer only after a successful fetch, so when
// the runtime was unreachable — the normal case on a machine without it, which
// is exactly why the tools have a CLI fallback — the timer stayed pending for
// its full 5s. A pending timer keeps the event loop alive, so the host process
// hung for five seconds at exit on every single call. `isRuntimeAvailable`
// never captured its timer at all.
//
// Invisible in-process (the call itself returns in ~20ms); only the exit is
// delayed. So this measures how long a child takes to *exit* after the call
// resolves.

test("runtime client does not hold the process open after an unreachable call", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-timer-"));
  try {
    const runner = path.join(dir, "runner.ts");
    const client = path.resolve(import.meta.dir, "../runtime/client.ts");
    writeFileSync(
      runner,
      `const client = await import(${JSON.stringify(client)});\n` +
      // Port 9 (discard) refuses immediately, so any delay is the leaked timer.
      `await client.callRuntime("/v2/ix_query", {}, { dir: ${JSON.stringify(dir)} });\n` +
      `await client.isRuntimeAvailable();\n`,
    );

    const started = Date.now();
    const proc = Bun.spawn([process.execPath, runner], {
      env: { ...process.env, IX_RUNTIME_URL: "http://127.0.0.1:9" },
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    const elapsed = Date.now() - started;

    // Was ~5000ms (callRuntime) + ~2000ms (isRuntimeAvailable) before the fix.
    // A generous ceiling still separates "exits promptly" from "waits out a
    // 5s timer", without being flaky on a slow runner.
    expect(elapsed).toBeLessThan(3000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20_000);
