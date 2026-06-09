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
