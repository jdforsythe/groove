---
name: verify-vs-plan
description: >-
  Fresh-context drift check: compare delivered code against the plan's slices and
  acceptance criteria. Fires after all findings are resolved. Produces a per-slice
  PASS/FAIL/DRIFT verdict report at docs/verification/<workflow_id>.md.
inputs:
  plan_doc: "docs/plans/<workflow_id>.md — workflow-doc frontmatter (type: plan) + slice list"
  delivered_diff: "The diff of all code delivered across the workflow (git diff or equivalent)"
context_requirement: fresh  # MUST run in a fresh agent context — no builder conversation in scope
outputs:
  verification_doc: "docs/verification/<workflow_id>.md — workflow-doc frontmatter (type: verification) + ## Summary block (≤5 lines) + per-slice verdict table"
substrate_access:
  pattern: none
  reads: []
  on_demand: "None — this skill does not access substrate"
---

## Summary

Triggered after all findings from `review-fanout` / `resolve-finding` are resolved. Runs in a **fresh agent context** — the verifier must not have any builder conversation in scope. Reads the plan from `docs/plans/<workflow_id>.md` and the delivered code (via diff or direct file reads). For each slice, evaluates every acceptance criterion and assigns a verdict: **PASS**, **FAIL**, or **DRIFT**. DRIFT means the criterion is met in spirit but the implementation diverges from what the plan specified. Never modifies code. Writes `docs/verification/<workflow_id>.md`.

## Procedure

### Step 0 — Context purity check

Before reading any artifact, confirm that this is a fresh context — no builder conversation, no prior tool outputs from the implementation session, are in scope.

If the context is not fresh (e.g., a prior conversation about implementation is loaded), stop and output:

```
Cannot start verify-vs-plan: context is not fresh.
This skill must run in a new agent context without the builder's conversation in scope.
Start a new session and invoke verify-vs-plan there.
```

Do not proceed.

### Step 1 — Verify inputs

Check that the plan document exists at `docs/plans/<workflow_id>.md`.

If the file is absent, stop and output:

```
Cannot start verify-vs-plan: plan doc not found at docs/plans/<workflow_id>.md.
Run plan-synth first, or pass the correct workflow_id.
```

Do not proceed.

### Step 2 — Read the plan

Read `docs/plans/<workflow_id>.md` in full. Extract:

- **`workflow_id`** — from the frontmatter field
- **`description`** — the plan's one-line summary
- **Slice list** — the full YAML slice list from the `## Slices` section

For each slice, record:

- `id` — the slice's stable identifier
- `title` — the slice's title
- `acceptance_criteria` — the full list of criteria (each is a test-in-prose statement)
- `touched_paths` — the globs the slice was planned to touch
- `out_of_scope` — the YAGNI guards

Do not summarize or paraphrase the acceptance criteria — copy them verbatim. Verdict accuracy depends on reading the exact words the plan used.

### Step 3 — Read the delivered code

Obtain the delivered code for each slice. Use the following strategy, in order:

1. **Diff first**: if a diff is provided (e.g., `git diff main...HEAD` or equivalent), read it in full.
2. **File reads for touched paths**: for each slice's `touched_paths` globs, read the current state of those files if they exist. This catches additions and the full context of changes that the diff may truncate.

Do not rely on memory, prior conversations, or any builder-provided summary. Read the code directly.

### Step 4 — Evaluate each slice

For each slice, evaluate every acceptance criterion against the delivered code. Assign one of three verdicts per criterion:

#### PASS

The criterion is met. The delivered code satisfies the observable behavior described in the criterion, and the implementation approach is consistent with what the plan described.

Evidence required: a code location (file path + line or function) where the criterion is satisfied.

#### FAIL

The criterion is not met. The delivered code does not satisfy the observable behavior described in the criterion.

Evidence required: a code location (or explicit absence of code) that demonstrates the failure. State what is missing or broken.

#### DRIFT

