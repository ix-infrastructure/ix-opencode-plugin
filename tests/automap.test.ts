// Copyright 2026 Ix Infrastructure Inc.

/**
 * The guarded automatic map (runtime/automap.ts) and the hook that requests it.
 *
 * Run with: bun test
 *
 * Every case runs in a CHILD process against a fake `ix` (tests/fake-ix.ts):
 * Bun resolves binaries from the real process PATH, so an in-process stub
 * would be ignored and the developer's real `ix` -- and real backend -- would
 * be mapped. The fake logs each call as `<cwd>|<IX_AUTO_MAP>|<argv>`, which is
 * what the assertions read.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { fakePath, writeFakeIx } from "./fake-ix.ts";

const AUTOMAP = path.resolve(import.meta.dir, "../runtime/automap.ts");
const PLUGIN = path.resolve(import.meta.dir, "../plugins/ix-plugin.ts");

const FAKE_BODY = `
case "$1" in
  status) echo "{\\"backend\\":\\"ok\\",\\"graphCompleted\\":\${FAKE_GRAPH_COMPLETED:-false}}" ;;
  map)    echo "mapped" ;;
  *)      echo '{}' ;;
esac`;

let scratch: string;
let bin: string;
let home: string;
let state: string;
let log: string;

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(path.join(tmpdir(), "ix-automap-")));
  bin = path.join(scratch, "bin");
  home = path.join(scratch, "home");
  state = path.join(scratch, "state");
  log = path.join(scratch, "calls.log");
  for (const d of [bin, home, state]) mkdirSync(d, { recursive: true });
  writeFakeIx(bin, FAKE_BODY);
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function gitRepo(name: string): string {
  const dir = path.join(scratch, name);
  mkdirSync(path.join(dir, "src"), { recursive: true });
  const init = Bun.spawnSync(["git", "init", "-q", dir]);
  expect(init.exitCode).toBe(0);
  return realpathSync(dir);
}

async function runChild(script: string, env: Record<string, string> = {}): Promise<string> {
  const runner = path.join(scratch, `runner-${Math.random().toString(36).slice(2)}.ts`);
  writeFileSync(runner, script);
  const proc = Bun.spawn([process.execPath, runner], {
    env: {
      ...process.env,
      PATH: fakePath(bin),
      HOME: home,
      XDG_STATE_HOME: state,
      IX_FAKE_LOG: log,
      FAKE_GRAPH_COMPLETED: "true",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
}

function requestIn(dir: string, env: Record<string, string> = {}): Promise<string> {
  return runChild(
    `const { requestAutoMap } = await import(${JSON.stringify(AUTOMAP)});\n` +
    `process.stdout.write(await requestAutoMap(${JSON.stringify(dir)}));\n`,
    env,
  );
}

function calls(): string[] {
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
}

function mapCalls(): string[] {
  return calls().filter((line) => line.split("|")[2]?.startsWith("map"));
}

/** The map is detached; give it a moment to land in the log. */
async function waitForMaps(count: number): Promise<string[]> {
  const deadline = Date.now() + 3000;
  while (mapCalls().length < count && Date.now() < deadline) await Bun.sleep(25);
  return mapCalls();
}

/** Long enough that a stray detached map would have shown up. */
async function settle(): Promise<void> {
  await Bun.sleep(300);
}

