// Copyright 2026 Ix Infrastructure Inc.

/**
 * Running `ix` and keeping what it said.
 *
 * Bun's `$` throws on a non-zero exit and `.text()` discards stdout along with
 * it. That was harmless while every `ix` command exited 0, and it is not any
 * more: several commands exit 1 to mean "you asked for something that does not
 * exist" while still printing a complete JSON body, and Ix#547 takes that from
 * three commands to thirteen.
 *
 * The distinction this module exists to preserve:
 *
 *   exit 1 with a body   -> ix answered. The body IS the answer.
 *   exit 1 with no body  -> ix could not answer. Report it.
 *   could not run at all -> ix is not installed. Report it.
 *
 * Collapsing the first into the others is what turned "no entity matched that
 * name" into "ix unavailable" -- a wrong answer, and a much less useful one
 * than the record ix actually supplied.
 *
 * ## Every call is bounded
 *
 * A tool call or hook that waits on `ix` waits on the backend behind it, and a
 * half-up backend does not fail -- it hangs. Bun's `$` has no timeout and no
 * way to kill what it started, so `ix` runs through `Bun.spawn` here with a
 * deadline, and a call that runs past it is killed and reported as a failure
 * rather than left to hold the host open.
 */
export interface IxRun {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True when the deadline killed the process. */
  timedOut?: boolean;
}

export interface IxRunOptions {
  /** Kill `ix` after this many milliseconds. Default: IX_CLI_TIMEOUT_MS or 60s. */
  timeoutMs?: number;
  /** Extra environment for the child, merged over process.env. */
  env?: Record<string, string>;
}

const FALLBACK_TIMEOUT_MS = 60_000;

/** Exit code reported for a run the deadline killed (as timeout(1) does). */
export const TIMEOUT_EXIT_CODE = 124;

export function defaultTimeoutMs(): number {
  const fromEnv = Number(process.env["IX_CLI_TIMEOUT_MS"]);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : FALLBACK_TIMEOUT_MS;
}

/**
 * Run `ix <args>` in `cwd` without throwing on a non-zero exit.
 *
 * Returns null only when the command could not run at all -- no binary, a
 * missing cwd, or a spawn failure. A command that ran and failed is not null:
 * it comes back with whatever it managed to print, and the caller decides. A
 * command that ran out of time comes back with no stdout (a truncated body is
 * not an answer), `timedOut: true` and a stderr line saying so.
 */
export async function runIx(
  args: readonly string[],
  cwd: string,
  opts: IxRunOptions = {},
): Promise<IxRun | null> {
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs();
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["ix", ...args], {
      cwd,
      env: opts.env ? { ...process.env, ...opts.env } : undefined,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    return null;
  }

  // Both streams drain while we wait, so a large body cannot fill the pipe and
  // stall the child. On a timeout they are cancelled rather than awaited: a
  // grandchild that inherited the pipe (ix shells out to ripgrep, git) would
  // otherwise keep them -- and the host's event loop -- open past the kill.
  const out = drain(proc.stdout as ReadableStream<Uint8Array>);
  const err = drain(proc.stderr as ReadableStream<Uint8Array>);
  const output = Promise.all([out.text, err.text]);

  // Our own timer rather than spawn's `timeout`: Bun reports `killed` for every
  // exited process, so only this flag tells a deadline kill from a normal exit.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGKILL");
  }, timeoutMs);
  try {
    const exitCode = await proc.exited;
    if (timedOut) {
      out.cancel();
      err.cancel();
      output.catch(() => {});
      const what = args[0] ? `ix ${args[0]}` : "ix";
      return {
        stdout: "",
        stderr: `${what} timed out after ${Math.round(timeoutMs / 1000)}s`,
        exitCode: TIMEOUT_EXIT_CODE,
        timedOut: true,
      };
    }
    const [stdout, stderr] = await output;
    return { stdout, stderr, exitCode };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Read a stream to text, with a way to abandon it part-way. */
function drain(stream: ReadableStream<Uint8Array>): { text: Promise<string>; cancel: () => void } {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const text = (async () => {
    let result = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  })();
  return { text, cancel: () => void reader.cancel().catch(() => {}) };
}

/**
 * The stdout of a command that produced something usable, else null.
 *
 * This is the shape most tools want: they parse stdout or fall back, and the
 * exit code adds nothing once you know whether there is a body to parse.
 */
export async function safeRun(
  args: readonly string[],
  cwd: string,
  opts: IxRunOptions = {},
): Promise<string | null> {
  const run = await runIx(args, cwd, opts);
  if (!run) return null;
  return run.stdout.trim() ? run.stdout : null;
}

/**
 * What to tell the user when `ix` left nothing to work with.
 *
 * Prefers stderr, which is where ix writes its human guidance, and falls back
 * to naming the exit code so the message is never empty.
 */
export function failureDetail(run: IxRun | null): string {
  if (!run) return "ix CLI not found on PATH";
  const stderr = run.stderr.trim();
  if (stderr) return stderr.split("\n").slice(0, 3).join("\n");
  return `ix exited ${run.exitCode} without output`;
}
