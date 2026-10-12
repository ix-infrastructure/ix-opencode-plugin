// Copyright 2026 Ix Infrastructure Inc.

/**
 * A map Ix left for later (Ix#841, CL-13).
 *
 * After an incremental `ix map`, Ix ingests the edit but defers the
 * architecture map: the regions it serves are the last computed map's until a
 * region view (`ix subsystems`, `ix overview`, ...) or `ix map --remap`
 * recomputes it. Ix says so in three places:
 *
 *   --format json   `map_stale: true` and `regions_as_of: {map_rev, file_count}`
 *                   (`false` / `null` when fresh)
 *   --format llm    `map_stale=true regions_as_of_rev=N regions_as_of_files=F`
 *                   on the `map` record (only when stale)
 *   stderr          `ix: architecture map is stale (<why>); ...` from a region
 *                   view that could not refresh it (another `ix map` holds the
 *                   lock, a refresh was tried moments ago, or it failed)
 *
 * A tool that shows regions labels them as the previous map's when any of
 * these says so. An older Ix sends none of them, and then this returns null
 * and the tool's output is exactly what it was.
 */

/**
 * The map the regions come from, when Ix named it, and why it is still stale
 * when the stderr line said (the text in its parentheses).
 */
export type MapStale = { rev?: number; files?: number; reason?: string };

const STALE_STDERR = /^ix: architecture map is stale\b(?: \(([^)\n]*)\))?/m;

/**
 * The one reason a re-run may help: another `ix map` holds the lock and may
 * be refreshing. Every other reason Ix gives ("a refresh was tried moments
 * ago", "its refresh failed", "its refresh did not complete", "files changed
 * while it was refreshed") means a re-run inside the debounce window gives
 * the same stale answer, so the note points to `ix map --remap` instead.
 */
const REFRESH_RUNNING = "another ix map is running";

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** null without the stderr line; otherwise its reason, when it gave one. */
function staleOnStderr(stderr: string | undefined): { reason?: string } | null {
  if (!stderr) return null;
  const m = stderr.replace(/\u001b\[[0-9;]*m/g, "").match(STALE_STDERR);
  if (!m) return null;
  return m[1] ? { reason: m[1] } : {};
}

function build(rev: number | undefined, files: number | undefined, onStderr: { reason?: string } | null): MapStale {
  const out: MapStale = { rev, files };
  if (onStderr?.reason !== undefined) out.reason = onStderr.reason;
  return out;
}

/** From a `--format json` record and the run's stderr; null when the map is fresh. */
export function mapStaleFromJson(record: unknown, stderr?: string): MapStale | null {
  const r = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
  const asOf =
    r["regions_as_of"] && typeof r["regions_as_of"] === "object"
      ? (r["regions_as_of"] as Record<string, unknown>)
      : null;
  const onStderr = staleOnStderr(stderr);
  if (r["map_stale"] !== true && asOf === null && !onStderr) return null;
  return build(num(asOf?.["map_rev"]), num(asOf?.["file_count"]), onStderr);
}

/** From `--format llm` text (its `map` record) and the run's stderr; null when the map is fresh. */
export function mapStaleFromLlm(text: string, stderr?: string): MapStale | null {
  const record = text.split("\n").find((line) => /^map\s/.test(line)) ?? "";
  const field = (key: string): string | undefined =>
    record.match(new RegExp(`(?:^|\\s)${key}=(\\S+)`))?.[1];
  const rev = field("regions_as_of_rev");
  const files = field("regions_as_of_files");
  const onStderr = staleOnStderr(stderr);
  if (field("map_stale") !== "true" && rev === undefined && !onStderr) return null;
  const toNum = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
  return build(toNum(rev), toNum(files), onStderr);
}

/** One line saying the regions shown are the previous map's. */
export function mapStaleNote(stale: MapStale): string {
  const asOf =
    stale.rev !== undefined && stale.files !== undefined
      ? `regions as of map rev ${stale.rev}, ${stale.files} files`
      : "regions are from the previous map";
  if (stale.reason !== undefined && stale.reason !== REFRESH_RUNNING) {
    return `_Stale map: ${asOf}; not recomputed since recent edits — run \`ix map --remap\` to refresh._`;
  }
  return `_Stale map: ${asOf}; the map is refreshing — re-run after it completes._`;
}