describe("AutoMapGuard", () => {
  test("a dir outside git maps nothing and asks ix nothing", async () => {
    const plain = path.join(scratch, "plain");
    mkdirSync(plain);

    expect(await requestIn(plain)).toBe("not-git");
    await settle();
    expect(calls()).toEqual([]);
  });

  test("a git root that is $HOME is never mapped", async () => {
    const repo = gitRepo("homerepo");

    expect(await requestIn(repo, { HOME: repo })).toBe("home");
    await settle();
    expect(mapCalls()).toEqual([]);
  });

  test("an unmapped root (graphCompleted false) is not mapped", async () => {
    const repo = gitRepo("fresh");

    expect(await requestIn(repo, { FAKE_GRAPH_COMPLETED: "false" })).toBe("not-mapped");
    await settle();
    expect(mapCalls()).toEqual([]);
    expect(calls()).toContain(`${repo}||status --format json --root ${repo}`);
  });

  test("a status that is not JSON counts as not mapped", async () => {
    const repo = gitRepo("garbled");
    writeFakeIx(bin, `[ "$1" = status ] && { echo "backend down"; exit 1; }; echo mapped`);

    expect(await requestIn(repo)).toBe("not-mapped");
    await settle();
    expect(mapCalls()).toEqual([]);
  });

  test("a mapped root gets exactly `ix map <root> --silent`, from the root, with IX_AUTO_MAP=1", async () => {
    const repo = gitRepo("mapped");

    // Asked from a subdirectory: the root is what gets mapped.
    expect(await requestIn(path.join(repo, "src"))).toBe("started");
    expect(await waitForMaps(1)).toEqual([`${repo}|1|map ${repo} --silent`]);
  });

  test("a second request inside the debounce window does not map again", async () => {
    const repo = gitRepo("debounced");

    expect(await requestIn(repo)).toBe("started");
    expect(await requestIn(repo)).toBe("debounced");
    await settle();
    expect(mapCalls()).toHaveLength(1);
  });

  test("the window expires", async () => {
    const repo = gitRepo("expired");

    expect(await requestIn(repo, { IX_MAP_DEBOUNCE_SECONDS: "0" })).toBe("started");
    expect(await requestIn(repo, { IX_MAP_DEBOUNCE_SECONDS: "0" })).toBe("started");
    expect(await waitForMaps(2)).toHaveLength(2);
  });

  test("two roots do not debounce each other", async () => {
    const a = gitRepo("alpha");
    const b = gitRepo("beta");

    expect(await requestIn(a)).toBe("started");
    expect(await requestIn(b)).toBe("started");
    const maps = await waitForMaps(2);
    expect(maps.sort()).toEqual([`${a}|1|map ${a} --silent`, `${b}|1|map ${b} --silent`].sort());
  });

  test("debounce stamps live in a private per-user dir", async () => {
    const repo = gitRepo("private");
    expect(await requestIn(repo)).toBe("started");

    const dir = path.join(state, "ix-opencode-plugin", "automap");
    const { statSync } = await import("node:fs");
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });
});

// ─── The plugin's hooks ──────────────────────────────────────────────────────

function hookIn(directory: string, calls: Array<{ tool: string; args: unknown }>): Promise<string> {
  return runChild(
    `const { server } = await import(${JSON.stringify(PLUGIN)});\n` +
    `const { settleAutoMaps } = await import(${JSON.stringify(AUTOMAP)});\n` +
    `const reg = await server({ directory: ${JSON.stringify(directory)}, worktree: ${JSON.stringify(directory)} });\n` +
    `for (const c of ${JSON.stringify(calls)}) {\n` +
    `  await reg["tool.execute.after"]({ tool: c.tool, sessionID: "s", callID: "c", args: c.args }, { title: "", output: "", metadata: {} });\n` +
    `}\n` +
    `await settleAutoMaps();\n`,
  );
}

describe("PostEditRefresh", () => {
  test("starting the plugin runs no ix command at all", async () => {
    const repo = gitRepo("startup");

    await hookIn(repo, []);
    await settle();
    expect(calls()).toEqual([]);
  });

  test("an OpenCode edit (filePath) requests the guarded root map", async () => {
    const repo = gitRepo("edited");

    await hookIn(repo, [{ tool: "edit", args: { filePath: path.join(repo, "src/a.ts") } }]);
    expect(await waitForMaps(1)).toEqual([`${repo}|1|map ${repo} --silent`]);
  });

  test("file_path is accepted too, and a burst of edits maps once", async () => {
    const repo = gitRepo("burst");

    await hookIn(repo, [
      { tool: "write", args: { file_path: path.join(repo, "src/a.ts") } },
      { tool: "edit", args: { filePath: path.join(repo, "src/b.ts") } },
      { tool: "edit", args: { filePath: path.join(repo, "src/c.ts") } },
    ]);
    await waitForMaps(1);
    await settle();
    expect(mapCalls()).toHaveLength(1);
  });

  test("non-edit tools and non-source paths request nothing", async () => {
    const repo = gitRepo("quiet");

    await hookIn(repo, [
      { tool: "read", args: { filePath: path.join(repo, "src/a.ts") } },
      { tool: "edit", args: { filePath: path.join(repo, "node_modules/x/index.js") } },
    ]);
    await settle();
    expect(calls()).toEqual([]);
  });
});
