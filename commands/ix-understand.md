---
name: ix-understand
description: Build a detailed architectural mental model of a system, subsystem, or the whole repo. Graph-first, source reads only when needed for data flow or key patterns.
argument-hint: [target — subsystem name, path, or empty for whole repo]
---

Check `command -v ix` first. If unavailable, stop and say so.

## Phase 1 — Orient

Run these commands **in parallel** using the Bash tool to discover the architecture:

```bash
ix subsystems --format llm
ix subsystems --list --format llm
ix rank --by dependents --kind class --top 15 --exclude-path test --format llm
ix rank --by callers --kind function --top 15 --exclude-path test --format llm
ix stats --format llm
```

From the results, identify:
- All top-level systems (names, file counts, cohesion, coupling scores)
- The top 10-15 structurally important classes and functions
- Total codebase scale (files, nodes, edges)

If $ARGUMENTS specifies a target, scope the orient to that target's subsystems.

## Phase 2 — Major pillars

For EACH major system in scope, run in parallel:
```bash
ix overview <system> --format llm
ix contains <system> --format llm
```

Extract for each system:
- What it contains (sub-components, key types)
- Its role in the architecture
- How it connects to other systems

## Phase 3 — Key components deep dive

For the top 5-10 most important components (from Phase 1 rank results), run in parallel:
```bash
ix explain <component> --format llm
```

Extract: role, importance tier, caller/callee counts, why it matters architecturally.

**Stop if** you can describe the purpose and structural importance of each key component.

## Phase 4 — Data flows (only if execution paths are still unclear)

For the 1-3 most important execution flows:
```bash
ix trace <entry-point> --downstream --depth 2 --format llm
```

**Stop if** you have at least one traced flow and understand the primary data lifecycle.

## Phase 5 — Targeted source reads (sparingly)

For at most 2 symbols where the graph left important patterns unclear:
```bash
ix read <symbol> --format llm
```

Use only for: core type definitions, entry points, plugin registration patterns.

**Hard limit:** 2 `ix read` calls maximum.

## Output

Produce a comprehensive architectural document:

```
# System: [name or "Whole Repo"]

## Overview
[What the system is and does — purpose, language, scale. From orient data.]

## Architecture

### System Map
[Table of ALL top-level systems with file counts, cohesion, coupling, roles]

| System | Path | Files | Cohesion | Coupling | Role |
|--------|------|-------|----------|----------|------|

### [Subsystem Name] (path)
[Detailed breakdown: sub-components, what it does, how it's organized]

[...repeat for all major subsystems]

## Core Abstractions / Type System
[The fundamental data model — key types/interfaces shared across systems]

## Data Flows
[At least one primary flow traced end-to-end. ASCII diagrams:]

Component A → Component B → Component C
                   ↓
              Component D

## Key Components

| Component | System | Location | Role | Dependents | Risk |
|-----------|--------|----------|------|------------|------|
[10-15 components, sorted by dependents]

## Build & Development Infrastructure
[How to build, test, develop.]

## Dependencies & Coupling
[Cross-system interactions, shared infrastructure, coupling hotspots]

## Risk Areas

### Security Risks
### Complexity Risks
### Data Integrity Risks

## Navigation Shortcuts

| To find... | Look at... |
|------------|-----------|

## Where to Go Deeper
- `ix explain <X>` — [reason]
- `ix impact <Y>` — [reason]
```

**Label every claim as [graph] or [inferred].**

**Quality bar:** Comprehensive (all systems covered), specific (file paths, counts), structured (tables, ASCII diagrams), actionable (navigation shortcuts), evidenced.
