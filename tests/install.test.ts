// Copyright 2026 Ix Infrastructure Inc.

/**
 * install.sh, run for real in a temp HOME / temp project, and install.ps1's
 * file list checked against install.sh's.
 *
 * The installer runs against a copy of this repo (no .git, so it never fetches
 * or resets anything), with stub `opencode`, `ix` and `bun` first on PATH.
 * Each install mode must leave a plugin entry point whose every relative
 * import exists at the installed location, and that Bun can import.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dir, "..");
const scratch = mkdtempSync(path.join(tmpdir(), "ix-opencode-install-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
function freshDir(name: string): string {
  const dir = path.join(scratch, `${name}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** `INSTALL_ITEMS` from a script: the quoted "src:dest" lines of its list. */
function installItems(script: string, open: RegExp): string[] {
  const text = readFileSync(path.join(REPO, script), "utf8");
  const start = text.search(open);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = text.slice(start, text.indexOf(")", start));
  return [...body.matchAll(/"([^":\s]+:[^"\s]+)"/g)].map((m) => m[1]!);
}

const SH_ITEMS = installItems("install.sh", /^INSTALL_ITEMS=\(/m);
const PS_ITEMS = installItems("install.ps1", /^\$INSTALL_ITEMS = @\(/m);
const ENTRY = "ix-opencode-plugin/plugins/ix-plugin.ts";

/** A copy of the repo to install from, minus .git and node_modules. */
const SOURCE = (() => {
  const src = freshDir("source");
  cpSync(REPO, src, {
    recursive: true,
    filter: (p) => !/(^|[\\/])(\.git|node_modules)$/.test(p),
  });
  // Stands in for the installer's `bun install` in the clone (stubbed below):
  // a global install links into the clone, so the entry resolves its
  // dependencies from there.
  symlinkSync(path.join(REPO, "node_modules"), path.join(src, "node_modules"), "dir");
  return src;
})();

/** Stub opencode / ix / bun: the prerequisite checks pass, `bun install` is a no-op. */
const STUBS = (() => {
  const bin = freshDir("bin");
  for (const name of ["opencode", "ix", "bun"]) {
    writeFileSync(path.join(bin, name), "#!/bin/sh\nexit 0\n");
    chmodSync(path.join(bin, name), 0o755);
  }
  return bin;
})();

function install(home: string, args: string[], cwd = home) {
  const r = spawnSync("bash", [path.join(SOURCE, "install.sh"), "--source", SOURCE, ...args], {
    cwd,
    env: { ...process.env, HOME: home, PATH: `${STUBS}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  const out = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`install.sh ${args.join(" ")} exited ${r.status}:\n${out}`);
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

/** Every module reachable from `entry` by relative imports; throws on a missing one. */
function relativeImports(entry: string): string[] {
  const seen = new Set<string>();
  const missing: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2]!;
      if (!spec.startsWith(".")) continue;
      const base = path.resolve(path.dirname(file), spec);
      const target = [base, `${base}.ts`].find((p) => existsSync(p) && !lstatSync(p).isDirectory());
      if (target) visit(target);
      else missing.push(`${path.relative(path.dirname(entry), base)} (imported by ${path.basename(file)})`);
    }
  };
  visit(entry);
  if (missing.length) throw new Error(`missing modules:\n  ${missing.join("\n  ")}`);
  return [...seen];
}

/**
 * Import the installed entry with Bun. OpenCode installs @opencode-ai/plugin
 * into the OpenCode directory's node_modules when it starts, which is what a
 * --project copy resolves it from; this links the repo's own copy there to
 * stand in for that.
 */
function importEntry(opencodeDir: string) {
  const nm = path.join(opencodeDir, "node_modules");
  if (!existsSync(nm)) symlinkSync(path.join(REPO, "node_modules"), nm, "dir");
  const entry = path.join(opencodeDir, ENTRY);
  const r = spawnSync(
    process.execPath,
    ["-e", `const m = await import(${JSON.stringify(entry)}); if (typeof m.server !== "function") throw new Error("no server export");`],
    { cwd: scratch, encoding: "utf8" },
  );
  expect(`${r.status} ${r.stderr}`).toBe("0 ");
}

function expectLoadable(opencodeDir: string) {
  const entry = path.join(opencodeDir, ENTRY);
  expect(existsSync(entry)).toBe(true);
  const modules = relativeImports(entry);
  // The entry, its 17 tools, and the runtime modules they share.
  expect(modules.length).toBeGreaterThan(20);
  importEntry(opencodeDir);
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("install file list", () => {
  test("install.ps1 installs exactly what install.sh installs", () => {
    expect(SH_ITEMS.length).toBeGreaterThan(0);
    expect(PS_ITEMS).toEqual(SH_ITEMS);
  });

  test("neither script keeps a second, hard-coded list", () => {
    for (const script of ["install.sh", "install.ps1"]) {
      const text = readFileSync(path.join(REPO, script), "utf8");
      // The lists each script carried before INSTALL_ITEMS.
      expect(/plugins commands agents runtime|"plugins", "commands"/.test(text)).toBe(false);
    }
  });

  test("the list covers every module the entry point imports", () => {
    const sources = SH_ITEMS.map((i) => i.split(":")[0]!);
    for (const mod of relativeImports(path.join(REPO, "plugins/ix-plugin.ts"))) {
      const rel = path.relative(REPO, mod);
      expect(sources.some((s) => rel === s || rel.startsWith(`${s}/`))).toBe(true);
    }
  });
});

describe.skipIf(process.platform === "win32")("install.sh", () => {
  test("global install leaves a loadable plugin and registers it", () => {
    const home = freshDir("home");
    install(home, []);
    const config = path.join(home, ".config/opencode");
    expectLoadable(config);
    const cfg = readJson(path.join(config, "opencode.json"));
    expect(cfg.plugin).toEqual([`./${ENTRY}`]);
    expect(existsSync(path.join(config, "commands/ix-debug.md"))).toBe(true);
  });

  test("--project leaves a loadable plugin and registers it", () => {
    const home = freshDir("home");
    const project = freshDir("project");
    install(home, ["--project", project]);
    const dot = path.join(project, ".opencode");
    expectLoadable(dot);
    const cfg = readJson(path.join(project, "opencode.json"));
    expect(cfg.plugin).toEqual([`.opencode/${ENTRY}`]);
    // Nothing lands where OpenCode would load it as a standalone tool or plugin.
    expect(existsSync(path.join(dot, "tools"))).toBe(false);
    expect(existsSync(path.join(dot, "plugins"))).toBe(false);
  });

  test("--project from inside the project (no dir argument)", () => {
    const home = freshDir("home");
    const project = freshDir("project");
    install(home, ["--project"], project);
    expectLoadable(path.join(project, ".opencode"));
  });

  test("global re-install drops the old whole-directory links and their opencode.json entry", () => {
    const home = freshDir("home");
    const config = path.join(home, ".config/opencode");
    mkdirSync(config, { recursive: true });
    symlinkSync(path.join(SOURCE, "plugins"), path.join(config, "plugins"));
    symlinkSync(path.join(SOURCE, "runtime"), path.join(config, "runtime"));
    writeFileSync(
      path.join(config, "opencode.json"),
      JSON.stringify({ plugin: ["./plugins/ix-plugin.ts", "other-plugin"], instructions: ["./AGENTS.md"] }),
    );
    install(home, []);
    expect(existsSync(path.join(config, "plugins"))).toBe(false);
    expect(existsSync(path.join(config, "runtime"))).toBe(false);
    expect(readJson(path.join(config, "opencode.json")).plugin).toEqual(["other-plugin", `./${ENTRY}`]);
    expectLoadable(config);
  });

  test("global uninstall removes the links it made", () => {
    const home = freshDir("home");
    install(home, []);
    install(home, ["--uninstall"]);
    const config = path.join(home, ".config/opencode");
    expect(existsSync(path.join(config, "ix-opencode-plugin"))).toBe(false);
    for (const item of SH_ITEMS) {
      const dest = path.join(config, item.split(":")[1]!);
      expect(() => readlinkSync(dest)).toThrow();
    }
  });
});
