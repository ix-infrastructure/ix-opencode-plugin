// Copyright 2026 Ix Infrastructure Inc.

/**
 * The one automatic `ix map` this plugin is allowed to run.
 *
 * An edit makes the graph stale, and a background refresh keeps it useful. But
 * `ix map` is a write to a backend that may be shared with other workspaces,
 * and it used to run from two places that could not get it right: on every
 * OpenCode start (gated on a JSON key `ix subsystems --list` never emits, so it
 * always ran), and after edits (gated on `args.file_path`, which OpenCode never
 * sends, so it never ran -- and had no debounce if it had).
 *
 * A map runs here only when every one of these holds:
 *
 *   1. The project dir OpenCode gave the plugin is inside a git repository, and
 *      its root is not $HOME. The root is what gets mapped, never a file.
 *   2. That root is already mapped: `ix status --root <root>` reports
 *      `graphCompleted: true`. A refresh never creates a workspace.
 *   3. No map for that root was started within the debounce window. The stamp
 *      lives in a per-user state dir, keyed by a hash of the root.
 *
 * It then runs `ix map <root> --silent` from the root with IX_AUTO_MAP=1 (Ix
 * skips an automatic map against a remote backend), detached, and returns
 * without waiting for it. Every probe before that is bounded by a timeout, and
 * any failure along the way means "skip".
 */

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { safeRun } from "./cli.ts";

export type AutoMapOutcome =
  | "no-project"   // no project dir to work from
  | "not-git"      // the project dir is not inside a git repository
  | "home"         // the git root is $HOME (or /)
  | "debounced"    // a map for this root started inside the window
  | "in-flight"    // this process is already deciding for this root
  | "not-mapped"   // ix does not report this root as mapped (or could not say)
  | "started"      // `ix map <root> --silent` was launched
  | "failed";      // something unexpected; nothing was launched

const GIT_TIMEOUT_MS = 5_000;
const STATUS_TIMEOUT_MS = 5_000;
const DEFAULT_DEBOUNCE_SECONDS = 300;

/** Canonical git toplevel for `projectDir`, or null when it is not in a repo. */
export async function resolveGitRoot(projectDir: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "-C", projectDir, "rev-parse", "--show-toplevel"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      timeout: GIT_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    const out = new Response(proc.stdout as ReadableStream).text();
    if ((await proc.exited) !== 0) return null;
    const root = (await out).trim();
    return root ? realpathSync(root) : null;
  } catch {
    return null;
  }
}

/** True for a directory that must never be mapped as a project. */
export function isUnmappableRoot(root: string): boolean {
  if (root === path.parse(root).root) return true;
  try {
    return root === realpathSync(homedir());
  } catch {
    return root === homedir();
  }
}

/** Per-user directory for debounce stamps, created 0700. */
export function autoMapStateDir(): string {
  const base = process.env["XDG_STATE_HOME"] || path.join(homedir(), ".local", "state");
  const dir = path.join(base, "ix-opencode-plugin", "automap");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  return dir;
}

export function debounceWindowMs(): number {
  const seconds = Number(process.env["IX_MAP_DEBOUNCE_SECONDS"]);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_DEBOUNCE_SECONDS) * 1000;
}

function stampPath(root: string): string {
  const key = createHash("sha256").update(root).digest("hex").slice(0, 32);
  return path.join(autoMapStateDir(), key);
}

function withinDebounce(stamp: string): boolean {
  try {
    return Date.now() - statSync(stamp).mtimeMs < debounceWindowMs();
  } catch {
    return false;
  }
}

/** `ix status` says this root has a completed graph. Anything else is "no". */
async function isMapped(root: string): Promise<boolean> {
  const out = await safeRun(["status", "--format", "json", "--root", root], root, {
    timeoutMs: STATUS_TIMEOUT_MS,
  });
  if (out === null) return false;
  try {
    return (JSON.parse(out) as { graphCompleted?: unknown }).graphCompleted === true;
  } catch {
    return false;
  }
}

function launchMap(root: string): void {
  const child = spawn("ix", ["map", root, "--silent"], {
    cwd: root,
    env: { ...process.env, IX_AUTO_MAP: "1" },
    detached: true,
    stdio: "ignore",
  });
  // A missing binary surfaces as an async 'error' event; nothing to report.
  child.on("error", () => {});
  child.unref();
}

const inFlight = new Map<string, Promise<AutoMapOutcome>>();

/**
 * Ask for a background refresh of the project containing `projectDir`.
 *
 * Never throws and never waits on the map itself; the returned promise settles
 * once the guard has decided (bounded by the git and status timeouts).
 */
export function requestAutoMap(projectDir: string | null | undefined): Promise<AutoMapOutcome> {
  const request = decide(projectDir);
  pending.add(request);
  void request.finally(() => pending.delete(request));
  return request;
}

const pending = new Set<Promise<AutoMapOutcome>>();

async function decide(projectDir: string | null | undefined): Promise<AutoMapOutcome> {
  if (!projectDir) return "no-project";
  try {
    const root = await resolveGitRoot(projectDir);
    if (!root) return "not-git";
    if (isUnmappableRoot(root)) return "home";

    const stamp = stampPath(root);
    if (withinDebounce(stamp)) return "debounced";
    if (inFlight.has(root)) return "in-flight";

    const decision = (async (): Promise<AutoMapOutcome> => {
      if (!(await isMapped(root))) return "not-mapped";
      // Re-check: another OpenCode process may have claimed it meanwhile.
      if (withinDebounce(stamp)) return "debounced";
      writeFileSync(stamp, `${root}\n`, { mode: 0o600 });
      launchMap(root);
      return "started";
    })();
    inFlight.set(root, decision);
    try {
      return await decision;
    } finally {
      inFlight.delete(root);
    }
  } catch {
    return "failed";
  }
}

/** Resolves once every pending guard decision has settled. For tests. */
export async function settleAutoMaps(): Promise<void> {
  await Promise.allSettled([...pending]);
}
