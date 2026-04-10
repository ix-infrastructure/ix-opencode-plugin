/**
 * ix-plugin.ts — OpenCode plugin entry point
 *
 * Registers all Ix tools and hooks with the OpenCode runtime.
 *
 * Tools registered:
 *   ix-query       — graph entity lookup
 *   ix-neighbors   — neighborhood traversal (callers, callees, depends)
 *   ix-impact      — blast radius analysis
 *   ix-map         — architectural map and subsystem overview
 *   ix-ingest      — graph ingest status and trigger
 *   ix-history     — revision, decisions, bugs (Ix Pro)
 *   ix-docs-tool   — condensed context summary for injection
 *
 * Hooks registered:
 *   tool.execute.before (write/edit)  — ix-pre-edit: impact check before file edits
 *   tool.execute.before (read)        — ix-read: inject graph context hint before reads
 *   tool.execute.before (bash)        — ix-intercept: front-run grep/rg with ix text
 *   tool.execute.after  (write/edit)  — ix-ingest: async graph refresh after edits
 *   tool.execute.after  (any)         — ix-errors: handle stale graph errors gracefully
 */

import type { Plugin, ToolContext, HookEvent } from "@opencode-ai/sdk";
import { $ } from "bun";

// ─── Tool imports ────────────────────────────────────────────────────────────

