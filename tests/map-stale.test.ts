// Copyright 2026 Ix Infrastructure Inc.

/**
 * Reading Ix's stale-map signal (Ix#880) without ever throwing on what an
 * older or newer CLI prints instead.
 *
 * Run with: bun test
 */

import { describe, expect, test } from "bun:test";

import { mapStaleFromJson, mapStaleLine, splitLlmMapStale } from "../runtime/map-stale.ts";
import { parseIxError } from "../runtime/ix-error.ts";

const RECORD =
  'diagnostic code=map_stale message="Stale map: not recomputed after this edit. Every count and region here is from the last map (map rev 7, 42 files). Run ix map --remap to recompute it now; region views refresh it in the background."';

describe("mapStaleFromJson", () => {
  test("map_stale true, with regions_as_of", () => {
    expect(mapStaleFromJson({ map_stale: true, regions_as_of: { map_rev: 7, file_count: 42 } })).toEqual({
      regionsAsOf: { map_rev: 7, file_count: 42 },
    });
  });

  test("map_stale true, regions_as_of missing, null or malformed", () => {
    expect(mapStaleFromJson({ map_stale: true })).toEqual({});
    expect(mapStaleFromJson({ map_stale: true, regions_as_of: null })).toEqual({});
    expect(mapStaleFromJson({ map_stale: true, regions_as_of: { map_rev: "7" } })).toEqual({});
  });

  test("anything but map_stale === true is not stale", () => {
    for (const v of [{}, { map_stale: false }, { map_stale: "true" }, { map_stale: 1 }, null, undefined, [], "x", 3]) {
      expect(mapStaleFromJson(v)).toBeNull();
    }
  });
});

describe("splitLlmMapStale", () => {
  test("takes the record out and reads the map it names", () => {
    const { stale, body } = splitLlmMapStale(`${RECORD}\nmap files=42 regions=3\nregion id=a label=X`);
    expect(stale).toEqual({ regionsAsOf: { map_rev: 7, file_count: 42 } });
    expect(body).toBe("map files=42 regions=3\nregion id=a label=X");
  });

  test("a message without the map is still stale", () => {
    const { stale, body } = splitLlmMapStale('diagnostic code=map_stale message="Stale map."\nmap files=1');
    expect(stale).toEqual({});
    expect(body).toBe("map files=1");
  });

  test("text without the record comes back unchanged", () => {
    const text = "map files=1 regions=1\ndiagnostic code=other message=x";
    expect(splitLlmMapStale(text)).toEqual({ stale: null, body: text });
  });

  test("the record is not an Ix error", () => {
    expect(parseIxError(`${RECORD}\nmap files=1`)).toBeNull();
  });
});

describe("mapStaleLine", () => {
  test("names the map when known", () => {
    expect(mapStaleLine({ regionsAsOf: { map_rev: 7, file_count: 42 } })).toBe(
      "_Map is stale (regions as of map rev 7, 42 files); recent edits may not be reflected — a background refresh is running._",
    );
    expect(mapStaleLine({})).toBe(
      "_Map is stale; recent edits may not be reflected — a background refresh is running._",
    );
  });
});
