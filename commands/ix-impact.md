---
name: ix-impact
description: Change risk analysis — blast radius, affected systems, and what to test. Depth scales with risk level; low-risk targets stop early.
argument-hint: <symbol or file>
---

Check `command -v ix` first. If unavailable, use Grep to find all usages and estimate impact manually.

## Pro check (optional)

Run once at the start:
```bash
ix briefing --format json 2>/dev/null; echo "exit=$?"
```
Read the exit code, not the wording:
- `exit=0` and a JSON object: Ix Pro is available. Use `openBugs` from it in the **[Pro]** steps below. A field may be empty or `null`.
- non-zero exit and nothing else on stdout: Ix Pro is not installed. Without Pro, `ix` answers every Pro command with "requires Ix Pro" on stderr and exit 1. That is the normal answer, not an error: skip every **[Pro]** step and do not mention it.
- non-zero exit and a JSON error record (`{"error": ..., "message": ...}`): Pro is installed but could not answer. Skip the **[Pro]** steps and say so in one line, quoting `message`.

## Goal

Answer: *what breaks if this changes, and is it safe to proceed?* Stop as early as the risk level allows.

## Phase 1 — Risk score (always)

```bash
ix impact $ARGUMENTS --format llm
```

**Immediately classify:**

| Risk level | Action |
|---|---|
| `low` + < 3 dependents | **STOP** — safe to proceed. Report and suggest verification targets. |
| `medium` OR 3–10 dependents | Go to Phase 2 |
| `high` or `critical` OR > 10 dependents | Go to Phase 2 + 3 |

## Phase 2 — Callers and dependents (medium/high/critical)

Run in parallel:
```bash
ix callers  $ARGUMENTS --limit 20 --format llm
ix depends  $ARGUMENTS --depth 2 --format llm
```

Extract: direct callers by name and subsystem, transitive count.

**Stop here if risk is `medium`:** report callers, suggest verification, done.

## Phase 3 — Import chain and subsystem spread (high/critical only)

```bash
ix imported-by $ARGUMENTS --format llm
```

Cross-reference callers + dependents + importers to identify:
- Which subsystems are in the blast radius
- Whether the change crosses an architectural boundary
- Any tests that cover the affected paths

## Phase 4 — Known bugs in blast radius **[Pro]**

If Pro is available and `openBugs` from the briefing is non-empty, check for bugs affecting this target (Ix Pro only):
```bash
ix bug list --format text
```
Cross-reference open bugs against the direct callers and dependents identified in Phase 2. Any open bug touching the blast radius escalates the risk verdict — flag it explicitly in the output.

Never read source code in this skill. Risk analysis is purely graph-based.

## Output

```
## Impact: [target]

**Risk level:** <critical | high | medium | low>
**Verdict:** <SAFE TO PROCEED | REVIEW CALLERS FIRST | NEEDS CHANGE PLAN>

**Blast radius:**
- Direct dependents: N
- Transitive (depth 2): M
- Subsystems affected: [list — only if phase 3 ran]

**Key callers:** [top 5, with subsystem label]

**At-risk behaviors:** [from ix impact atRiskBehavior field]

**Recommended action:**
- low: proceed, verify [specific callers]
- medium: test [caller list] after change
- high/critical: run `/ix-plan $ARGUMENTS` before editing

**Known bugs in blast radius:** [Pro only — list open bugs touching callers/dependents, or omit section if none/Pro unavailable]
```
