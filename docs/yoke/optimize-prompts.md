# Yoke prompt files for the Groove `optimize.yml`

This file contains all 10 prompts referenced by the Groove optimize pipeline. Each section is one file. Split at the `===== FILE: <name> =====` markers; the file should land at `.yoke/prompts/<name>` exactly as listed.

Each prompt invokes a named skill from the **Groove skill pack**. Wire that pack into your Claude Code session via plugin or local skill directory before running the workflow.

Conventions used in every prompt:
- The active skill name from the Groove skill pack is named explicitly.
- Eager-loaded substrate is listed first (read these BEFORE doing anything else).
- Lazy-loaded substrate is referenced by its index — fetch bodies only when needed.
- Stop conditions are explicit. Anti-patterns are explicit. No flattery, no role inflation.
- Workflow-scoped artifacts live in `docs/`. Project knowledge lives in `.substrate/`.
- **This workflow must run in its own worktree.** Optimize touches code outside any single feature's blast radius. Never run it inside an active feature worktree.

---

===== FILE: clarify.md =====

# Phase: clarify

You are running the `clarify` skill from the Groove skill pack.

## What you must do

1. Read eager substrate first: `.substrate/vocabulary/INDEX.md`, `.substrate/adr/INDEX.md`, `.substrate/anti-patterns/INDEX.md`. Indexes only — do not fetch bodies unless an entry's one-line description suggests it is highly relevant to the optimization goal below.

2. Apply the `clarify` skill: relentlessly interview the user about the optimization goal. One question per turn. For each question, provide your recommended answer. Walk down the decision tree, resolving dependencies between decisions one at a time. If a question can be answered by exploring the codebase or substrate bodies, explore instead of asking.

   Key questions to resolve for an optimize workflow:
   - What triggered this optimization run: cadence, post-feature cleanup, performance regression, or error tracker signal?
   - What input data is available: profiler output, production logs, `git log --stat` heuristics, error counts?
   - What improvement threshold counts as "done" for each target?
   - Are there any areas explicitly out of scope for this run?

3. When the user signals the brainstorm is complete, write `docs/brainstorm.md` with the standard frontmatter:

```yaml
---
id: <kebab-case-id-derived-from-title>
type: brainstorm
description: one-line summary of what is being optimized
created: <today>
tags: [optimization, topic, ...]
---
```

Followed by a `## Summary` block (≤5 lines) and the body, including an `## Input signals` section listing the profiler/log/heuristic data that motivated this run.

## Stop conditions

- Optimization trigger and input signals identified.
- Success criteria agreed.
- User signals "ready for research."
- 20 questions answered. Past this, consolidate and exit.

## Anti-patterns

- Asking multiple questions in one turn.
- Failing to provide a recommended answer with each question.
- Skipping substrate read.
- Starting without identifying the input signal that motivated the run.

---

===== FILE: research.md =====

# Phase: research

You are running the `research` skill from the Groove skill pack.

## What you must do

1. Read `docs/brainstorm.md`. Note the optimization trigger and input signals.

2. Read substrate indexes lazily: `.substrate/adr/INDEX.md`, `.substrate/solutions/INDEX.md`. Search for entries relevant to performance, the affected subsystems, or past optimization runs. Fetch bodies for directly applicable entries.

3. Run three research threads in parallel (use the Task tool to dispatch subagents):
   - **Codebase patterns:** map the hot paths and debt areas identified in the input signals. Read relevant modules, identify the deep modules vs. shallow ones, and find the leverage points.
   - **Framework / library docs:** are there idiomatic optimization techniques for the frameworks in use? Known footguns in the affected area?
   - **Prior solutions:** has this area been optimized before? Any ADR explaining a past performance decision? Any solution documenting a benchmark approach?

4. Aggregate into `docs/research.md` with frontmatter and a `## Summary` block. Body sections: Codebase patterns / Framework guidance / Prior solutions / Optimization targets (candidate list) / Open questions.

## Stop conditions

- All three threads complete and aggregated.
- `## Optimization targets` section contains the candidate list that `plan-synth` will refine.

## Anti-patterns

