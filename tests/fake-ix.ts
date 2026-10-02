// Copyright 2026 Ix Infrastructure Inc.

/**
 * A fake `ix` that refuses what the real one refuses.
 *
 * Stubs that answer anything let a tool call a flag or a command shape the CLI
 * rejects and still pass. This preamble runs before every stub body and fails
 * the way `ix` does (v0.11.1 and later) for the calls this plugin has got wrong
 * before:
 *
 *   ix map <non-directory>   -> exit 1 "Map path is not a directory"
 *   ix locate ... --limit    -> exit 1 "unknown option '--limit'"
 *   ix smells ... --path     -> exit 1 "unknown option '--path'"
 *
 * When IX_FAKE_LOG is set, every invocation appends one line to it:
 * `<cwd>|<IX_AUTO_MAP>|<argv...>`.
 */

import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const STRICT_IX_PREAMBLE = `
if [ -n "\${IX_FAKE_LOG:-}" ]; then
  printf '%s|%s|%s\\n' "$PWD" "\${IX_AUTO_MAP:-}" "$*" >> "$IX_FAKE_LOG"
fi
case "\${1:-}" in
  map)
    _skip=1
    for _a in "$@"; do
      if [ "$_skip" = 1 ]; then _skip=0; continue; fi
      case "$_a" in
        --format|--level|--min-confidence|--max-items|--sort) _skip=1 ;;
        --*) ;;
        *) if [ ! -d "$_a" ]; then echo "Map path is not a directory: $_a" >&2; exit 1; fi ;;
      esac
    done
    ;;
  locate)
    for _a in "$@"; do
      if [ "$_a" = "--limit" ]; then echo "error: unknown option '--limit'" >&2; exit 1; fi
    done
    ;;
  smells)
    for _a in "$@"; do
      if [ "$_a" = "--path" ]; then echo "error: unknown option '--path'" >&2; exit 1; fi
    done
    ;;
esac
`;

/** Write an executable fake `ix` into `dir`: the strict preamble, then `body`. */
export function writeFakeIx(dir: string, body: string): string {
  const bin = path.join(dir, "ix");
  writeFileSync(bin, `#!/bin/sh\n${STRICT_IX_PREAMBLE}\n${body}\n`);
  chmodSync(bin, 0o755);
  return bin;
}

/** A fresh temp dir holding only a fake `ix`. */
export function fakeIxDir(body: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ix-fake-"));
  writeFakeIx(dir, body);
  return dir;
}

/** PATH that reaches the fake and the system tools, but never a real `ix`. */
export function fakePath(binDir: string): string {
  return [binDir, "/usr/bin", "/bin"].join(path.delimiter);
}
