# Ix v0.12.0 output fixtures

Captured stdout of the real `ix` CLI, used by `tests/ix-errors.test.ts`.

**Source:** Ix `main` at `5ce416c` (v0.12.0 is `8d16f2a`; the one commit on
top only touches `ix mcp`), built `ix-cli/dist`, run with
`node ix-cli/dist/cli/main.js`. That checkout's `package.json` still says
0.11.1, so `--version` printed 0.11.1; the behaviour is v0.12.0's, including
Ix#733 (error records on stdout, exit 1). Captured 2026-10-01 against a local
backend on :8090. Only read commands were run.

`manifest.json` maps every captured file to the exact command and its exit code.
`.json` files are `--format json`, `.txt` files are `--format llm`.

## `unmapped/` (real)

Run from a fresh `mktemp -d` directory with no Ix config, so no registered
workspace covers it. Every graph read answers
`{"error":"workspace_not_mapped",...,"next":"Run \`ix map <dir>\` ..."}` (JSON)
or `error code=workspace_not_mapped ... hint="..."` (llm), exit 1. Commands:
impact, callers, trace, explain, locate, `smells --list`, stats, subsystems,
rank, inventory.

`smells-list.*` is `ix smells --list`. The plugin's ix-smells tool runs
`ix smells` without `--list`, which writes smell claims and so was not run;
both reject an unmapped directory in the same place (`resolveReadSystemId`,
before the `--list` branch), so the record is the one `ix smells` prints.

## `empty-graph/` (real)

Run from a fresh `mktemp -d` directory registered in a throwaway `IX_HOME`
config under a new workspace id that the backend holds nothing for: a
workspace that is registered but never mapped. Target reads answer
`{"error":"unresolved_target",...,"graph":{"status":"empty","reason":"no_nodes","fix":"ix map",...}}`,
exit 1. `impact-file.*` is a file target (`reason: file_not_found`).

Not error records, kept to pin that down: `locate.json`
(`{"resolvedTarget":null,...}`), `smells-list.*` and `stats.*` (exit 0, zero
counts).

## `synthetic/` (hand-written)

Successful `ix impact --format json` records. None could be captured without
mapping a project (a write), so these are built from the shape in
`ix-cli/src/cli/commands/impact.ts` (`containerImpact` / `leafImpact`) and
`ix-cli/src/cli/graph-health.ts`: `riskLevel`, `riskSummary`, `riskCategory`,
`summary.{members,directImporters,directDependents,memberLevelCallers}` for a
file, `summary.{callers,callees}` for a function, `propagationBuckets[].region`,
and for `impact-degraded.json` the `graph` block with `riskLevel: "unknown"`
that Ix emits on a hollow graph.