- Skipping the parallel fan-out.
- Producing a research doc without an optimization target candidate list.
- Researching general performance theory instead of this codebase's specific hot paths.

---

===== FILE: plan-synth.md =====

# Phase: plan-synth

You are running the `plan-synth` skill from the Groove skill pack.

## What you must do

1. Read `docs/brainstorm.md` and `docs/research.md` in full. Note the optimization targets candidate list.

2. Read all four substrate indexes eagerly: vocabulary, ADR, anti-patterns, solutions. Fetch bodies of entries whose scope or tags match the optimization domain.

3. Synthesize the plan. Write two files:

   **`docs/plan.md`** — prose plan with frontmatter, summary block, and these sections:
   - Goal (one paragraph: what performance or quality threshold are we hitting?)
   - Approach (which targets, in what order, and why; references to ADRs/solutions consulted)
   - Optimization targets (one paragraph per target, naming each by id)
   - Out of scope (explicit YAGNI guards — what we are not changing in this run)

   **`docs/optimize-targets.yml`** — machine-readable target list. Same schema as `plan.slices.yml`:

   ```yaml
   targets:
     - id: kebab-case-stable
       title: one-line
       acceptance_criteria:
         - measurable improvement description
         - measurable improvement description
       touched_paths:
         - src/foo/**
         - test/foo/**
       semantic_depends_on: []   # filled by decompose phase
       out_of_scope:
         - explicit YAGNI guard
   ```

4. Each target must fit the schema. `acceptance_criteria` must be measurable (benchmark numbers, profiler counts, error rates). If a target cannot be expressed with measurable acceptance criteria, it is not ready — ask for the baseline measurement first.

## Stop conditions

- `docs/plan.md` and `docs/optimize-targets.yml` both exist.
- `validate-slices` passes on `docs/optimize-targets.yml`.
- Every acceptance criterion describes a measurable improvement.

## Anti-patterns

- Acceptance criteria without numbers ("faster" is not a criterion; "p95 latency < 200ms" is).
- Touching features that are not in the optimization target list.
- Mixing optimize targets with feature additions — this workflow ships improvements only.

---

===== FILE: decompose.md =====

# Phase: decompose

You are running the `decompose` skill from the Groove skill pack.

The deterministic file-overlap DAG was already derived (the `pre:` step ran `derive-file-dag` on `docs/optimize-targets.yml`). Your job is to add semantic edges that file overlap cannot detect.

## What you must do

1. Read `docs/optimize-targets.yml` — note the file-overlap edges already in `semantic_depends_on` for each target.

2. Read `.substrate/anti-patterns/INDEX.md`. Fetch bodies of entries scoped to "coupling" or to file paths that overlap any target's `touched_paths`.

3. For each pair of targets A and B (A earlier in topological order, NO file overlap), ask: does B require something B's measurements cannot establish without A's change?

4. If yes, append an edge to B's `semantic_depends_on` array with a `reason:` field.

5. **You may only add edges, never remove them.**

## Stop conditions

- `validate-slice-dag` passes on `docs/optimize-targets.yml`.
- Every semantic edge you added has a `reason` field.
- The DAG is acyclic.

## Anti-patterns

- Adding edges between unrelated targets for vague reasons.
- Removing or modifying file-overlap edges.
- Adding edges without reasons.
- Marking everything dependent on target 1 — over-sequencing defeats parallelism.

---

===== FILE: slice-impl.md =====

# Phase: slice-impl

You are running the `slice-impl` skill from the Groove skill pack.

This phase runs once per optimization target in fresh context. Target id is `$YOKE_ITEM_ID`; full record is the matching entry in `docs/optimize-targets.yml`.

## What you must do

1. Read the target record. Note `acceptance_criteria`, `touched_paths`, and `out_of_scope`.

2. Read scoped anti-patterns whose `scope` overlaps `touched_paths`. Eager-load.

3. Establish the baseline measurement for each acceptance criterion before making changes. Record baseline numbers in a code comment or local doc.

4. Apply the optimization. Write the minimum change that achieves the acceptance criteria. Do not refactor adjacent code that is not causing the measured issue. Do not add features.

5. Measure again. Confirm the acceptance criteria are met. If not, diagnose and iterate before exiting.

