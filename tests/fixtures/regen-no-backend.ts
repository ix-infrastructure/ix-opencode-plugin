// Copyright 2026 Ix Infrastructure Inc.

/**
 * Regenerate the ix v0.12.0 fixtures that need no backend.
 *
 *   bun tests/fixtures/regen-no-backend.ts
 *
 * Runs the real `ix` first on PATH (it must report 0.12.0) and writes its
 * stdout into tests/fixtures/ix-v0.12.0, with the command and exit code in
 * manifest.json. CI (the `real-ix` job) runs this against the released v0.12.0
 * tarball and then `git diff --exit-code`s the fixtures, so these files are
 * what the CLI really prints, not what someone remembered it printing.
 *
 * ## What this generates
 *
 *   unmapped/*    every graph read from a directory no workspace covers:
 *                 `workspace_not_mapped` error records (Ix#733), both formats.
 *                 Ix decides this from IX_HOME alone, before any network call.
 *   no-backend/*  `ix --version`, `ix status` with the backend unreachable,
 *                 and `ix text` (ripgrep, no graph) on a tiny fixed repo.
 *
 * ## What this cannot generate
 *
 * Anything that needs a backend holding a graph, or an empty one, stays
 * hand-captured and is left untouched here: `success/`, `empty-repo/`,
 * `empty-graph/` (a registered workspace's reads go to the backend) and the
 * hand-written `synthetic/`. See tests/fixtures/ix-v0.12.0/README.md.
 *
 * ## Determinism
 *
 * Error records embed the absolute working directory, so the cases run from
 * fixed paths under /tmp/ix-fixtures-v0.12.0 (wiped and recreated each run).
 * IX_ENDPOINT is http://127.0.0.1:1 -- a port fetch refuses outright ("bad
 * port"), so nothing is contacted and the failure text is the same on every
 * machine. IX_HOME is a fresh temp dir, so no workspace is registered. Never
 * point this at a real backend.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EXPECTED_VERSION = "0.12.0";
const FIXTURES = path.resolve(import.meta.dir, "ix-v0.12.0");
const MANIFEST = path.join(FIXTURES, "manifest.json");
const SCRATCH = "/tmp/ix-fixtures-v0.12.0";
const UNMAPPED_DIR = path.join(SCRATCH, "unmapped");
const TEXT_REPO = path.join(SCRATCH, "text-repo");
const GENERATED_BY = "tests/fixtures/regen-no-backend.ts";

type Case = { file: string; cwd: string; args: string[]; note?: string };

const ixHome = mkdtempSync(path.join(tmpdir(), "ix-fixtures-home-"));
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  IX_ENDPOINT: "http://127.0.0.1:1",
  IX_HOME: ixHome,
  IX_NO_UPDATE_CHECK: "1",
  NO_COLOR: "1",
};

function ix(args: string[], cwd: string): { stdout: string; exit: number } {
  const proc = Bun.spawnSync(["ix", ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
  return { stdout: proc.stdout.toString(), exit: proc.exitCode ?? -1 };
}

/** Both formats of one command, as `<base>.json` and `<base>.txt`. */
function pair(base: string, cwd: string, args: string[], note?: string): Case[] {
  return [
    { file: `${base}.json`, cwd, args: [...args, "--format", "json"], note },
    { file: `${base}.txt`, cwd, args: [...args, "--format", "llm"], note },
  ];
}

// ── Scratch directories ───────────────────────────────────────────────────

rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(UNMAPPED_DIR, { recursive: true });
mkdirSync(path.join(TEXT_REPO, "src"), { recursive: true });
// Every `greet` hit is in one file on purpose: `ix text` gives every ripgrep
// hit the same score and keeps ripgrep's (parallel, so unstable) file order,
// so hits spread over two files come back in either order run to run.
// Within one file the order is by line. other.ts is there to be filtered out.
writeFileSync(
  path.join(TEXT_REPO, "src", "main.ts"),
  'export function greet(name: string): string {\n  return `hello ${name}`;\n}\n\nconsole.log(greet("world"));\n',
);
writeFileSync(path.join(TEXT_REPO, "src", "other.ts"), "export const farewell = 'bye';\n");

// ── Cases ─────────────────────────────────────────────────────────────────

const cases: Case[] = [
  // The commands and arguments of the original hand capture, unchanged.
  ...pair("unmapped/impact", UNMAPPED_DIR, ["impact", "Foo"]),
  ...pair("unmapped/callers", UNMAPPED_DIR, ["callers", "Foo"]),
  ...pair("unmapped/trace", UNMAPPED_DIR, ["trace", "Foo"]),
  ...pair("unmapped/explain", UNMAPPED_DIR, ["explain", "Foo"]),
  ...pair("unmapped/locate", UNMAPPED_DIR, ["locate", "Foo"]),
  ...pair("unmapped/smells-list", UNMAPPED_DIR, ["smells", "--list"]),
  ...pair("unmapped/stats", UNMAPPED_DIR, ["stats"]),
  ...pair("unmapped/subsystems", UNMAPPED_DIR, ["subsystems"]),
  ...pair("unmapped/rank", UNMAPPED_DIR, ["rank", "--by", "dependents", "--kind", "class", "--top", "5"]),
  ...pair("unmapped/inventory", UNMAPPED_DIR, ["inventory", "--kind", "file", "--path", "src/"]),

  { file: "no-backend/version.txt", cwd: UNMAPPED_DIR, args: ["--version"] },
  {
    file: "no-backend/version.json",
    cwd: UNMAPPED_DIR,
    args: ["--version", "--format", "json"],
    note: "--version ignores --format: plain text, not JSON",
  },
  ...pair(
    "no-backend/status",
    UNMAPPED_DIR,
    ["status"],
    "backend unreachable; --format json prints nothing on stdout (the error goes to stderr), llm prints an error record",
  ),
  ...pair("no-backend/text", TEXT_REPO, ["text", "greet", "--limit", "5"]),
  ...pair("no-backend/text-scoped", TEXT_REPO, ["text", "greet", "--limit", "5", "--path", "src", "--language", "typescript"]),
  ...pair("no-backend/text-none", TEXT_REPO, ["text", "noSuchIdentifierAnywhere", "--limit", "5"]),
];

// ── Run ───────────────────────────────────────────────────────────────────

const version = ix(["--version"], UNMAPPED_DIR).stdout.trim();
if (version !== EXPECTED_VERSION) {
  console.error(`regen-no-backend: \`ix --version\` is "${version}", expected ${EXPECTED_VERSION}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, Record<string, unknown>>;

try {
  for (const c of cases) {
    const { stdout, exit } = ix(c.args, c.cwd);
    const target = path.join(FIXTURES, c.file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, stdout);
    const entry: Record<string, unknown> = {
      command: `ix ${c.args.join(" ")}`,
      exit,
      ix: EXPECTED_VERSION,
      generatedBy: GENERATED_BY,
    };
    if (c.note) entry["note"] = c.note;
    manifest[c.file] = entry; // existing keys keep their position
    console.log(`${String(exit).padStart(3)}  ${c.file}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
} finally {
  rmSync(ixHome, { recursive: true, force: true });
  rmSync(SCRATCH, { recursive: true, force: true });
}
