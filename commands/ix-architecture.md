---
name: ix-architecture
description: Analyze system design — structure, coupling, code smells, and high-risk hotspots. Produces a ranked list of improvement areas. Purely graph-based, no code reads.
argument-hint: [optional scope — path, subsystem name, or empty for whole system]
---

## Health gate

Before anything else, run:
```bash
command -v ix
ix status
```
If either fails, stop: *"ix graph unavailable — run `ix connect` or check your connection."*

Then verify the graph has data:
```bash
ix subsystems --list --format llm
```
If the result is empty or returns an error, stop: *"No graph data yet — run `ix map` to build the graph first."*

## Pro check

```bash
ix briefing --format llm 2>&1
```
If it returns JSON with a `revision` field, Pro is available. Note `recentDecisions` for use below. Skip all **[Pro]** steps if it errors.

## Phase 1 — System structure

Run in parallel:
```bash
ix subsystems --format llm
ix subsystems --list --format llm
```

Build the region hierarchy. Flag immediately:
- `crosscut_score > 0.1` → cross-cutting concern (files belonging to multiple systems)
- `confidence < 0.6` → fuzzy boundary (system boundaries are unclear)
- `external_coupling` significantly higher than cohesion → module calls out more than it calls within

Sort regions: worst health first.

## Phase 2 — Smell detection

```bash
ix smells --format llm
```

Classify each smell:
- `orphan` — files with no significant connections (dead code, isolation debt)
- `god-module` — files with too many chunks or too high fan-in/out (too much responsibility)
- `weak-component` — weakly connected files (loosely held together, artificial grouping)

## Phase 3 — Hotspot analysis (only if smells found or coupling is high)

Run only when Phase 1 or 2 reveals significant issues:
```bash
ix rank --by dependents --kind class    --top 10 --exclude-path test --format llm
ix rank --by dependents --kind function --top 10 --exclude-path test --format llm
```

Correlate: components that are both **highly central** and in **poorly-bounded subsystems** are the highest-risk change targets.

## Phase 4 — Deep dive on worst offender (optional, only if there's one obvious problem area)

If Phase 1–3 identify one region as clearly the worst:
```bash
ix subsystems <region> --explain
```

**Hard limit:** One region deep dive. Do not audit every subsystem — identify the worst and analyze that.

## Phase 5 — Cross-reference decisions **[Pro]**

If Pro is available, after the analysis completes:
```bash
ix decisions --format llm
```
Append a **Recorded Decisions** section cross-referencing relevant design decisions against the findings — especially decisions that affect god-modules, high-coupling regions, or the hotspots identified.

## Output

```
# Architecture Audit

## System Health Overview

| Region | Cohesion | Ext. Coupling | Smells | Flag |
|--------|----------|---------------|--------|------|
| [name] | [0-1]    | [0-1]         | N      | [⚠ / ✓] |

## Critical Issues

### 1. [Issue name] — [Region/Module]
**Evidence:** [specific metric values]
**Problem:** [what this means structurally]
**Suggestion:** [concrete improvement]

### 2. ...

## Moderate Issues

[Same format, lower priority]

## Hotspots

Highest-risk components (central + poorly bounded):
- **[Class/Function]** — #N by dependents, in [low-cohesion region]

## What's Healthy

[Regions with good cohesion, low coupling — briefly acknowledge]

## Priority Order

1. Fix [X] first — highest blast radius + worst structural health
2. Then [Y] — cross-cutting concern, blocks other improvements
3. Then [Z] — ...

## What Would Improve Scores

[Specific reorganizations or extractions that would raise cohesion / lower coupling]

## Recorded Decisions **[Pro]**
[Relevant architectural decisions from ix decisions — omit section if none or Pro unavailable]
```

**Every number in this report must come directly from ix output.** Label each finding with the metric it's based on.

Never read source code in this skill. All analysis is purely graph-based.