6. Run tests, lint, typecheck. All must pass.

## Stop conditions

- All tests pass.
- Lint clean. Typecheck clean.
- Acceptance criteria measurements meet the stated thresholds.
- Diff touches only `touched_paths`.

## Anti-patterns

- Optimizing without establishing a baseline first.
- Claiming criteria met without measurement.
- Touching files outside `touched_paths`.
- Adding feature code under the guise of optimization.
- Micro-optimizations that don't move the acceptance-criteria needle.

---

===== FILE: slice-refactor.md =====

# Phase: slice-refactor

You are running the `slice-refactor` skill from the Groove skill pack. **This phase is optional.** If the target is already clean, exit immediately with a "no refactor needed" note in the commit.

## What you must do

1. Tests are passing. Measurements meet acceptance criteria. Confirm before any change.

2. Look for refactor candidates introduced by the optimization:
   - Duplication that can be extracted.
   - Shallow modules that can be deepened.
   - Names that no longer match the project's vocabulary.

3. Apply at most ONE refactor. Run tests + lint + typecheck + re-measure after each change to confirm the optimization still holds.

4. Commit with `refactor: <target-id> - <what-and-why>`. If you exit without changes, commit with `refactor: <target-id> - none needed`.

## Stop conditions

- Tests still pass and acceptance criteria measurements still hold after the refactor.
- One refactor applied OR no refactor needed.

## Anti-patterns

- Refactoring while measurements no longer meet criteria.
- Multiple refactors in one phase.
- Adding feature code under the guise of refactor.
- Refactoring code outside the target's `touched_paths`.

---

===== FILE: review-fanout.md =====

# Phase: review-fanout

You are running the `review-fanout` skill from the Groove skill pack.

## What you must do

1. Read `.substrate/reviewers/INDEX.md`. Each reviewer entry has a one-line description, a path to its body, and a "fires when" predicate.

2. Compute the diff for this workflow (compare against the base branch). Identify which reviewer predicates match.

3. Pick the top 3–5 matching reviewers (cap at 5). Fetch each reviewer's body.

4. Run the matching reviewers in parallel via the Task tool. Each subagent reviews the diff against its specialty and returns findings.

5. For each finding, set: `id`, `reviewer`, `priority` (P1/P2/P3), `in_scope`, `location`, `title`, `description`.

6. Aggregate into `docs/findings.json`:

   ```json
   { "findings": [ { ... }, { ... } ] }
   ```

## Stop conditions

- 3–5 reviewers ran (or fewer if fewer predicates matched).
- Every finding has all required fields.
- `validate-findings` passes.

## Anti-patterns

- Running every reviewer regardless of predicate match.
- Findings without `in_scope` set.
- Rubber-stamp clearance with no explanation of what was checked.
- Severity inflation.

---

===== FILE: resolve-finding.md =====

# Phase: resolve-finding

You are running the `resolve-finding` skill from the Groove skill pack.

This phase runs once per finding (P1, plus in-scope P2). Finding id is `$YOKE_ITEM_ID`; full record is the matching entry in `docs/findings.json`.

## What you must do

1. Read the finding record. Note `location`, `description`, `priority`.

2. Read scoped anti-patterns whose `scope` overlaps the finding's `location`.

3. Apply the minimum fix that addresses the finding. Do not refactor adjacent code unless required.

4. If the description contains a reproducer, add a regression test.

5. Run tests, lint, typecheck. All must pass.

## Stop conditions

- Tests pass (including any regression test).
- Lint clean. Typecheck clean.
- Commit message: `fix: <finding-id> - <one-line>`.

## Anti-patterns

- Fixing more than the finding describes.
- Skipping the regression test when a reproducer is available.
- Treating a P2 like a P1.

---

===== FILE: file-issue.md =====

# Phase: file-issue

You are running the `defer-finding` skill from the Groove skill pack.

This phase runs once per deferred finding (out-of-scope P2 + all P3). Finding id is `$YOKE_ITEM_ID`; full record is in `docs/findings.json`.

## What you must do

1. Read the finding record. Note `priority`, `location`, `reviewer`, `title`, `description`, and `in_scope`.

