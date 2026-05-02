---
name: review-fanout
description: >-
  After all batches are green, evaluate reviewer predicates against the diff, load
  only matching reviewer bodies, run each matched reviewer in parallel, and aggregate
  findings into docs/findings.json with P1/P2/P3 priorities. Picks 3–5 reviewers
  by predicate match. An empty diff produces no fanout; a reviewer with always: true
  always fires regardless of diff content.
inputs:
  diff: "the unified diff produced after all batches merge"
  slice_dag: "docs/plan.slices.yml — slice list with touched_paths globs (for in_scope computation)"
  reviewer_index: ".substrate/reviewers/INDEX.md — eagerly loaded; individual reviewer bodies loaded lazily for matches only"
outputs:
  findings: "docs/findings.json — findings schema §2; each finding includes id, reviewer, priority (P1/P2/P3), in_scope, title, description, and optional location, reproducer, suggested_fix"
substrate_access:
  pattern: eager_then_lazy
  reads:
    - .substrate/reviewers/INDEX.md
  on_demand: individual reviewer body files (.substrate/reviewers/<id>.md) — loaded only when the reviewer's predicate matches the diff
---

## Summary

Triggered after all batches are green and the merged diff is available. Eagerly reads the reviewer INDEX.md (index layer only). Evaluates each reviewer's predicate against the diff using the predicate DSL (leaf: `paths`, `new_files_in`, `diff_contains`, `always`; composites: `any`, `all`, `not`). Loads body files only for matching reviewers. Runs matched reviewers in parallel (3–5 cap). Aggregates findings into `docs/findings.json` conforming to findings schema §2. Computes `in_scope` per finding. Respects each reviewer's `priority_floor`.

## Procedure

### Step 1 — Guard: check for empty diff

Before loading any substrate, inspect the diff:

- If the diff is empty (no changed lines), output:

  ```
  No diff present — review-fanout skipped.
  ```

  Do not proceed further. No `docs/findings.json` is written.

- If the diff is non-empty, continue to Step 2.

### Step 2 — Load the reviewer index (eager)

Read `.substrate/reviewers/INDEX.md` in full.

Do not open any individual reviewer body files yet. The index contains the human-readable "Fires on" column as a hint, but the authoritative predicate lives in each reviewer's body frontmatter — do not evaluate predicates from the index summary alone.

Record the list of all reviewers: their `ID` and `Path` fields. This is the candidate set.

### Step 3 — Evaluate predicates

For each reviewer in the candidate set, evaluate whether its predicate matches the diff. To evaluate a reviewer's predicate:

1. Open the reviewer's body file (e.g., `.substrate/reviewers/<id>.md`) to read its YAML frontmatter.
2. Extract the `predicate:` field.
3. Evaluate the predicate against the diff using the rules below.
4. If the predicate evaluates to `true`, mark the reviewer as **matched**. If `false`, discard the reviewer — do not load its body further.

**Predicate evaluation rules:**

Leaf forms:

- `paths: [glob, ...]` — evaluates to `true` if any file path present in the diff (both added and modified files) matches any of the listed globs. Use standard glob matching (`**` matches any path segment, `*` matches within one segment).
- `new_files_in: [glob, ...]` — evaluates to `true` if any newly-added file in the diff (status: added, not modified) matches any of the listed globs.
- `diff_contains: [substring, ...]` — evaluates to `true` if the full diff text contains any of the listed literal substrings.
- `always: true` — evaluates to `true` unconditionally, regardless of diff content.

Composite forms (recursive; operands are themselves predicates):

- `any: [pred, ...]` — evaluates to `true` if at least one operand evaluates to `true`.
- `all: [pred, ...]` — evaluates to `true` if all operands evaluate to `true`.
- `not: pred` — evaluates to `true` if the operand evaluates to `false`.

Evaluate leaf forms first, then compose. Composites may nest arbitrarily.

### Step 4 — Select reviewers (3–5 cap)

Collect all matched reviewers from Step 3. If none match, output:

```
No reviewers matched the current diff — docs/findings.json written with an empty findings array.
```

Write `docs/findings.json` with `{"findings": []}` and stop.

If more than 5 reviewers match, select the top 5 by this priority order:

1. Reviewers with `priority_floor: P1` first (highest impact).
2. Then reviewers with `priority_floor: P2`.
3. Then reviewers with no `priority_floor` or `priority_floor: P3`.
4. Within each tier, preserve the order they appear in INDEX.md.