The criterion is met in spirit — the observable behavior is present — but the implementation diverges meaningfully from what the plan specified. The code does something different than the plan said it would do to achieve the criterion.

Evidence required:
- A code location showing what the code does
- An explicit description of the drift: **"Plan said: `<exact or paraphrased plan text>`; Code does: `<what the code actually does>`"**

DRIFT is not a failure of behavior. DRIFT is a signal that the plan-to-implementation mapping has shifted and the plan may need to be updated, or a future plan should use a different specification style.

#### Slice-level verdict

After evaluating all criteria for a slice, assign the slice a rollup verdict:

- **PASS** — all criteria are PASS
- **DRIFT** — all criteria are PASS or DRIFT, and at least one is DRIFT
- **FAIL** — at least one criterion is FAIL (regardless of others)

### Step 5 — Check for out-of-scope violations

For each slice, check whether the delivered code implements anything listed in the slice's `out_of_scope` list. If so, note it as a **scope violation** in the verification report. Scope violations are informational — they do not change the slice verdict — but they are important signals for the harvest phase.

### Step 6 — Write the verification doc

Create `docs/verification/` if it does not exist. Write `docs/verification/<workflow_id>.md` with the following structure:

```markdown
---
id: <workflow_id>
type: verification
description: <one-line summary, e.g. "Verification of <plan description>", ≤200 chars>
created: <YYYY-MM-DD>
workflow_id: <workflow_id>
---

## Summary

<≤5 lines: overall verdict (counts of PASS/FAIL/DRIFT slices), any critical failures, whether the plan is substantially satisfied, and what a reader should do next>

## Verdicts

### <slice-id>: <slice-title>

**Slice verdict: PASS | FAIL | DRIFT**

| Criterion | Verdict | Evidence |
|---|---|---|
| <criterion text> | PASS | `path/to/file.ts:42` — `functionName()` satisfies this criterion |
| <criterion text> | DRIFT | `path/to/file.ts:87` — Plan said: `<plan text>`; Code does: `<what code does>` |
| <criterion text> | FAIL | `path/to/file.ts` — Function not found; no implementation of <behavior> exists |

<If scope violations exist for this slice:>

**Scope violations:**
- `<out_of_scope item>` — implemented at `path/to/file.ts:N`

---

(repeat for each slice)

## Overall Result

**<PASS | FAIL | DRIFT>** — <one sentence: e.g., "2 of 3 slices pass fully; 1 slice has drift in the caching layer; no failing criteria.">
```

The `id` and `workflow_id` fields must match the plan doc's `workflow_id`. The `created` date is today's date.

### Step 7 — Confirm output (report only)

After writing the verification doc, confirm the path to the user.

State clearly: **the verifier does not modify code**. If any FAIL or DRIFT verdict requires action, the appropriate next step is `resolve-finding` (for FAIL) or a plan update (for DRIFT), initiated by the developer or the harness. This skill only reports.

## Constraints

- **Fresh context is mandatory.** This skill must not run with any builder conversation in scope. If context purity cannot be confirmed, refuse immediately (Step 0).
- **Never modify code.** The verifier is report-only. No file writes except the verification doc.
- **No substrate access.** This skill does not read or write substrate. Substrate signal from this workflow is harvested by `harvest`, not here.
- **Copy acceptance criteria verbatim.** Do not paraphrase or summarize criteria when evaluating them — verdict accuracy depends on the exact words the plan used.
- **DRIFT requires explicit description.** A DRIFT verdict without "Plan said: X; Code does: Y" is invalid. Write both sides.
- **Evidence is required for every verdict.** PASS, FAIL, and DRIFT all require a code location. Unsupported verdicts are not acceptable.
- **Scope violations are informational.** They do not change slice verdicts, but they must be recorded if present.
- **Output path is fixed.** The verification doc is always written to `docs/verification/<workflow_id>.md`. Do not vary this path.
- **Never mention any specific harness.**
