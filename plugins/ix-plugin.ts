/**
 * ix-plugin.ts — OpenCode plugin entry point (v1.4.2 format)
 *
 * Exports `server` — the Plugin function that registers all 17 Ix tools
 * and post-edit ingest / stale-graph hooks.
 */

import { tool } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode-ai/plugin";
import { $ } from "bun";

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

const IX_GRAPH_TOOLS = [
  "ix-query", "ix-neighbors", "ix-impact", "ix-map", "ix-docs-tool",
  "ix-locate", "ix-explain", "ix-rank", "ix-trace", "ix-smells",
];

function isSourceFile(path: string): boolean {
  const skip = ["node_modules", ".git", "dist", "build", ".opencode/ix-cache", "package-lock.json", "yarn.lock", "bun.lock"];
  return !skip.some((s) => path.includes(s));
}

export const server: Plugin = async ({ directory }) => {
  // Trigger initial graph build if empty
  try {
    const out = await $`ix subsystems --list --format json`.cwd(directory).quiet().text();
    const parsed = JSON.parse(out);
    const names: string[] = parsed.names ?? parsed.list ?? [];
    if (names.length === 0) {
      $`ix map --silent`.cwd(directory).quiet().catch(() => {});
    }
  } catch {
    // ix unavailable — tools will return helpful fallback messages
  }

  return {
    // ─── Tools ───────────────────────────────────────────────────────────────

    tool: {
      "ix-query": tool({
        description: ixQuery.description,
        args: {
          symbol: tool.schema.string().describe("Symbol name, file path, or subsystem name to look up"),
          kind: tool.schema.enum(["function", "class", "file", "module"] as const).optional().describe("Optional: narrow to a specific kind"),
          path: tool.schema.string().optional().describe("Optional: narrow results to a specific directory path"),
        },
        async execute(args, ctx) {
          return ixQuery.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-neighbors": tool({
        description: ixNeighbors.description,
        args: {
          symbol: tool.schema.string().describe("Symbol, class, or file to get neighbors for"),
          direction: tool.schema.enum(["callers", "callees", "depends", "imported-by", "all"] as const).optional().describe("Which neighbors to fetch. Default: all"),
          limit: tool.schema.number().optional().describe("Max results per direction. Default: 15"),
          depth: tool.schema.number().optional().describe("Traversal depth for depends. Default: 2"),
        },
        async execute(args, ctx) {
          return ixNeighbors.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-impact": tool({
        description: ixImpact.description,
        args: {
          target: tool.schema.string().describe("Symbol name or file path to assess"),
        },
        async execute(args, ctx) {
          return ixImpact.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-map": tool({
        description: ixMap.description,
        args: {
          scope: tool.schema.string().optional().describe("Optional: scope to a specific subsystem or path prefix"),
          include_stats: tool.schema.boolean().optional().describe("Include codebase stats. Default: true"),
        },
        async execute(args, ctx) {
          return ixMap.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-ingest": tool({
        description: ixIngest.description,
        args: {
          refresh: tool.schema.boolean().optional().describe("If true, trigger a graph refresh. Default: false"),
          silent: tool.schema.boolean().optional().describe("Run ix map --silent. Default: true"),
        },
        async execute(args, ctx) {
          return ixIngest.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-history": tool({
        description: ixHistory.description,
        args: {
          topic: tool.schema.string().optional().describe("Symbol or topic to filter history to. Omit for workspace-wide."),
          include: tool.schema.array(
            tool.schema.enum(["decisions", "bugs", "changes", "briefing"] as const)
          ).optional().describe("What to fetch. Default: ['briefing']"),
        },
        async execute(args, ctx) {
          return ixHistory.execute(
            args as Parameters<typeof ixHistory.execute>[0],
            { directory: ctx.directory, worktree: ctx.worktree }
          );
        },
      }),

      "ix-docs-tool": tool({
        description: ixDocsTool.description,
        args: {
          target: tool.schema.string().describe("Symbol name, file path, or subsystem name to summarize"),
          depth: tool.schema.enum(["brief", "standard", "full"] as const).optional().describe("How much detail. Default: standard"),
        },
        async execute(args, ctx) {
          return ixDocsTool.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-locate": tool({
        description: ixLocate.description,
        args: {
          pattern: tool.schema.string().describe("Text pattern or keyword to search for"),
          limit: tool.schema.number().optional().describe("Max results. Default: 20, max: 100"),
          path: tool.schema.string().optional().describe("Restrict search to a directory path prefix"),
          language: tool.schema.string().optional().describe("Restrict to a specific language (e.g. typescript)"),
        },
        async execute(args, ctx) {
          return ixLocate.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-explain": tool({
        description: ixExplain.description,
        args: {
          symbol: tool.schema.string().describe("Symbol name to explain (class, function, file, or module)"),
        },
        async execute(args, ctx) {
          return ixExplain.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-rank": tool({
        description: ixRank.description,
        args: {
          by: tool.schema.enum(["dependents", "callers", "importers", "members"] as const).optional().describe("Metric to rank by. Default: dependents"),
          kind: tool.schema.enum(["class", "function", "file", "interface", "module"] as const).optional().describe("Symbol kind to rank. Default: class"),
          top: tool.schema.number().optional().describe("How many results. Default: 10, max: 50"),
          path: tool.schema.string().optional().describe("Restrict ranking to a directory path prefix"),
        },
        async execute(args, ctx) {
          return ixRank.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-stats": tool({
        description: ixStats.description,
        args: {},
        async execute(_args, ctx) {
          return ixStats.execute({} as never, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-subsystems": tool({
        description: ixSubsystems.description,
        args: {},
        async execute(_args, ctx) {
          return ixSubsystems.execute({} as never, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-inventory": tool({
        description: ixInventory.description,
        args: {
          path: tool.schema.string().describe("Directory path prefix to enumerate (e.g. src/auth)"),
          kind: tool.schema.enum(["file", "class", "function", "interface", "module"] as const).optional().describe("What to enumerate. Default: file"),
        },
        async execute(args, ctx) {
          return ixInventory.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-trace": tool({
        description: ixTrace.description,
        args: {
          symbol: tool.schema.string().describe("Symbol to trace execution paths for"),
          to: tool.schema.string().optional().describe("Trace only paths from symbol to this target"),
        },
        async execute(args, ctx) {
          return ixTrace.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-decide": tool({
        description: ixDecide.description,
        args: {
          touched_paths: tool.schema.array(tool.schema.string()).describe("File paths that will be edited"),
          intent: tool.schema.enum(["edit", "refactor", "delete", "add"] as const).optional().describe("Kind of change. Default: edit"),
          risk_tolerance: tool.schema.enum(["low", "medium", "high"] as const).optional().describe("Risk tolerance for verdict. Default: medium"),
        },
        async execute(args, ctx) {
          return ixDecide.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-health": tool({
        description: ixHealth.description,
        args: {},
        async execute(_args, ctx) {
          return ixHealth.execute({} as never, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),

      "ix-smells": tool({
        description: ixSmells.description,
        args: {
          path: tool.schema.string().optional().describe("Restrict smell detection to a directory path prefix"),
          limit: tool.schema.number().optional().describe("Max results. Default: 50, max: 200"),
        },
        async execute(args, ctx) {
          return ixSmells.execute(args, { directory: ctx.directory, worktree: ctx.worktree });
        },
      }),
    },

    // ─── Hooks ───────────────────────────────────────────────────────────────

    "tool.execute.after": async (input, output) => {
      // Post-edit ingest: async graph refresh after file writes
      if ((input.tool === "write" || input.tool === "edit") && typeof input.args?.file_path === "string") {
        if (isSourceFile(input.args.file_path)) {
          $`ix map --silent`.cwd(directory).quiet().catch(() => {});
        }
      }

      // Stale graph detection: append warning when ix tools return stale signals
      if (IX_GRAPH_TOOLS.includes(input.tool)) {
        const result = output.output ?? "";
        if (result.includes("stale") || result.includes("confidence < 0.7") || result.includes("run ix map")) {
          output.output = result + "\n\n> [ix] Graph data may be stale — run `ix map` to refresh.";
        }
      }
    },
  };
};
