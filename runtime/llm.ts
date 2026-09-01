/**
 * ix `--format llm` fast-path, gated on the installed CLI's version.
 *
 * Tools here fetch `--format json`, parse it, and hand-render markdown. The
 * rendering carries real value — a header, an empty-graph message, an error
 * envelope — but the *body* is usually a table or list that `--format llm`
 * already emits, 2-4x smaller than the JSON it was rebuilt from.
 *
 * So this is the middle path: keep each tool's envelope, swap the body. A tool
 * that gets llm text back emits its own header and then the records verbatim;
 * a tool that gets `null` runs its existing JSON path untouched.
 *
 * ## Why the floor is per command
 *
 * `--format llm` did not arrive all at once, and the two tiers that matter are
 * three minor versions apart:
 *
 *   Tier 1-4  map subsystems impact smells overview stats inventory rank
 *             depends trace callers callees imports imported-by text history
 *             locate diff                                        -> v0.7.0
 *   Tier 5    explain read status doctor savings                 -> v0.9.2
 *
 * ## Why a wrong floor fails silently
 *
 * `ix` does not validate `--format`. Every renderer is
 * `if json … else if llm … else text`, so an unrecognised value falls through
 * to **human-readable text and exits 0**. An old CLI answers `--format llm`
 * with a rendered table, not an error — there is nothing to catch. Asking
 * `explain` for llm on 0.9.1 returns prose, successfully.
 *
 * The same property is what makes this safe to ship: there is no version of
 * `ix` on which asking for `llm` breaks. The floors buy output quality, not
 * crash-avoidance.
 *
 * ## Pro commands are excluded outright
 *
 * `briefing`, `decisions` and the rest of `@ix/pro` declare only `text|json`.
 * There is no llm renderer at any version, so no gate can help — they are
 * absent from the table below and must stay absent.
 */

import { $ } from "bun";
import { safeRun } from "./cli.ts";
import { redactSecrets } from "./secrets.ts";

type SemVer = [number, number, number];

/** command -> release whose renderer it needs. */
export const LLM_MIN_VERSION: Record<string, SemVer> = {
  // Tier 1
  map: [0, 7, 0],
  subsystems: [0, 7, 0],
  impact: [0, 7, 0],
  smells: [0, 7, 0],
  overview: [0, 7, 0],
  stats: [0, 7, 0],
  // Tier 2
  inventory: [0, 7, 0],
  rank: [0, 7, 0],
  depends: [0, 7, 0],
  trace: [0, 7, 0],
  callers: [0, 7, 0],
  callees: [0, 7, 0],
  imports: [0, 7, 0],
  "imported-by": [0, 7, 0],
  // Tier 3
  text: [0, 7, 0],
  history: [0, 7, 0],
  // Tier 4
  locate: [0, 7, 0],
  diff: [0, 7, 0],
  // Tier 5 — the reason this is a table and not one constant.
  explain: [0, 9, 2],
  read: [0, 9, 2],
};

/**
 * Flag combinations that stay on text even on a current CLI, documented as
 * deliberate exceptions in docs/llm-format.md: `diff --content` emits verbatim
 * hunks, which have no record form.
 */
const TEXT_ONLY_FLAGS: Record<string, readonly string[]> = {
  diff: ["--content"],
};

export function parseSemver(value: string): SemVer | null {
  const match = (value ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function gte(a: SemVer, b: SemVer): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return true;
}

export function llmDisabled(): boolean {
  const flag = (process.env["IX_DISABLE_LLM_FORMAT"] ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

// Process-lifetime memo: the version is probed at most once per plugin process.
let versionPromise: Promise<SemVer | null> | null = null;

/** For tests. */
export function resetLlmVersionCache(): void {
  versionPromise = null;
}

async function detectVersion(cwd: string): Promise<SemVer | null> {
  if (!versionPromise) {
    versionPromise = (async () => {
      try {
        const out = await $`ix --version`.cwd(cwd).quiet().text();
        return parseSemver(out.trim());
      } catch {
        // No CLI, or it failed. Fail closed: the JSON path still works, and a
        // tool that cannot run `ix --version` cannot run anything else either.
        return null;
      }
    })();
  }
  return versionPromise;
}

export function commandAllowsLlm(args: readonly string[]): boolean {
  const command = args[0];
  if (!command) return false;
  if (!(command in LLM_MIN_VERSION)) return false;
  const blocked = TEXT_ONLY_FLAGS[command];
  if (blocked && blocked.some((flag) => args.includes(flag))) return false;
  return true;
}

/**
 * `ix` reports some failures as a record on stdout *with exit 0* —
 * `error code=<slug> message="…"` is part of the llm format by design. Checking
 * only the exit status would forward that line to the model as a result, so it
 * is detected here and deferred to the JSON path, where the tool's own error
 * envelope applies. No success record begins with `error code=`.
 */
export function isLlmErrorLine(text: string): boolean {
  return /^error code=/.test(text.trimStart());
}

/**
 * Run `ix <args> --format llm` and return its text, or null to signal
 * "use the JSON path".
 *
 * Every failure mode returns null: unsupported command, CLI too old, no CLI,
 * a non-zero exit, empty output, or an `error code=` record.
 */
export async function tryLlm(
  args: readonly string[],
  cwd: string,
): Promise<string | null> {
  if (llmDisabled()) return null;
  if (!commandAllowsLlm(args)) return null;

  const floor = LLM_MIN_VERSION[args[0]!]!;
  const version = await detectVersion(cwd);
  if (version === null || !gte(version, floor)) return null;

  // `safeRun`, not a bare `.text()`: several ix commands exit 1 for "that does
  // not exist" while printing a complete llm record, and Ix#547 takes that from
  // three commands to thirteen. Throwing the body away on a non-zero exit sends
  // every one of those down the JSON path, which discards it a second time and
  // reports the CLI as unavailable. `isLlmErrorLine` below already handles a
  // genuine `error code=...` record, so a failure that says something useful is
  // still rejected on its merits rather than on its exit code.
  const out = await safeRun($`ix ${[...args, "--format", "llm"]}`.cwd(cwd));
  if (out === null) return null;

  // Scrubbed before it reaches the model. The JSON path does not do this today
  // — only the runtime client scrubs — so this is not parity with it, just the
  // cheaper side of the choice: redactSecrets is idempotent and order-free, so
  // one pass over flat key=value lines costs nothing and cannot make the output
  // wrong. Bringing the JSON path up to match is a separate change.
  const text = redactSecrets(out).trim();
  if (!text) return null;
  if (isLlmErrorLine(text)) return null;
  return text;
}
