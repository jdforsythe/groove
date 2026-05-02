---
name: harvest
description: >-
  On workflow exit, read the workflow trace and substrate indexes lazily, identify
  real signal (recurring deferral, novel ADR, new anti-pattern, reusable solution,
  new vocabulary term), and write 0–4 substrate entries via substrate-write. Refuses
  to write when nothing meaningful surfaced. On a failed-gate workflow, writes the
  rejection reason as an anti-pattern or ADR. Invoke when a workflow is about to exit.
inputs:
  workflow_trace: "docs/harvest/<workflow_id>.md — workflow-doc frontmatter (type: harvest) + outcome block + signals observed section"
  issues_filed: "docs/issues-filed.json — array of filed issues per issues-filed schema §3; read to detect recurring deferral categories"
outputs:
  substrate_entries: "0–4 entries written to .substrate/<type>/<id>.md via substrate-write; entry count driven by signal present, not by policy"
substrate_access:
  pattern: lazy
  reads:
    - ".substrate/vocabulary/INDEX.md  # read only when checking for id collision or index relevance"
    - ".substrate/adr/INDEX.md         # read only when checking for id collision or index relevance"
    - ".substrate/anti-pattern/INDEX.md  # read only when checking for id collision or index relevance"
    - ".substrate/solution/INDEX.md    # read only when checking for id collision or index relevance"
    - "docs/issues-filed.json          # always read to detect recurring deferral categories"
  on_demand: "Entry bodies fetched via substrate-read only when a signal might duplicate an existing entry and the index description is ambiguous"
  writes: "All substrate writes go through substrate-write; no direct file I/O"
---

## Summary

Triggered on workflow exit. Reads the workflow trace and `docs/issues-filed.json`. Scans for four signal types: encountered or invented vocabulary term, non-obvious architectural decision (ADR), mistake to avoid (anti-pattern), or reusable solution pattern. Also checks for recurring deferral categories across `issues-filed.json`. Writes 0–4 entries via `substrate-write`. If nothing meaningful surfaced, writes zero entries and reports the explicit no-signal decision. On failed-gate traces, writes the rejection reason as an ADR or anti-pattern so the failure becomes a future lesson.

## Procedure

### Step 1 — Verify the workflow trace exists

Check that `docs/harvest/<workflow_id>.md` exists.

If the file does not exist, stop immediately and output:

```
Cannot start harvest: no workflow trace found at docs/harvest/<workflow_id>.md.
The workflow trace must be written before invoking harvest.
```

Do not proceed.

### Step 2 — Read the workflow trace

Read `docs/harvest/<workflow_id>.md` in full. Extract:

- **Outcome** — the `outcome` field in the workflow outcome block: `completed`, `killed`, or another terminal state.
- **Gate results** — which gates passed and which were rejected (gate_a, gate_b, gate_c).
- **Gate rejection reason** — the `gate_a_rejection_reason` (or equivalent) if any gate was rejected. This is the source for a failed-gate substrate entry.
- **Signals observed section** — the full `## Signals observed` section, which narrates what the workflow surfaced.
- **Issues filed reference** — whether the trace references `docs/issues-filed.json` and notes any deferred findings.

### Step 3 — Read issues-filed.json

Read `docs/issues-filed.json`. If the file is absent or empty (`[]`), there are no deferred findings to analyze. If entries are present:

1. Group entries by label. The `labels_applied` array on each entry carries the category label (e.g., `security`, `performance`, `architecture`).
2. For each label group, count entries where `dedup` is `false` (new issues filed, not duplicates).
3. If any label group has **3 or more** non-dedup entries across the full file history, that label represents a recurring deferral category. Record it as a candidate for an anti-pattern write.

The recurring-deferral threshold is 3. Fewer than 3 deferrals in a category are not yet a pattern.

### Step 4 — Read the substrate indexes lazily

Read all four substrate indexes — index layer only, no bodies:

- `.substrate/vocabulary/INDEX.md`
- `.substrate/adr/INDEX.md`
- `.substrate/anti-pattern/INDEX.md`
- `.substrate/solution/INDEX.md`

Do **not** open any entry body files at this stage. Use the index descriptions only to:

- Check whether a candidate entry id would collide with an existing entry.
- Determine whether a candidate entry covers ground that already exists in the index.

If an index entry's description is ambiguous relative to a candidate signal — meaning you cannot determine from the description alone whether the existing entry and the new signal cover the same ground — call `substrate-read` to fetch that entry's body and resolve the ambiguity. Fetch bodies only when necessary.

### Step 5 — Identify signals

Assess the workflow trace against the four signal types. For each type, apply the falsifiable trigger:

#### Signal type 1 — Vocabulary

**Trigger:** A domain-specific term was used consistently across multiple slices, reviewers, or discussions during the workflow, and the term is not yet in the vocabulary index, or the existing definition is ambiguous or incorrect.

**Threshold:** The term must be project-specific — not a general programming term — and must have been used in a way that would cause confusion if a future agent encountered it without a definition.

**Write:** one vocabulary entry.

#### Signal type 2 — ADR

**Trigger:** A non-obvious architectural or design decision was made during the workflow that is not already captured in the ADR index. "Non-obvious" means a future agent or developer could make a different choice and not know why it was wrong. Obvious choices (use a widely-known library for its primary purpose) do not qualify.

Also triggers when a gate rejection reason identifies an architectural constraint that future plans must respect.

**Threshold:** The decision must constrain future work — it must have consequences for slices not yet written.

