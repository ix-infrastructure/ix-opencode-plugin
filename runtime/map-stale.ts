// Copyright 2026 Ix Infrastructure Inc.

/**
 * Saying when the Ix architecture map is stale.
 *
 * Since Ix#841 the automatic `ix map` the hooks run after an edit may defer
 * recomputing the architecture map: region readers (`ix subsystems`,
 * `overview`, `explain`, `impact`, `locate`) answer from the last computed map
 * and start a background refresh. Since Ix#880 their machine output says so:
 *
 *   --format json   top-level `map_stale: true`, and `regions_as_of`
 *                   (`{map_rev, file_count}` of the last map) when known
 *   --format llm    one `diagnostic code=map_stale message="..."` record,
 *                   just before the answer's first record
 *
 * A fresh map adds neither, and an older CLI never emits them, so a tool that
 * finds nothing here renders exactly what it did before. Nothing in this
 * module throws on unexpected input: a malformed field reads as "not stale" or
 * "no regions_as_of".
 */

import { parseLlmRecord } from "./ix-error.ts";

/** The map the regions come from, as Ix names it. */
export interface RegionsAsOf {
  map_rev: number;
  file_count: number;
}

/** What a region reader's output said about the map, when it said it is stale. */
export interface MapStale {
  regionsAsOf?: RegionsAsOf;
}

function regionsAsOfFrom(value: unknown): RegionsAsOf | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const rev = v["map_rev"];
  const files = v["file_count"];
  if (typeof rev !== "number" || !Number.isFinite(rev)) return undefined;
  if (typeof files !== "number" || !Number.isFinite(files)) return undefined;
  return { map_rev: rev, file_count: files };
}

/** From a parsed `--format json` payload: stale only when `map_stale === true`. */
export function mapStaleFromJson(value: unknown): MapStale | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v["map_stale"] !== true) return null;
  const asOf = regionsAsOfFrom(v["regions_as_of"]);
  return asOf ? { regionsAsOf: asOf } : {};
}

const MAP_STALE_RECORD = /^diagnostic\s+code=map_stale(\s|$)/;

/**
 * From `--format llm` text: whether it carries a `diagnostic code=map_stale`
 * record, and the text without it (so the tool does not print it twice).
 * Text without the record comes back unchanged. The record's message names
 * the last map as `(map rev N, M files)`; that is read when present.
 */
export function splitLlmMapStale(text: string): { stale: MapStale | null; body: string } {
  const lines = text.split("\n");
  let stale: MapStale | null = null;
  const kept: string[] = [];
  for (const line of lines) {
    if (MAP_STALE_RECORD.test(line.trim())) {
      if (!stale) {
        stale = {};
        const message = parseLlmRecord(line).fields["message"] ?? "";
        const m = message.match(/\(map rev (\d+), (\d+) files?\)/);
        if (m) stale.regionsAsOf = { map_rev: Number(m[1]), file_count: Number(m[2]) };
      }
      continue;
    }
    kept.push(line);
  }
  if (!stale) return { stale: null, body: text };
  return { stale, body: kept.join("\n").trim() };
}

/**
 * The one line a tool puts under its heading while the map is stale. It does
 * not say a background refresh is under way: Ix also reports a stale map when
 * background refresh is off (IX_MAP_BACKGROUND_REFRESH=0), failed or could
 * not start. It carries the remedy Ix's own llm record gives, which the tool
 * drops from the body.
 */
export function mapStaleLine(stale: MapStale): string {
  const asOf = stale.regionsAsOf
    ? ` (regions as of map rev ${stale.regionsAsOf.map_rev}, ${stale.regionsAsOf.file_count} file${stale.regionsAsOf.file_count === 1 ? "" : "s"})`
    : "";
  return `_Map is stale${asOf}; recent edits may not be reflected — run \`ix map --remap\` to refresh it now._`;
}
