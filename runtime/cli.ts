import { $ } from "bun";

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
 */
export interface IxRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run an `ix` command without throwing on a non-zero exit.
 *
 * Returns null only when the command could not run at all -- no binary, or a
 * spawn failure. A command that ran and failed is not null: it comes back with
 * whatever it managed to print, and the caller decides.
 */
export async function runIx(cmd: ReturnType<typeof $>): Promise<IxRun | null> {
  try {
    const res = await cmd.nothrow().quiet();
    return {
      stdout: res.stdout.toString(),
      stderr: res.stderr.toString(),
      exitCode: res.exitCode,
    };
  } catch {
    return null;
  }
}

/**
 * The stdout of a command that produced something usable, else null.
 *
 * This is the shape most tools want: they parse stdout or fall back, and the
 * exit code adds nothing once you know whether there is a body to parse.
 */
export async function safeRun(cmd: ReturnType<typeof $>): Promise<string | null> {
  const run = await runIx(cmd);
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
