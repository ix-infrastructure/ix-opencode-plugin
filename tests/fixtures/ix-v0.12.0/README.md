# Ix v0.12.0 output fixtures

Stdout of the real `ix` CLI, used by `tests/ix-errors.test.ts`,
`tests/success-fixtures.test.ts` and `tests/secrets.test.ts`.

**Source of the hand-captured files:** Ix `main` at `5ce416c` (v0.12.0 is `8d16f2a`; the one commit on
top only touches `ix mcp`), built `ix-cli/dist`, run with
`node ix-cli/dist/cli/main.js`. That checkout's `package.json` still says
0.11.1, so `--version` printed 0.11.1; the behaviour is v0.12.0's, including
Ix#733 (error records on stdout, exit 1). Captured 2026-10-01 against a local
backend on :8090. Only read commands were run.

`manifest.json` maps every captured file to the exact command and its exit code.
`.json` files are `--format json`, `.txt` files are `--format llm`.

## Generated vs hand-captured

Two kinds of file live here:

- **Generated** by `tests/fixtures/regen-no-backend.ts` from the released
  v0.12.0 CLI with no backend: `unmapped/` and `no-backend/`. Their manifest
  entries carry `"generatedBy"`. CI's `real-ix` job installs the v0.12.0
  release tarball, reruns the script and fails if `git diff` shows any change,
  so do not edit these by hand -- rerun the script
  (`bun tests/fixtures/regen-no-backend.ts`, real `ix` 0.12.0 first on PATH).
- **Hand-captured** (or hand-written): `empty-graph/`, `success/`,
  `empty-repo/` and `synthetic/`. Each needs a backend holding a graph (or a
  registered workspace the backend answers for), which CI does not have, so
  the script cannot produce them and leaves them alone. They are described
  below as they were captured.

## `unmapped/` (generated)

Run from a fixed directory (`/tmp/ix-fixtures-v0.12.0/unmapped`) with a fresh
`IX_HOME`, so no registered workspace covers it, and `IX_ENDPOINT` pointing at
a port nothing answers on. Ix decides "not mapped" from `IX_HOME` alone,
before any network call. Every graph read answers
`{"error":"workspace_not_mapped",...,"next":"Run \`ix map <dir>\` ..."}` (JSON)
or `error code=workspace_not_mapped ... hint="..."` (llm), exit 1. Commands:
impact, callers, trace, explain, locate, `smells --list`, stats, subsystems,
rank, inventory.

`smells-list.*` is `ix smells --list`, the only form the ix-smells tool runs
(bare `ix smells` re-runs detection and writes smell claims).

These were first captured by hand from a `mktemp -d` directory; the only
change on regeneration was that directory name.

## `no-backend/` (generated)

- `version.*`: `ix --version`. It ignores `--format json` and prints plain
  `0.12.0` either way.
- `status.*`: `ix status` with the backend unreachable, exit 1. `--format llm`
  prints `error code=cli_error message="fetch failed (bad port)"`;
  `--format json` prints **nothing on stdout** (the error goes to stderr only),
  so `status.json` is empty on purpose. "bad port" is because the endpoint is
  port 1, which fetch refuses without connecting.
- `text*.*`: `ix text` (ripgrep, no graph needed) on a two-file repo the
  script writes: hits, a `--path`/`--language` scoped search, and no hits.
  All hits are in one file because `ix text` scores every ripgrep hit the same
  and keeps ripgrep's unstable cross-file order, so a multi-file result is not
  reproducible run to run.

## `empty-graph/` (real)

Run from a fresh `mktemp -d` directory registered in a throwaway `IX_HOME`
config under a new workspace id that the backend holds nothing for: a
workspace that is registered but never mapped. Target reads answer
`{"error":"unresolved_target",...,"graph":{"status":"empty","reason":"no_nodes","fix":"ix map",...}}`,
exit 1. `impact-file.*` is a file target (`reason: file_not_found`).

Not error records, kept to pin that down: `locate.json`
(`{"resolvedTarget":null,...}`), `smells-list.*` and `stats.*` (exit 0, zero
counts). `status.*` was added later from the throwaway backend below, for the
same situation (a workspace registered in `IX_HOME` with no graph):
`graphCompleted: false`, `currentRev: 0`.

## `success/` and `empty-repo/` (real, from a throwaway backend)

Every success shape the tools parse. Captured 2026-10-01 with the same CLI
build (Ix `5ce416c`, `node ix-cli/dist/cli/main.js`, reporting 0.11.1) against
a private backend started for the purpose -- `docker-compose.standalone.yml`
under compose project `ix-ocfix`, memory-layer image release 1.0.30 on
127.0.0.1:8094, a fresh `IX_HOME` -- and torn down (`down -v`) afterwards.
Nothing was written to a shared backend.

- `success/`: a `git clone --depth 1` of this repository (commit `3dbd4d4`)
  mapped with `ix map`, then every read the plugin makes: impact (function,
  file, leaf), callers, callees, depends, imported-by, locate (resolved and
  ambiguous), explain (function, file), trace (directional and `--to`), rank
  (and a kind with no entities), stats, subsystems (all, scoped, `--list`),
  inventory, status, text, read, history, overview, `map --format json|llm`.
  `smells-list-before-run.*` is `ix smells --list` straight after the map (no
  claims stored yet); `smells-list.*` is the same after one `ix smells` run on
  that private backend (31 claims; `--list` names entities by id only).
- `empty-repo/`: an empty git repo (one empty commit) mapped with `ix map`:
  zero nodes, `graphCompleted: false`, no claims.

`manifest.json` records each file's command and exit code; entries from this
capture also carry `"ix": "5ce416c"`. `.json` is `--format json`, `.txt` is
`--format llm`.

## `synthetic/` (hand-written)

Successful `ix impact --format json` records, written before `success/`
existed and kept for the risk levels and the hollow-graph case it does not
cover (`success/impact-*` are real medium/high/low records). Built from the shape in
`ix-cli/src/cli/commands/impact.ts` (`containerImpact` / `leafImpact`) and
`ix-cli/src/cli/graph-health.ts`: `riskLevel`, `riskSummary`, `riskCategory`,
`summary.{members,directImporters,directDependents,memberLevelCallers}` for a
file, `summary.{callers,callees}` for a function, `propagationBuckets[].region`,
and for `impact-degraded.json` the `graph` block with `riskLevel: "unknown"`
that Ix emits on a hollow graph.

`synthetic/smells-run*.{json,txt}` are `ix smells` detection runs (no `--list`),
built from `renderSmellsRunLlm` and the compact JSON in Ix's
`ix-cli/src/cli/commands/smells.ts`. A real capture needs a detection run, which
stores claims; the throwaway capture backend recorded only `--list` output.
