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

/** The map the regions come from, when Ix named it. */
export type MapStale = { rev?: number; files?: number };

const STALE_STDERR = /^ix: architecture map is stale\b/m;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function staleOnStderr(stderr: string | undefined): boolean {
  if (!stderr) return false;
  return STALE_STDERR.test(stderr.replace(/\u001b\[[0-9;]*m/g, ""));
}

/** From a `--format json` record and the run's stderr; null when the map is fresh. */
export function mapStaleFromJson(record: unknown, stderr?: string): MapStale | null {
  const r = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
  const asOf =
    r["regions_as_of"] && typeof r["regions_as_of"] === "object"
      ? (r["regions_as_of"] as Record<string, unknown>)
      : null;
  if (r["map_stale"] !== true && asOf === null && !staleOnStderr(stderr)) return null;
  return { rev: num(asOf?.["map_rev"]), files: num(asOf?.["file_count"]) };
}

/** From `--format llm` text (its `map` record) and the run's stderr; null when the map is fresh. */
export function mapStaleFromLlm(text: string, stderr?: string): MapStale | null {
  const record = text.split("\n").find((line) => /^map\s/.test(line)) ?? "";
  const field = (key: string): string | undefined =>
    record.match(new RegExp(`(?:^|\\s)${key}=(\\S+)`))?.[1];
  const rev = field("regions_as_of_rev");
  const files = field("regions_as_of_files");
  if (field("map_stale") !== "true" && rev === undefined && !staleOnStderr(stderr)) return null;
  const toNum = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
  return { rev: toNum(rev), files: toNum(files) };
}

/** One line saying the regions shown are the previous map's. */
export function mapStaleNote(stale: MapStale): string {
  const asOf =
    stale.rev !== undefined && stale.files !== undefined
      ? `regions as of map rev ${stale.rev}, ${stale.files} files`
      : "regions are from the previous map";
  return `_Stale map: ${asOf}; the map is refreshing — re-run after it completes._`;
}
