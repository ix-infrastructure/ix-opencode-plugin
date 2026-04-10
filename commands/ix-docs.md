---
name: ix-docs
description: Generate narrative-first, importance-weighted documentation for a repo, system, or subsystem with a selective reference layer. Use --full for deeper module/class/method coverage.
argument-hint: <target> [--full] [--style narrative|reference|hybrid] [--split] [--single-doc] [--out <path>]
---

Check `command -v ix` first. If unavailable, stop and say so.

## Goal

Produce documentation that helps a new engineer understand the system quickly and gives an LLM strong architectural context without drowning it in low-value detail.

Write like real engineering documentation — teach the system, explain how it works, show where the important parts live, surface risks and fragile boundaries, point the reader to the next files or symbols to inspect. Never write a raw report dump.

## Flags

| Fragment | Variable | Default |
|---|---|---|
| first non-flag token | `TARGET` | required |
| `--full` | `FULL=true` | false |
| `--style narrative\|reference\|hybrid` | `STYLE` | `narrative` |
| `--split` | `SPLIT=true` | false |
| `--single-doc` | `SINGLE=true` | false |
| `--out <path>` | `OUT_PATH` | auto-detect |

**Parsing:** Scan `$ARGUMENTS` left to right. First non-`--` token is `TARGET`. If `TARGET` is missing, stop and ask.

**Output path auto-detection:**
1. `docs/` exists at workspace root → `docs/<target-name>.md`
2. `doc/` exists → `doc/<target-name>.md`
3. otherwise → `<target-name>.md` at workspace root

If `FULL=true` and more than 10 subsystems, auto-enable `SPLIT=true` unless `--single-doc` was passed.

## Phase 1 — Scope

```bash
ix stats --format json
ix subsystems --format json
ix subsystems --list --format json
ix briefing --format json 2>&1
```

**Pro check:** If `ix briefing` returns JSON with a `revision` field, Pro is available. Extract `activeGoals`, `recentDecisions`, and `recentChanges` for **[Pro]** steps.

If `TARGET` is not obviously the whole repo:
```bash
ix locate "$TARGET" --format json
```

Resolve target scope: repo / top-level system / subsystem / module or file / class or symbol.

## Phase 2 — Architecture

```bash
ix overview "$TARGET" --format json
ix rank --by dependents --kind class --top 10 --exclude-path test --format json
ix rank --by callers   --kind function --top 10 --exclude-path test --format json
```

For repo or system targets, also run:
```bash
ix subsystems "$TARGET" --format json
ix subsystems "$TARGET" --explain
```

For module or file targets:
```bash
ix contains "$TARGET" --format json
ix imports  "$TARGET" --format json
```

**Stop when** the top 3-5 important components and subsystem structure are clear.

Full mode: raise rank budgets to 20, inspect most important systems first.

## Phase 3 — Behavior

```bash
ix explain "$TARGET" --format json
```

Also run `ix explain` for the most important orchestrators identified in Phase 2.

Budget:
- default: explain top 3-5 entities
- full: explain top 5 classes/services per important subsystem

Run **one** `ix trace` only if the main execution flow is still unclear after `ix explain`.

## Phase 4 — Relationships

For repo or large system targets, run for the top 3-5 boundary components, not the repo itself:
```bash
ix callers  <boundary-component> --limit 20 --format json
ix callees  <boundary-component> --limit 15 --format json
ix depends  <boundary-component> --depth 2 --format json
```

For module/symbol targets:
```bash
ix callers "$TARGET" --limit 20 --format json
ix depends "$TARGET" --depth 2 --format json
```

**Skip for symbol-level targets** — relationship data at that scope adds minimal documentation value.

## Phase 5 — Risk

For repo targets, run `ix impact` for the top 3-5 high-centrality entities from Phase 2 (not the repo itself).

Otherwise:
```bash
ix impact "$TARGET" --format json
```

## Phase 6 — Health

```bash
ix smells --format json
```

Filter results by path prefix after retrieval if scoped to a subsystem.

**[Pro]** If Pro is available and `recentDecisions` is non-empty:
```bash
ix decisions --format json
```

**Skip for symbol-level or single-module targets.**

## Phase 7 — Optional reads

Code read budget: default 2, full 5. Symbol-level only.

Only for: orchestrators with unclear control flow, critical entry points, high-risk components still ambiguous after `ix explain`.

```bash
ix read <symbol> --format json
```

Never exceed the budget. Omit or note gaps instead of over-reading.

## Output structure

Write the documentation as a Markdown file (or files if `SPLIT=true`). Use the structure below:

```markdown
# [Target] — Documentation

> Generated: [date]
> Scope: [repo | system | subsystem | module | symbol]
> Mode: [standard | full]
> Style: [narrative | reference | hybrid]

## Part 1 — Narrative

### 1. Overview
[What the system is, what it does, why it exists]
**[Pro]** Active goals this system serves, if available.

### 2. Architecture
[Systems → subsystems → modules. Boundaries and responsibilities.]

### 3. How It Works
[Main execution flows, request/data lifecycle, orchestration paths]

### 4. Key Components
[Most important modules, classes, or services — why they matter]

### 5. Dependencies & Relationships
[Major dependencies, cross-system interactions, coupling points]

### 6. Risk & Complexity
[High-risk areas, fragile components, change sensitivity]

### 7. How to Work With This
[Where to start, how to navigate, common workflows, what to modify carefully]

### 8. Where to Go Deeper
[Next files, modules, or symbols to inspect. Suggested exploration paths.]

## Part 2 — Selective Reference

### Module Summary
[For each major module: purpose, responsibilities, dependencies, key contained components]

### Class / Service Summary
[For each important class or service: role, what it manages, where it is used]

### Method Summary
[Only in --full, only for key classes: method name, 1-2 line role summary]
```

## Writing rules by style

- `--style narrative` (default): lead with prose, reference layer stays compact
- `--style reference`: tighter structure, more headings/bullets, reference more prominent
- `--style hybrid`: full narrative + fuller reference; best with `--full`

## Post-write confirmation

After writing:

```text
Documentation written.

Mode:   [standard | full]
Style:  [narrative | reference | hybrid]
Output: [path or directory]
Scope:  [repo/system/subsystem/module/symbol]
Coverage: [systems/subsystems/components expanded]

Summary: [2-3 sentences on the system and the most important architectural fact]
```
