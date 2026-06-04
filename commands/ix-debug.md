---
name: ix-debug
description: Root cause analysis — trace execution path to a failure, narrow candidates, read minimal source only at suspected failure points.
argument-hint: <symptom, failing function, or suspected component>
---

Check `command -v ix` first. If unavailable, use Grep + Read as fallback.

## Pro check (optional)

Run once at the start:
```bash
ix briefing --format llm 2>&1
```
If it returns JSON with a `revision` field, Pro is available. Extract `openBugs` and `recentDecisions` for use in Pro steps below. If it errors, skip all **[Pro]** labeled steps.

**[Pro]** If `openBugs` is non-empty, scan for a known bug matching this symptom before proceeding. If found, surface it immediately — an existing bug record may already have candidates or a fix.
**[Pro]** If `recentDecisions` is non-empty, scan for recent decisions or context that might explain the symptom. Surface any relevant match before continuing.

## Goal

Answer: *where in the execution path is this likely failing, and why?* Stop once you have 1–3 root cause candidates with supporting evidence.

## Phase 1 — Locate the entry point (always)

```bash
ix locate $ARGUMENTS --format llm
```

If `$ARGUMENTS` is a symptom description rather than a symbol name, also run:
```bash
ix text "$ARGUMENTS" --limit 10 --format llm
```

Identify the most likely entry point (where the failure originates or first manifests).

## Phase 2 — Explain (always)

```bash
ix explain <entry-point> --format llm
```

Extract: role, callers, callees, confidence. Identify whether this is:
- A **boundary** (external input, API, event) — failure likely from unexpected input
- An **orchestrator** — failure likely from wrong sequencing or state
- A **utility/helper** — failure likely from wrong assumptions by caller

**Stop if:** the explanation makes the failure source obvious → skip to Output.

## Phase 3 — Trace the execution path

```bash
ix trace <entry-point> --downstream --format llm
```

Walk the downstream path. At each step, look for:
- Functions that validate or transform state (potential incorrect assumptions)
- Cross-subsystem calls (where contracts might differ)
- Functions with high callee count (potential god functions, many failure points)

**Narrow:** Identify the 1–3 nodes most likely to contain the bug.

**Stop if:** trace reveals an obvious candidate.

## Phase 4 — Callers (if failure might come from upstream)

```bash
ix callers <entry-point> --limit 10 --format llm
```

Check whether the fault is in how this is *called* rather than in its own logic.

## Phase 5 — Targeted code read (only at suspected failure points)

For each root cause candidate (max 2):
```bash
ix read <candidate-function> --format llm
```

Read **the specific function only**. Look for:
- Edge cases in input handling
- Assumptions about state that might be violated
- Missing null/error checks
- Incorrect sequencing

**Hard limit:** 2 `ix read` calls maximum. If still ambiguous, surface the candidates and uncertainty to the user.

## Phase 6 — Bug log suggestion **[Pro]**

If Pro is available and this appears to be a new bug:
```bash
ix bug create "<symptom title>" --severity <low|medium|high|critical> --affects <entry-point>
```
(Only suggest — do not run automatically.)

## Output

```
## Debug: [entry point]

**Execution path:**
[entry-point] → [step] → [step] → [suspected failure point]

**Root cause candidates:**
1. [function/file] — [reason: what assumption might be wrong]
2. [function/file] — [reason]

**Evidence:**
- [what graph data supports each candidate]
- [what code read revealed, if any]

**Confidence:** [high / medium / low] — [why]

**Next steps:**
- Add logging at [specific point] to confirm
- Check [specific edge case] in [function]
- Run `/ix-investigate <X>` to understand [unclear component] more deeply

**[Pro]** If this is a new bug, log it with `ix bug create`.
```