**Write:** one ADR entry (status: accepted).

#### Signal type 3 — Anti-pattern

**Trigger:** A mistake was made and caught during the workflow (by a reviewer finding or during implementation), or a recurring deferral category was detected in `issues-filed.json` (3 or more non-dedup entries for the same label).

**Threshold for mistake:** The mistake must be non-obvious — not a typo or mechanical error — and must be the kind of thing a future GREEN agent could make in the same area.

**Threshold for recurring deferral:** 3 or more non-dedup entries for the same label in `issues-filed.json`.

**Write:** one anti-pattern entry. Scope to the touched paths where the mistake occurred.

#### Signal type 4 — Solution

**Trigger:** A reusable problem-solution pattern emerged during the workflow — a specific approach to a recurring problem that another team member or agent could apply directly to a future slice.

**Threshold:** The solution must be specific and transferable — not a general best practice. It must be concrete enough that a future slice could cite it directly.

**Write:** one solution entry with `tags` and `scope`.

### Step 6 — Apply the 4-entry cap and prioritize

Count the candidate entries from Step 5. If 4 or fewer, proceed to Step 7 with all candidates.

If more than 4 candidates were identified:

**Priority order (highest to lowest):**

1. Failed-gate rejection reason (ADR or anti-pattern) — always included if present.
2. Recurring deferral anti-pattern (detected from `issues-filed.json`).
3. ADR — non-obvious decisions that constrain future work broadly.
4. Anti-pattern — mistakes caught during implementation or review (P1 findings first).
5. Solution — directly reusable patterns.
6. Vocabulary — terms needed for disambiguation.

Within the same priority tier, prefer the signal that touches the broadest scope or has the most downstream impact.

Discard the lowest-priority candidates until exactly 4 remain. Record the discarded signals in the output report so the user can decide whether to harvest them manually.

**Hard rule:** Never write more than 4 entries. The cap is unconditional.

### Step 7 — Check for no-signal condition

If Step 5 produced zero candidate entries and Step 3 produced no recurring deferrals and the trace has no failed-gate rejection reason:

Output the no-signal message and stop:

```
No signal found in workflow trace <workflow_id>. Zero substrate entries written.
```

Do not call `substrate-write`. Do not write or modify any file.

### Step 8 — Write entries via substrate-write

For each candidate entry (up to 4), call `substrate-write` with the following inputs:

- `type`: the substrate type for this entry (`vocabulary`, `adr`, `anti-pattern`, `solution`).
- `frontmatter`: a YAML object with all required fields per `schemas-and-conventions.md §4`. Required for all types: `id` (kebab-case), `type`, `description` (≤200 chars), `created` (today's date in `YYYY-MM-DD`). Additional fields by type:
  - `adr`: `status: accepted` (the constraint is accepted going forward).
  - `anti-pattern`: `scope` (non-empty array of globs covering the paths where the pattern applies).
  - `solution`: `scope` (non-empty array of globs) and `tags` (non-empty array of tag strings).
- `body`: a Markdown string. Must open with a `## Summary` block of ≤5 non-blank lines. Follow the body conventions per `schemas-and-conventions.md §4`:
  - **ADR**: sections `## Summary`, `## Context`, `## Decision`, `## Alternatives considered`, `## Consequences`.
  - **Anti-pattern**: must include the rule (`never X`), the reason (`because Y`), and a positive example.
  - **Solution**: sections `## Problem`, `## Approach`, `## References`.
  - **Vocabulary**: `## Summary` (the definition), then `## Definition` or prose body.

Do not call `substrate-write` if `substrate-write` would reject the entry (e.g., id collision). If a collision is detected, either generate a distinct id or skip that entry and report the skip to the user.

Write all entries. Do not stop after the first success.

### Step 9 — Report

After all writes complete, output a summary:

```
harvest complete for workflow <workflow_id>.

Entries written (<N>):
  - <type>/<id>: <description>
  - <type>/<id>: <description>
  ...

<If candidates were discarded due to the 4-entry cap:>
Discarded (exceeded 4-entry cap):
  - <signal summary>  — harvest manually if needed
```

If zero entries were written, the no-signal message from Step 7 is the complete output.

## Constraints

- **Never exceed 4 substrate entries per workflow.** The cap is unconditional and is not a target — write fewer when signal is sparse.
- **Never write when no signal exists.** The no-signal check (Step 7) is mandatory. Do not add noise to the substrate.
- **All writes go through substrate-write.** Never write directly to `.substrate/` files or indexes. If `substrate-write` rejects an entry, report the rejection to the user and skip that entry.
- **Substrate indexes are read lazily.** Load indexes only to check for id collisions or ambiguous overlaps. Never pre-load bodies. Fetch a body via `substrate-read` only when an index description is ambiguous relative to a candidate signal.
- **Failed-gate rejection reasons must be written.** If the workflow was killed at a gate, the rejection reason is always a substrate entry (ADR or anti-pattern, depending on whether the reason describes an architectural constraint or a mistake to avoid). Do not discard it in the cap prioritization.
- **Recurring deferral threshold is 3.** Fewer than 3 non-dedup deferred findings for a label do not produce a write.
- **Entry ids must be kebab-case and unique within the substrate type.** If a candidate id collides with an existing entry, generate a distinct id or skip the entry with a report.
- **Never mention Yoke or any specific harness.**
- **Today's date** for `created` fields is the date on which harvest runs — use the current date, not the workflow creation date.
