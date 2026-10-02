// Copyright 2026 Ix Infrastructure Inc.

/**
 * Path decisions in runtime/paths.ts: which edits refresh the graph, and which
 * directory a tool runs `ix` in.
 */

import { describe, expect, test } from "bun:test";

import { isSourceFile, toolCwd } from "../runtime/paths.ts";

describe("isSourceFile matches path segments, not substrings", () => {
  const source = [
    "src/builder/index.ts",
    "builder.ts",
    "lib/distance.ts",
    "tools/rebuild.ts",
    "src/gitignore-parser.ts",
    "packages/node_modules_helper/x.ts",
    "C:\\repo\\src\\builder\\Main.cs",
    "/home/u/repo/build.gradle.kts",
    "docs/build",
  ];
  const notSource = [
    "build/out.js",
    "dist/index.js",
    "packages/a/node_modules/x/index.js",
    "/home/u/repo/.git/config",
    ".opencode/ix-cache/state.json",
    "bun.lock",
    "frontend/package-lock.json",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "C:\\repo\\dist\\bundle.js",
    "",
  ];
  for (const p of source) test(`source: ${JSON.stringify(p)}`, () => expect(isSourceFile(p)).toBe(true));
  for (const p of notSource) test(`skipped: ${JSON.stringify(p)}`, () => expect(isSourceFile(p)).toBe(false));
});

describe("toolCwd", () => {
  test("directory, even when the worktree is / (OpenCode outside git)", () => {
    expect(toolCwd({ directory: "/home/u/notes", worktree: "/" })).toBe("/home/u/notes");
  });

  test("directory over a real worktree", () => {
    expect(toolCwd({ directory: "/home/u/repo/pkg", worktree: "/home/u/repo" })).toBe("/home/u/repo/pkg");
  });

  test("worktree only as a fallback, and never a filesystem root", () => {
    expect(toolCwd({ directory: "", worktree: "/home/u/repo" })).toBe("/home/u/repo");
    expect(toolCwd({ directory: "", worktree: "/" })).toBe(process.cwd());
  });
});