If 3 or fewer reviewers match, use all of them. Do not pad to reach 3 — the cap is an upper bound, not a minimum.

### Step 5 — Run matched reviewers in parallel

For each selected reviewer, run its review against the diff in parallel. Each reviewer's body (already loaded in Step 3) declares its brief identity and checklist — use that to drive the review.

For each reviewer:

1. Read the reviewer's full body (the body was fetched in Step 3; do not re-fetch).
2. Apply the reviewer's brief identity and checklist to the diff.
3. Emit 0 or more findings. Each finding must have:
   - `id`: `fnd-<reviewer-id>-<NNN>` (three-digit sequence, e.g. `fnd-security-sentinel-001`)
   - `reviewer`: the reviewer's ID slug
   - `priority`: one of `P1`, `P2`, `P3`
   - `in_scope`: computed in Step 6
   - `title`: imperative-verb phrasing, ≤120 chars
   - `description`: 1–3 paragraphs; include a reproducer if available
   - `location` (optional): `{path, line_start, line_end}` when the finding is location-bound
   - `reproducer` (optional): code or steps that reproduce the finding
   - `suggested_fix` (optional): reviewer's actionable suggestion

4. Apply `priority_floor`: if a reviewer has `priority_floor: P1`, it may only emit `P1` findings. If `priority_floor: P2`, it may emit `P1` or `P2` findings. If `priority_floor: P3` or absent, it may emit any priority. Drop any finding whose `priority` is below the reviewer's `priority_floor` — do not include it in the output.

### Step 6 — Compute in_scope for each finding

After all reviewers emit their findings, compute the `in_scope` boolean for each finding that has a `location.path`:

- Read `docs/plan.slices.yml` (the slice DAG).
- For each finding with a `location.path`:
  - Set `in_scope: true` if `location.path` matches any glob in any slice's `touched_paths` list.
  - Set `in_scope: false` otherwise.
- For findings without a `location.path` (not location-bound):
  - Set `in_scope: false`.

Use standard glob matching (same rules as predicate `paths` evaluation).

### Step 7 — Aggregate and write findings

Collect all findings from all matched reviewers after Step 6 completes. Sort findings:

1. P1 findings first, then P2, then P3.
2. Within each priority tier, preserve the order reviewers appear in INDEX.md (findings from earlier-indexed reviewers first).
3. Within one reviewer, preserve the order the reviewer emitted them.

Ensure all `id` values are unique across the aggregated list. If two reviewers happen to produce conflicting ids, append a disambiguator (e.g., `-a`, `-b`).

Write `docs/findings.json`:

```json
{
  "findings": [
    {
      "id": "fnd-<reviewer-id>-001",
      "reviewer": "<reviewer-id>",
      "priority": "P1",
      "in_scope": true,
      "location": {
        "path": "src/auth/login.ts",
        "line_start": 42,
        "line_end": 58
      },
      "title": "Sanitize user input before passing to SQL query",
      "description": "The login handler passes `req.body.username` directly into a template string used in a SQL query. An attacker can inject arbitrary SQL.\n\nReproducer: POST /login with username `' OR 1=1 --`.",
      "reproducer": "curl -X POST /login -d 'username=\\' OR 1=1 --&password=x'",
      "suggested_fix": "Use parameterized queries: `db.query('SELECT * FROM users WHERE username = $1', [req.body.username])`."
    }
  ]
}
```

If there are no findings after applying priority floors, write `{"findings": []}`.

Confirm the path `docs/findings.json` to the user and state the finding count by priority (e.g., "2 P1, 3 P2, 0 P3").

## Constraints

- Never load a reviewer body before evaluating its predicate from the index — index first, body only on match.
- Never run more than 5 reviewers in one fanout. Cap selection by the priority-tier rule in Step 4.
- Never emit findings below a reviewer's `priority_floor`. Drop them silently.
- An empty diff must stop immediately (Step 1) — no substrate reads, no findings written.
- A reviewer with `always: true` in its predicate fires on every non-empty diff.
- `in_scope` must be computed from glob matching against the actual `touched_paths` from `docs/plan.slices.yml`, not from the reviewer's predicate paths.
- All `id` values in `docs/findings.json` must be unique and match the pattern `^fnd-[a-z0-9]+(-[a-z0-9]+)*$`.
- The output file is JSON (findings are machine artifacts consumed by downstream phases). Do not write findings in Markdown or YAML.
- Do not resolve findings. Resolving is the concern of `resolve-finding`.
- Do not modify reviewer entries. Reviewer roster management is the concern of `consolidate`.
