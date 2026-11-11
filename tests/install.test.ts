// Copyright 2026 Ix Infrastructure Inc.

/**
 * install.sh, run for real in a temp HOME / temp project, and install.ps1's
 * file list checked against install.sh's.
 *
 * The installer runs against a copy of this repo (no .git, so it never fetches
 * or resets anything), with stub `opencode`, `ix` and `bun` first on PATH.
 * Each install mode must leave a plugin entry point whose every relative
 * import exists at the installed location, and that Bun can import. The
 * installer may create, replace and delete only its own files: the ones its
 * manifest lists.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  rmSync, symlinkSync, writeFileSync,
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

function runInstaller(home: string, args: string[], cwd = home) {
  const r = spawnSync("bash", [path.join(SOURCE, "install.sh"), "--source", SOURCE, ...args], {
    cwd,
    env: { ...process.env, HOME: home, PATH: `${STUBS}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function install(home: string, args: string[], cwd = home) {
  const { status, out } = runInstaller(home, args, cwd);
  if (status !== 0) throw new Error(`install.sh ${args.join(" ")} exited ${status}:\n${out}`);
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
    expect(cfg.instructions).toEqual(["./ix-opencode-plugin/AGENTS.md"]);
    expect(existsSync(path.join(config, "commands/ix-debug.md"))).toBe(true);
    // File by file: the directory OpenCode reads commands from is a real one.
    expect(lstatSync(path.join(config, "commands")).isSymbolicLink()).toBe(false);
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
    symlinkSync(path.join(SOURCE, "commands"), path.join(config, "commands"));
    symlinkSync(path.join(SOURCE, "agents"), path.join(config, "agents"));
    symlinkSync(path.join(SOURCE, "AGENTS.md"), path.join(config, "AGENTS.md"));
    writeFileSync(
      path.join(config, "opencode.json"),
      JSON.stringify({ plugin: ["./plugins/ix-plugin.ts", "other-plugin"], instructions: ["./AGENTS.md"] }),
    );
    install(home, []);
    for (const old of ["plugins", "runtime", "AGENTS.md"]) {
      expect(existsSync(path.join(config, old))).toBe(false);
    }
    expect(lstatSync(path.join(config, "commands")).isSymbolicLink()).toBe(false);
    const cfg = readJson(path.join(config, "opencode.json"));
    expect(cfg.plugin).toEqual(["other-plugin", `./${ENTRY}`]);
    expect(cfg.instructions).toEqual(["./ix-opencode-plugin/AGENTS.md"]);
    expectLoadable(config);
  });

  test("re-running the install changes nothing and needs no --force", () => {
    const home = freshDir("home");
    install(home, []);
    const out = install(home, []);
    expect(out).toContain("(0 written, 0 replaced)");
  });
});

/** Every file under `dir`, relative, "/"-separated, sorted. */
function listFiles(dir: string): string[] {
  const r = spawnSync("find", [".", "(", "-type", "f", "-o", "-type", "l", ")"], { cwd: dir, encoding: "utf8" });
  return r.stdout.split("\n").filter(Boolean).map((p) => p.replace(/^\.\//, "")).sort();
}

/** The user's own files, in the directories the plugin also writes to. */
const USER_FILES: Record<string, string> = {
  "commands/my-command.md": "my command\n",
  "agents/my-agent.json": "{}\n",
  "plugins/my-plugin.ts": "export {};\n",
  "tools/my-tool.ts": "export {};\n",
  "AGENTS.md": "my rules\n",
  "package.json": "{}\n",
};

function seedUserFiles(dir: string) {
  for (const [rel, body] of Object.entries(USER_FILES)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
}

function expectUserFilesIntact(dir: string) {
  for (const [rel, body] of Object.entries(USER_FILES)) {
    expect(readFileSync(path.join(dir, rel), "utf8")).toBe(body);
  }
}

const MANIFEST = "ix-opencode-plugin/install-manifest.txt";

function manifestPaths(dir: string): string[] {
  return readFileSync(path.join(dir, MANIFEST), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
}

for (const mode of ["global", "project"] as const) {
  describe.skipIf(process.platform === "win32")(`install.sh ${mode}: only the plugin's own files`, () => {
    const setup = () => {
      const home = freshDir("home");
      const project = freshDir("project");
      const dir = mode === "global" ? path.join(home, ".config/opencode") : path.join(project, ".opencode");
      const args = mode === "global" ? [] : ["--project", project];
      const configFile = mode === "global" ? path.join(dir, "opencode.json") : path.join(project, "opencode.json");
      mkdirSync(dir, { recursive: true });
      seedUserFiles(dir);
      writeFileSync(configFile, JSON.stringify({ plugin: ["other-plugin"], model: "x/y" }));
      return { home, dir, args, configFile };
    };

    test("install, --force and --uninstall keep the user's files", () => {
      const { home, dir, args, configFile } = setup();
      install(home, args);
      expectUserFilesIntact(dir);
      expectLoadable(dir);

      install(home, [...args, "--force"]);
      expectUserFilesIntact(dir);

      install(home, [...args, "--uninstall"]);
      expectUserFilesIntact(dir);
      // Nothing of the plugin's is left: only the user's files remain.
      const leftovers = listFiles(dir).filter((f) => !/^node_modules(\/|$)/.test(f) && f !== "opencode.json");
      expect(leftovers).toEqual(Object.keys(USER_FILES).sort());
      expect(existsSync(path.join(dir, "ix-opencode-plugin"))).toBe(false);
      const cfg = readJson(configFile);
      expect(cfg.plugin).toEqual(["other-plugin"]);
      expect(cfg.instructions).toEqual([]);
      expect(cfg.model).toBe("x/y");
    });

    test("the manifest lists every file the install wrote", () => {
      const { home, dir, args } = setup();
      install(home, args);
      const listed = manifestPaths(dir).filter((p) => !p.endsWith("/"));
      const userOrDeps = (f: string) =>
        f in USER_FILES || /^node_modules(\/|$)/.test(f) || f === MANIFEST || f === "opencode.json";
      expect(listFiles(dir).filter((f) => !userOrDeps(f))).toEqual([...listed].sort());
      // Directories it created are listed; ones the user already had are not.
      expect(manifestPaths(dir)).toContain("ix-opencode-plugin/");
      expect(manifestPaths(dir)).not.toContain("commands/");
    });

    test("a user's file with a plugin file's name stops the install; --force replaces only it", () => {
      const { home, dir, args } = setup();
      writeFileSync(path.join(dir, "commands/ix-debug.md"), "my own ix-debug\n");

      const { status, out } = runInstaller(home, args);
      expect(status).not.toBe(0);
      expect(out).toContain("commands/ix-debug.md");
      expect(readFileSync(path.join(dir, "commands/ix-debug.md"), "utf8")).toBe("my own ix-debug\n");
      expect(existsSync(path.join(dir, "ix-opencode-plugin"))).toBe(false);
      expect(existsSync(path.join(dir, "commands/ix-plan.md"))).toBe(false);

      install(home, [...args, "--force"]);
      expect(readFileSync(path.join(dir, "commands/ix-debug.md"), "utf8"))
        .toBe(readFileSync(path.join(SOURCE, "commands/ix-debug.md"), "utf8"));
      expectUserFilesIntact(dir);
    });

    test("a re-install removes files the plugin no longer ships, and only those", () => {
      const { home, dir, args } = setup();
      install(home, args);
      writeFileSync(path.join(dir, "commands/ix-retired.md"), "old\n");
      writeFileSync(path.join(dir, MANIFEST), `${readFileSync(path.join(dir, MANIFEST), "utf8")}commands/ix-retired.md\n`);
      install(home, args);
      expect(existsSync(path.join(dir, "commands/ix-retired.md"))).toBe(false);
      expectUserFilesIntact(dir);
    });

    test("a directory where the plugin installs a file is never removed", () => {
      const { home, dir, args } = setup();
      mkdirSync(path.join(dir, "commands/ix-debug.md"), { recursive: true });
      writeFileSync(path.join(dir, "commands/ix-debug.md/keep.txt"), "keep\n");
      const { status } = runInstaller(home, [...args, "--force"]);
      expect(status).not.toBe(0);
      expect(readFileSync(path.join(dir, "commands/ix-debug.md/keep.txt"), "utf8")).toBe("keep\n");
    });
  });
}

test.skipIf(process.platform === "win32")("--uninstall without a manifest removes nothing", () => {
  const home = freshDir("home");
  const project = freshDir("project");
  const dir = path.join(project, ".opencode");
  mkdirSync(dir, { recursive: true });
  seedUserFiles(dir);
  install(home, ["--project", project, "--uninstall"]);
  expect(listFiles(dir)).toEqual(Object.keys(USER_FILES).sort());
});

test("neither installer removes a directory tree", () => {
  const sh = readFileSync(path.join(REPO, "install.sh"), "utf8");
  const ps = readFileSync(path.join(REPO, "install.ps1"), "utf8");
  expect(/\brm\s+(-\w*r|-\w*R|--recursive)/.test(sh)).toBe(false);
  expect(/Remove-Item[^\n]*-Recurse/.test(ps)).toBe(false);
});