import * as ixQuery from "../tools/ix-query";
import * as ixNeighbors from "../tools/ix-neighbors";
import * as ixImpact from "../tools/ix-impact";
import * as ixMap from "../tools/ix-map";
import * as ixIngest from "../tools/ix-ingest";
import * as ixHistory from "../tools/ix-history";
import * as ixDocsTool from "../tools/ix-docs-tool";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isIxAvailable(dir: string): Promise<boolean> {
  try {
    await $`command -v ix`.cwd(dir).quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file path looks like source code (not generated, not lock files).
 */
function isSourceFile(path: string): boolean {
  const skip = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".opencode/ix-cache",
    "package-lock.json",
    "yarn.lock",
    "bun.lock",
  ];
  return !skip.some((s) => path.includes(s));
}

/**
 * Detect grep/rg patterns in a bash command string.
 */
function isGrepCommand(cmd: string): boolean {
  return /\b(grep|rg)\b/.test(cmd);
}

/**
 * Extract the search pattern from a grep/rg command string (best effort).
 */
function extractGrepPattern(cmd: string): string | null {
  // Match: grep "pattern" or rg 'pattern' or grep pattern
  const m = cmd.match(/\b(?:grep|rg)\b\s+(?:-[^\s]+\s+)*['"]?([^'"]+?)['"]?\s/);
  return m ? m[1].trim() : null;
}

// ─── Plugin definition ───────────────────────────────────────────────────────

const plugin: Plugin = {
  name: "ix-memory",
  version: "1.0.0",
  description:
    "Graph-first reasoning layer for OpenCode. Provides Ix Memory tools for architectural navigation, impact analysis, and safe change planning.",

  // ─── Tools ───────────────────────────────────────────────────────────────

  tools: [
    {
      name: ixQuery.name,
      description: ixQuery.description,
      parameters: ixQuery.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixQuery.execute(params as Parameters<typeof ixQuery.execute>[0], ctx),
    },
    {
      name: ixNeighbors.name,
      description: ixNeighbors.description,
      parameters: ixNeighbors.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixNeighbors.execute(params as Parameters<typeof ixNeighbors.execute>[0], ctx),
    },
    {
      name: ixImpact.name,
      description: ixImpact.description,
      parameters: ixImpact.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixImpact.execute(params as Parameters<typeof ixImpact.execute>[0], ctx),
    },
    {
      name: ixMap.name,
      description: ixMap.description,
      parameters: ixMap.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixMap.execute(params as Parameters<typeof ixMap.execute>[0], ctx),
    },
    {
      name: ixIngest.name,
      description: ixIngest.description,
      parameters: ixIngest.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixIngest.execute(params as Parameters<typeof ixIngest.execute>[0], ctx),
    },
    {
      name: ixHistory.name,
      description: ixHistory.description,
      parameters: ixHistory.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixHistory.execute(params as Parameters<typeof ixHistory.execute>[0], ctx),
    },
    {
      name: ixDocsTool.name,
      description: ixDocsTool.description,
      parameters: ixDocsTool.parameters,
      execute: async (params: Record<string, unknown>, ctx: ToolContext) =>
        ixDocsTool.execute(params as Parameters<typeof ixDocsTool.execute>[0], ctx),
    },
  ],

  // ─── Hooks ───────────────────────────────────────────────────────────────

  hooks: [
    /**
     * ix-pre-edit: Before write/edit — run impact check on the target file.
     * Injects a risk summary so the agent can reconsider high-impact changes.
     * Allows the edit to proceed regardless (advisory, not blocking).
     */
    {
      event: "tool.execute.before",
      match: { tool: ["write", "edit"] },
      handler: async (event: HookEvent) => {
        const dir = event.context?.directory;
        if (!dir) return { action: "allow" };

        const filePath =
          (event.params?.file_path as string) ??
          (event.params?.path as string);
        if (!filePath || !isSourceFile(filePath)) return { action: "allow" };

        if (!(await isIxAvailable(dir))) return { action: "allow" };

        try {
          const impactOut = await $`ix impact ${filePath} --format json`
            .cwd(dir)
            .quiet()
            .text();
          const impact = JSON.parse(impactOut);
          const risk = (impact.risk ?? "unknown").toLowerCase();

          // Only inject context for medium/high/critical — don't slow down low-risk edits
          if (risk === "low" || risk === "unknown") return { action: "allow" };

          const dependents = impact.dependentCount ?? 0;
          const note = [
            `[ix-pre-edit] **${risk.toUpperCase()} risk edit detected.**`,
            `File: \`${filePath}\` — ${dependents} direct dependent(s).`,
            risk === "critical" || risk === "high"
              ? "Consider running `/ix-plan` before proceeding."
              : "Review callers after this change.",
          ].join(" ");

          return {
            action: "allow",
            context: note,
          };
        } catch {
          // Impact check failed — allow edit without annotation
          return { action: "allow" };
        }
      },
    },

    /**
     * ix-read: Before read tool — inject a graph context hint.
     * Encourages using ix-query or ix-map before broad file reads.
     * Only fires for source files, not config/data files.
     */
    {
      event: "tool.execute.before",
      match: { tool: ["read"] },
      handler: async (event: HookEvent) => {
        const dir = event.context?.directory;
        if (!dir) return { action: "allow" };

        const filePath =
          (event.params?.file_path as string) ??
          (event.params?.path as string);
        if (!filePath || !isSourceFile(filePath)) return { action: "allow" };

        if (!(await isIxAvailable(dir))) return { action: "allow" };

        // Only hint if no offset/limit requested (broad reads, not targeted)
        const offset = event.params?.offset;
        const limit = event.params?.limit;
        if (offset !== undefined || limit !== undefined) return { action: "allow" };

        const hint = [
          `[ix-read] Before reading \`${filePath}\` in full:`,
          "Consider using **ix-query** or **ix-map** to get graph context first.",
          `Try: ix overview ${filePath} --format json`,
        ].join(" ");

        return {
          action: "allow",
          context: hint,
        };
      },
    },

    /**
     * ix-intercept: Before bash — front-run grep/rg commands with ix text.
     * If the bash command looks like a search, inject an ix text suggestion.
     */
    {
      event: "tool.execute.before",
      match: { tool: ["bash"] },
      handler: async (event: HookEvent) => {
        const dir = event.context?.directory;
        if (!dir) return { action: "allow" };

        const cmd = (event.params?.command as string) ?? "";
        if (!isGrepCommand(cmd)) return { action: "allow" };

        if (!(await isIxAvailable(dir))) return { action: "allow" };

        const pattern = extractGrepPattern(cmd);
        if (!pattern) return { action: "allow" };

        const hint = [
          `[ix-intercept] Graph search available: \`ix text "${pattern}" --limit 20 --format json\``,
          "This is faster and graph-aware. Use bash grep only if ix text returns no results.",
        ].join(" ");

        return {
          action: "allow",
          context: hint,
        };
      },
    },

    /**
     * ix-ingest: After write/edit — async graph refresh.
     * Runs `ix map --silent` in the background after file changes.
     * Non-blocking: fires and forgets.
     */
    {
      event: "tool.execute.after",
      match: { tool: ["write", "edit"] },
      handler: async (event: HookEvent) => {
        const dir = event.context?.directory;
        if (!dir) return;

        const filePath =
          (event.params?.file_path as string) ??
          (event.params?.path as string);
        if (!filePath || !isSourceFile(filePath)) return;

        if (!(await isIxAvailable(dir))) return;

        // Fire and forget — don't await, don't block the agent
        $`ix map --silent`.cwd(dir).quiet().catch(() => {
          // Silently ignore map failures
        });
      },
    },

    /**
     * ix-errors: After any tool — handle stale graph errors gracefully.
     * If an ix tool returns a staleness warning, suggest `ix map`.
     */
    {
      event: "tool.execute.after",
      match: { tool: ["ix-query", "ix-neighbors", "ix-impact", "ix-map", "ix-docs-tool"] },
      handler: async (event: HookEvent) => {
        const result = event.result as string | undefined;
        if (!result) return;

        const isStale =
          result.includes("stale") ||
          result.includes("confidence < 0.7") ||
          result.includes("run ix map");

        if (isStale) {
          return {
            context:
              "[ix-errors] Graph data may be stale. Run `ix map` to refresh, then retry.",
          };
        }
      },
    },
  ],

  /**
   * Plugin initialization — check ix availability and ensure graph is present.
   * Called once when the plugin loads.
   */
  async onInit(ctx: { directory: string }) {
    const dir = ctx.directory;

    const available = await isIxAvailable(dir);
    if (!available) {
      // ix not installed — plugin loads but tools will return helpful messages
      return;
    }

    // Check if graph needs initialization (async, non-blocking)
    try {
      const subsystems = await $`ix subsystems --list --format json`
        .cwd(dir)
        .quiet()
        .text();
      const parsed = JSON.parse(subsystems);
      const names: string[] = parsed.names ?? parsed.list ?? [];

      if (names.length === 0) {
        // Graph empty — trigger initial ingest in background
        $`ix map --silent`.cwd(dir).quiet().catch(() => {});
      }
    } catch {
      // Can't check — proceed silently
    }
  },
};

export default plugin;
