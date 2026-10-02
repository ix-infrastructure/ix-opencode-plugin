// Copyright 2026 Ix Infrastructure Inc.

/**
 * Path decisions shared by the plugin entry point and the tools.
 *
 * Kept out of plugins/ix-plugin.ts on purpose: OpenCode treats every function
 * a plugin module exports as a plugin, so helpers there cannot be exported for
 * tests.
 */

import path from "node:path";

/** What OpenCode hands a tool: the session directory and the git worktree. */
export type ToolContext = { directory: string; worktree?: string };

function isFilesystemRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  return resolved === path.parse(resolved).root;
}

/**
 * The directory a tool runs `ix` in.
 *
 * OpenCode's `worktree` is the git root, and `/` for a project outside git;
 * the tools used `worktree ?? directory`, so outside git every `ix` call ran in
 * `/`, which no workspace covers. `directory` is where the session was opened,
 * and Ix resolves the workspace from there (a subdirectory of a mapped root
 * resolves to that root), so it is the right cwd in and outside git.
 * `worktree` is the fallback only when `directory` is missing and the worktree
 * is a real directory rather than a filesystem root.
 */
export function toolCwd(context: ToolContext): string {
  if (context.directory) return context.directory;
  if (context.worktree && !isFilesystemRoot(context.worktree)) return context.worktree;
  return process.cwd();
}

/** Directory names whose contents are never project source. */
const SKIP_SEGMENTS = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * Lockfiles: written by package managers, never part of the code graph. Any
 * `*.lock` / `*.lockb` (Cargo.lock, Gemfile.lock, poetry.lock) counts too.
 */
const SKIP_BASENAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
]);

/**
 * True when an edit to `filePath` should refresh the graph.
 *
 * Matches whole path segments, not substrings: `src/builder/index.ts`,
 * `distance.ts` and `rebuild.ts` are source; `build/out.js`,
 * `packages/a/node_modules/x/index.js` and `.opencode/ix-cache/...` are not.
 */
export function isSourceFile(filePath: string): boolean {
  const segments = filePath.split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0) return false;
  const base = segments[segments.length - 1]!;
  if (SKIP_BASENAMES.has(base) || /\.lockb?$/.test(base)) return false;
  // Directories only: a file that happens to be called `build` is still a file.
  if (segments.slice(0, -1).some((s) => SKIP_SEGMENTS.has(s))) return false;
  for (let i = 0; i + 1 < segments.length; i++) {
    if (segments[i] === ".opencode" && segments[i + 1] === "ix-cache") return false;
  }
  return true;
}