2. **Dedup check.** Search existing GitHub issues:

   ```bash
   gh issue list --label "deferred-from-loop" --search "<short keyword from title>" --state open --json number,title,body
   ```

   If a clearly matching open issue exists, append to `docs/issues-filed.json` with the existing URL and a `dedup: true` flag. Exit.

3. **Create the issue.** Title, body (summary / location / reviewer / priority + deferral reason / suggested reproducer / workflow PR link), and labels (`deferred-from-loop`, `priority:<P2|P3>`, and appropriate category label).

4. **Record the URL.** Append to `docs/issues-filed.json`:

   ```json
   { "finding_id": "$YOKE_ITEM_ID", "url": "<gh-url>", "filed_at": "<iso-timestamp>", "dedup": false }
   ```

## Stop conditions

- Issue exists (created or deduped).
- URL recorded in `docs/issues-filed.json`.

## Anti-patterns

- Creating duplicate issues — always dedup first.
- Filing P1 findings as issues.
- Verbose issue bodies.
- Forgetting `deferred-from-loop` label.

---

===== FILE: verify-vs-plan.md =====

# Phase: verify-vs-plan

You are running the `verify-vs-plan` skill from the Groove skill pack. **You did not build this optimization.** You are a fresh-context reviewer with no bias toward the implementation.

## What you must do

1. Read `docs/plan.md` and `docs/optimize-targets.yml` to understand what was supposed to be improved.

2. Compute the diff for this workflow vs. the base branch.

3. For each optimization target in the plan:
   - Confirm every `acceptance_criterion` has evidence in the diff (benchmark, measurement, test).
   - Confirm those tests pass.
   - Confirm no `out_of_scope` items appeared in the implementation.

4. For the optimization as a whole:
   - Confirm the plan's `out_of_scope` is honored.
   - Confirm no targets were silently skipped.
   - Confirm no undocumented changes appear.

5. Write `docs/verification.md` with frontmatter, a `## Summary` block, and a `## Findings` section. If everything matches, list each target with "target X: all criteria met, measurements verified."

## Stop conditions

- Every target is checked.
- `docs/verification.md` exists and is well-formed.

## Anti-patterns

- Reading the implementation first then reverse-justifying it as matching the plan.
- Marking measurement gaps as "minor."
- Producing a rubber-stamp verification with no per-target check.

---

===== FILE: harvest.md =====

# Phase: harvest

You are running the `harvest` skill from the Groove skill pack.

This is the compounding step. Write 0–4 substrate entries depending on what the optimize workflow surfaced. **No-signal harvests are valid and expected.**

## What you must do

1. Read: `docs/brainstorm.md`, `docs/plan.md`, `docs/findings.json`, `docs/verification.md`, `docs/issues-filed.json`. Plus the git log of this worktree.

2. For each of the four substrate types, ask the falsifiable trigger question:

### Vocabulary

**Trigger:** Did this workflow coin or encounter a performance-domain term future workflows would benefit from?

**If yes:** Write entry via `substrate-write`, update index.

### ADR

**Trigger:** Was a non-obvious optimization choice made — where the alternative is not visible from the resulting code?

**If yes:** Write entry via `substrate-write`, include `supersedes` if updating a prior decision.

### Anti-pattern

**Trigger:** Did this workflow surface a performance mistake that could recur? Check `docs/issues-filed.json` for recurring deferral categories — strong anti-pattern signal.

**If yes:** Write entry via `substrate-write`. Must include `scope` and the positive example.

### Solution

**Trigger:** Did the workflow solve a performance problem retrievable by symptom-similarity?

**If yes:** Write entry via `substrate-write`. Must include `tags` and a link to the merged PR.

## Output

`docs/harvest.md` must state, for each of the four types, either "Wrote entry: `<path>`" or "No trigger fired — <one-line why>."

## Anti-patterns

- Writing entries without a fired trigger.
- Editing existing substrate entries instead of appending with `supersedes`.
- Skipping `docs/issues-filed.json` review.
- Writing without scope or tags.

---

End of file. 10 prompts above. Split at the `===== FILE: ... =====` markers and place each at `.yoke/prompts/<name>` to match `optimize.yml`.
