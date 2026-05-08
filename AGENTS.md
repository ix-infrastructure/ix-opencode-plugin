# ix-opencode-plugin

This repo is the OpenCode plugin for [Ix Memory](https://github.com/ix-infrastructure/IX-Memory). When working in this repo, use `ix` commands to navigate it just like any other codebase.

---

## Cognitive Model

OpenCode + Ix operates as a three-layer system:

```text
Ix Graph      = structured memory (code relationships, history, decisions)
OpenCode      = reasoning engine (infers, synthesizes, decides)
Skills/Agents = cognition layer (task abstractions over the graph)
```

OpenCode is not a command wrapper. OpenCode uses Ix as memory to reason, then synthesizes answers. The graph provides facts; OpenCode provides understanding.

---

## Behavioral Rules

### Always
- Use Ix graph data before reading source code
- Read at symbol level only with `ix read <symbol>`, never whole files unless the whole file is the explicit subject
- Use high-level skills (`/ix-investigate`, `/ix-understand`) not raw command dumps
- Stop early once you can answer the question
- Label evidence and distinguish graph-backed facts from inferences

### Never
- Scan entire files unless the whole file is the question
- Call `ix depends --depth 3+` or `ix trace` without a specific question
- Assume behavior without graph or code evidence
- Output raw JSON
- Run `ix map` for exploration (use `ix subsystems` — it reads cached data)
- Run `ix rank` without both `--by` and `--kind`

---

## Reasoning Strategy

When answering a question about a codebase:

```text
1. Orient       -> ix subsystems or ix overview
2. Locate       -> ix locate
3. Explain      -> ix explain
4. Trace/Depend -> ix trace or ix depends only if needed
5. Read         -> ix read <symbol> only if implementation detail is still unclear
6. Synthesize   -> answer the question, cite evidence
7. Suggest      -> one useful next step
```

Skip steps if earlier steps answer the question. Most questions should stop by step 3.

---

## Token Budget Rules

| Operation | Rule |
|---|---|
| Text search | `--limit 20` cap |
| Symbol rank | `--top 10` cap, always `--exclude-path test` |
| Callers/callees | `--limit 15` cap |
| Dependency tree | `--depth 2` max unless the user asks for deeper |
| Code reads | Symbol-level only, max 2 per task |
| Traces | One trace per investigation |

---

## Skill Reference

| Skill | Purpose | When to use |
|---|---|---|
| `/ix-understand [target]` | Mental model of a system | Onboarding, architecture questions, "how does X work?" |
| `/ix-investigate <symbol>` | Deep dive into a component | Before modifying, explaining, or debugging something |
| `/ix-impact <target>` | Change risk analysis | Before any non-trivial edit |
| `/ix-plan <targets...>` | Risk-ordered change plan | Multi-file changes, refactors |
| `/ix-debug <symptom>` | Root cause analysis | Bug investigation, unexpected behavior |
| `/ix-architecture [scope]` | Design health analysis | Code review, architecture discussions |
| `/ix-docs <target> [--full] [--style narrative\|reference\|hybrid] [--split] [--single-doc] [--out <path>]` | Write narrative-first docs with a selective reference layer | Onboarding docs, handoffs, deep reference |
| `/ix-help [<question>]` | Route to the right skill or tool — returns an exact invocation | When unsure which skill or tool to use |

`ix-docs` writes a narrative-first Markdown document (or split doc set) to disk. Each run starts with an onboarding-friendly narrative layer and ends with a selective reference section for the most important modules, classes, and, in `--full`, key methods.

**Modes:**
- *(default)* — narrative-focused onboarding doc with a compact selective reference appendix
- `--full` — deeper coverage for important systems, modules, classes, and selected methods; still importance-weighted, never exhaustive
- `--style narrative` — prose-first narrative sections with a compact reference layer
- `--style reference` — docs-site style structure with a briefer narrative layer
- `--style hybrid` — full narrative plus fuller selective reference; recommended with `--full`
- `--full --split` — produce `index.md` plus per-system or per-subsystem docs for large repos
- `--full --single-doc` — force one large file regardless of repo size

---

## Agent Reference

| Agent | Purpose |
|---|---|
| `ix-explorer` | General-purpose exploration, open-ended questions |
| `ix-system-explorer` | Full architectural mental model of a codebase or region |
| `ix-bug-investigator` | Autonomous root cause analysis from symptom to candidates |
| `ix-safe-refactor-planner` | Blast radius + safe change sequencing for refactors |
| `ix-architecture-auditor` | Full structural health report with ranked improvements |

---

## Repo Structure

```
tools/                           — 17 TypeScript tool functions
  ix-query.ts        — graph entity lookup (locate + explain)
  ix-neighbors.ts    — neighborhood traversal (callers, callees, depends)
  ix-impact.ts       — blast radius analysis
  ix-map.ts          — architectural map and subsystem overview
  ix-ingest.ts       — graph ingest status and trigger
  ix-history.ts      — revision, decisions, bugs (Ix Pro)
  ix-docs-tool.ts    — condensed context summary for injection
  ix-locate.ts       — text/pattern search across the codebase
  ix-explain.ts      — full symbol explanation (role, importance, callers)
  ix-rank.ts         — rank symbols by graph metric (dependents, callers...)
  ix-stats.ts        — graph-wide statistics and health
  ix-subsystems.ts   — subsystem listing with hierarchy and signals
  ix-inventory.ts    — enumerate files or symbols in a path scope
  ix-trace.ts        — full execution path trace (upstream + downstream)
  ix-decide.ts       — pre-edit policy verdict (ALLOW/REVIEW/BLOCK)
  ix-health.ts       — CLI and graph availability check
  ix-smells.ts       — architecture smell detection

runtime/
  client.ts          — Ix Core Runtime HTTP client (v2 API; CLI fallback)
  secrets.ts         — secret detection and redaction for API payloads

commands/
  ix-understand.md   — mental model slash command (graph only)
  ix-investigate.md  — symbol deep dive (graph + minimal read)
  ix-impact.md       — risk analysis (graph only)
  ix-plan.md         — change plan (graph + optional read)
  ix-debug.md        — root cause analysis (graph + targeted read)
  ix-architecture.md — design health (graph only)
  ix-docs.md         — narrative docs from graph
  ix-help.md         — skill router (returns exact invocation)

agents/
  ix-explorer.json              — general exploration
  ix-system-explorer.json       — architectural model building
  ix-bug-investigator.json      — autonomous debugging
  ix-safe-refactor-planner.json — refactor safety planning
  ix-architecture-auditor.json  — structural health audit

plugins/
  ix-plugin.ts       — plugin entry point, tool and hook registration

opencode.json        — plugin manifest
AGENTS.md            — this file (always-on guidance)
```

---

## Command Format

```markdown
---
name: ix-<name>
description: <one-line description>
---

<reasoning protocol — not a command list>
```

`$ARGUMENTS` = user input after the command name.

### Writing a good command

A valid command:
- Has **phases with stop conditions** (stop when answer is sufficient)
- **Scales depth with risk** (low-risk = fewer queries)
- **Reads code last** and only at symbol level
- Produces **structured output** (Summary, Findings, Evidence, Next Step)
- Is a **capability**, not a CLI alias

An invalid command:
- Maps 1:1 to a CLI command
- Has no conditional logic or stop conditions
- Reads full files or too much code
- Outputs raw command results

---

## ix CLI Quick Reference

| Task | Command |
|---|---|
| Architecture overview | `ix subsystems --format json` |
| Structural summary | `ix overview <name> --format json` |
| Understand a symbol | `ix explain <symbol> --format json` |
| Find definition | `ix locate <symbol> --format json` |
| Read one symbol's source | `ix read <symbol> --format json` |
| Trace call chain | `ix trace <symbol> --format json` |
| Who calls it | `ix callers <symbol> --format json` |
| Members of a class | `ix contains <symbol> --format json` |
| Upstream dependents | `ix depends <symbol> --depth 2 --format json` |
| Blast radius | `ix impact <target> --format json` |
| List entities in path | `ix inventory --kind function --path <dir> --format json` |
| Text search | `ix text <pattern> --limit 20 --format json` |
| Code smells | `ix smells --format json` |
| Rank key components | `ix rank --by dependents --kind class --top 10 --format json` |
| Refresh graph | `ix map --silent` |

`ix rank` requires `--by` and `--kind`.
