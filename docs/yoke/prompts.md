# Yoke prompt files for the Groove `feature.yml`

This file contains all 12 prompts referenced by the Groove feature pipeline. Each section is one file. Split at the `===== FILE: <name> =====` markers; the file should land at `.yoke/prompts/<name>` exactly as listed.

Each prompt invokes a named skill from the **Groove skill pack**. Wire that pack into your Claude Code session via plugin or local skill directory before running the workflow.

Conventions used in every prompt:
- The active skill name from the Groove skill pack is named explicitly.
- Eager-loaded substrate is listed first (read these BEFORE doing anything else).
- Lazy-loaded substrate is referenced by its index — fetch bodies only when needed.
- Stop conditions are explicit. Anti-patterns are explicit. No flattery, no role inflation.
- Workflow-scoped artifacts live in `docs/`. Project knowledge lives in `.substrate/`.

---

===== FILE: clarify.md =====

# Phase: clarify

You are running the `clarify` skill from the Groove skill pack.

## What you must do

1. Read eager substrate first: `.substrate/vocabulary/INDEX.md`, `.substrate/adr/INDEX.md`, `.substrate/anti-patterns/INDEX.md`. Indexes only — do not fetch bodies unless an entry's one-line description suggests it is highly relevant to the idea below.

2. Apply the `clarify` skill: relentlessly interview the user about the idea below. One question per turn. For each question, provide your recommended answer. Walk down the decision tree, resolving dependencies between decisions one at a time. If a question can be answered by exploring the codebase or substrate bodies, explore instead of asking.

3. When the user signals the brainstorm is complete (or when no decision branches remain), write `docs/brainstorm.md` with the standard frontmatter:

```yaml
---
id: <kebab-case-id-derived-from-title>
type: brainstorm
description: one-line summary of what is being built
created: <today>
tags: [topic, ...]
---
```

Followed by a `## Summary` block (≤5 lines) and the body.

## Stop conditions

- All decision-tree branches resolved.
- User explicitly signals "ready for research."
- 20 questions answered. Past this, the brainstorm is too long; consolidate and exit.

## Anti-patterns

- Asking multiple questions in one turn.
- Failing to provide a recommended answer with each question.
- Skipping substrate read.
- Writing the brainstorm before the user has signed off on the decision tree.

---

===== FILE: research.md =====

# Phase: research

You are running the `research` skill from the Groove skill pack.

## What you must do

1. Read `docs/brainstorm.md` to understand what is being built.

2. Read substrate indexes lazily: `.substrate/adr/INDEX.md`, `.substrate/solutions/INDEX.md`. Search the indexes for entries relevant to the brainstorm (matching tags, scope, or domain terms). Fetch bodies only for entries that look directly applicable.

3. Run three research threads in parallel (use the Task tool to dispatch subagents):
   - **Codebase patterns:** how does similar functionality already work in this repo? Read existing modules, tests, and conventions. Identify deep modules that this feature could extend or compose with.
   - **Framework / library docs:** what do the relevant framework or library docs recommend? Is there an idiomatic approach we should follow?
   - **Prior solutions:** does `.substrate/solutions/` contain a worked example for a similar problem? Is there a relevant ADR explaining a past decision in this area?

4. Aggregate the three threads into `docs/research.md` with frontmatter and a `## Summary` block. Body sections: Codebase patterns / Framework guidance / Prior solutions / Open questions.

## Stop conditions

- All three threads complete and aggregated.
- Open questions are listed (if any) — these become inputs to plan-synth.

## Anti-patterns

- Skipping the parallel fan-out and reading sequentially.
- Quoting framework docs verbatim instead of summarizing the relevant guidance.
- Failing to identify deep modules that already exist.
- Producing a research doc longer than the brainstorm — research is for decision-relevant facts, not encyclopedic dumps.

---

===== FILE: plan-synth.md =====

# Phase: plan-synth

You are running the `plan-synth` skill from the Groove skill pack.

## What you must do

1. Read `docs/brainstorm.md` and `docs/research.md` in full.

2. Read all four substrate indexes eagerly: vocabulary, ADR, anti-patterns, solutions. Fetch the bodies of any entries whose scope or tags match the brainstorm's domain.

3. Synthesize the plan. Write two files:

   **`docs/plan.md`** — prose plan with frontmatter, summary block, and these sections:
   - Goal (one paragraph)
   - Approach (decisions made, alternatives rejected, references to ADRs/solutions consulted)
   - Vertical slices (one paragraph per slice, naming each by id)
   - Out of scope (explicit YAGNI guards at the feature level)

   **`docs/plan.slices.yml`** — machine-readable slice list. Schema:

   ```yaml
   slices:
     - id: kebab-case-stable
       title: one-line
       acceptance_criteria:
         - observable behavior
         - observable behavior
       touched_paths:
         - src/foo/**
         - test/foo/**
       semantic_depends_on: []   # filled by decompose phase
       out_of_scope:
         - explicit YAGNI guard
   ```

4. Each slice must fit the schema. If a slice cannot be expressed in this shape, the slice is too big — split it. Aim for slices that ship in one RED-GREEN cycle (5–30 minutes of agent work).

## Stop conditions

- `docs/plan.md` and `docs/plan.slices.yml` both exist.
- `validate-slices` passes.
- Every acceptance criterion describes observable behavior, not implementation.

## Anti-patterns

- Slices that include "implement X" or "refactor Y" without acceptance criteria — those are not slices, they are todo items.
- Estimates, priorities, or descriptions in the slice schema (the schema forbids them).
- Slices touching disjoint subsystems — those should be separate features.
- Inventing terminology that doesn't appear in the vocabulary index. If you need a new term, that's a harvest concern; for the plan, use existing vocabulary.

---

===== FILE: decompose.md =====

# Phase: decompose

You are running the `decompose` skill from the Groove skill pack.

The deterministic file-overlap DAG was already derived for you (the `pre:` step ran `derive-file-dag`). Your job is **only** to add semantic edges that file overlap cannot detect.

## What you must do

1. Read `docs/plan.slices.yml` — note the file-overlap edges already in `semantic_depends_on` for each slice (added by the pre-step).

2. Read `.substrate/anti-patterns/INDEX.md`. Fetch bodies of any anti-pattern entries scoped to "coupling" or to file paths that overlap any slice's `touched_paths`.

3. For each pair of slices A and B (A earlier than B in the file-overlap topological order, NO file overlap), ask: does B require something B's tests cannot exercise without A's behavior? Examples:
   - A introduces a domain concept B reasons about (even via different files).
   - A establishes a contract or protocol B implements.
   - A's data shape is read by B's code.

4. If yes, append an edge to B's `semantic_depends_on` array with a `reason:` field. Format:

   ```yaml
   semantic_depends_on:
     - id: slice-a
       reason: B reads the Workspace contract A defines
   ```

5. **You may only add edges, never remove them.** The file-overlap edges are mechanical truth. Removing one is a bug. Validation will fail if you do.

## Stop conditions

- `validate-slice-dag` passes.
- Every semantic edge you added has a `reason` field.
- The DAG is acyclic.

## Anti-patterns

- Adding edges between slices touching disjoint domains for vague reasons ("they're both auth-related").
- Removing or modifying file-overlap edges.
- Adding edges without reasons.
- Marking everything as dependent on slice 1 — over-cautious sequencing defeats parallelism.

---

===== FILE: red.md =====

# Phase: red

You are running the `tracer-test` skill from the Groove skill pack.

This phase runs once per slice in fresh context. The slice id is in `$YOKE_ITEM_ID`; its full record is the matching entry in `docs/plan.slices.yml`.

## What you must do

1. Read the slice record. You need: `id`, `title`, `acceptance_criteria`, `touched_paths`, `out_of_scope`.

2. Read scoped anti-patterns: `.substrate/anti-patterns/INDEX.md`, then fetch only entries whose `scope` overlaps the slice's `touched_paths`. Eager-load these into your working knowledge.

3. Pick the FIRST acceptance criterion. Write ONE failing test for that criterion. The test must:
   - Live in a path matching this project's test conventions.
   - Test observable behavior through a public interface, not implementation details.
   - Reference the slice id in a comment for traceability.
   - Fail when run (RED).

4. Do NOT write any implementation code. Do NOT write tests for other criteria. Horizontal-slice TDD is forbidden — see the anti-pattern entry on this.

5. Run the test suite. Confirm the new test fails on the assertion (not on import error or syntax). Commit with message `red: <slice-id> - <one-line>`.

## Stop conditions

- Exactly one failing test exists in the diff.
- No source files in the diff.
- Test fails on its assertion, not on a trivial error.

## Anti-patterns

- Multiple tests in one phase.
- Implementation code in the diff.
- Test that already passes (means it's not testing what you think).
- Test that fails because of import error (means it's not testing anything).

---

===== FILE: green.md =====

# Phase: green

You are running the `slice-impl` skill from the Groove skill pack.

This phase runs once per slice in fresh context. A failing test for this slice already exists (the previous `red` phase wrote it). Your job: write the minimum code to pass that test.

## What you must do

1. Read the slice record from `docs/plan.slices.yml` (id is `$YOKE_ITEM_ID`). Note `acceptance_criteria`, `touched_paths`, and especially `out_of_scope`.

2. Read scoped anti-patterns whose `scope` overlaps `touched_paths`. Eager-load.

3. Identify the failing test. Read it.

4. Write the minimum code to make that one test pass. **Minimum is the operative word.** Do not implement the next acceptance criterion. Do not add features mentioned in `out_of_scope`. Do not add validation, error handling, or extension points the test does not require.

5. Run tests, lint, typecheck. All must pass before this phase exits.

## Stop conditions

- All tests pass.
- Lint clean. Typecheck clean.
- Diff touches only `touched_paths` plus the test file.

## Anti-patterns

- Implementing more than the test requires (over-building).
- Touching files outside `touched_paths`.
- Implementing items from `out_of_scope`.
- Adding "TODO" or "for future use" code. The next slice will add what's needed; this slice ships the minimum.
- Modifying the failing test to make it pass without changing source — that's cheating, not GREEN.

---

===== FILE: refactor.md =====

# Phase: refactor

You are running the `slice-refactor` skill from the Groove skill pack. **This phase is optional.** If the slice is already clean, exit immediately with a "no refactor needed" note in the commit.

## What you must do

1. Tests are GREEN. Confirm before any change. If RED, stop — refactoring while RED is a fundamental error.

2. Look for refactor candidates in the diff (Pocock's tdd skill checklist):
   - Duplication that can be extracted.
   - Shallow modules that can be deepened (move complexity behind a simple interface).
   - SOLID violations that natural extraction can fix.
   - Names that don't match the project's vocabulary.

3. Apply at most ONE refactor. Run tests + lint + typecheck after each change.

4. Commit with `refactor: <slice-id> - <what-and-why>`. If you exit without changes, commit with `refactor: <slice-id> - none needed`.

## Stop conditions

- Tests still pass after the refactor.
- One refactor applied OR no refactor needed.

## Anti-patterns

- Refactoring while RED.
- Multiple refactors in one phase (each refactor is a separate decision).
- Refactoring code outside the slice's `touched_paths`.
- Adding features under the guise of refactor.
- "Clever" abstractions that aren't motivated by the duplication you actually see.

---

===== FILE: review-fanout.md =====

# Phase: review-fanout

You are running the `review-fanout` skill from the Groove skill pack.

## What you must do

1. Read `.substrate/reviewers/INDEX.md`. Each reviewer entry has a one-line description, a path to its body, and a "fires when" predicate (e.g., "diff touches `src/auth/**`", "any new SQL", "files added in `migrations/`").

2. Compute the diff for this workflow (compare against the base branch). Identify which reviewer predicates match.

3. Pick the top 3–5 matching reviewers (cap at 5). Fetch each reviewer's body. Each reviewer body specifies a brief identity (real role, <50 tokens, no flattery), a checklist, and an output format.

4. Run the matching reviewers in parallel via the Task tool. Each subagent reviews the diff against its specialty and returns findings.

5. For each finding, set:
   - `id`: stable, e.g. `fnd-<reviewer-slug>-<index>`
   - `reviewer`: reviewer slug
   - `priority`: `P1` (must fix; merge blocker), `P2` (should fix), `P3` (nice to fix)
   - `in_scope`: `true` if the finding's location falls within ANY slice's `touched_paths` from `docs/plan.slices.yml`; `false` otherwise
   - `location`: file path and line if available
   - `title`: one line, actionable
   - `description`: 1–3 paragraphs, including reproduction or evidence

6. Aggregate into `docs/findings.json`:

   ```json
   { "findings": [ { ... }, { ... } ] }
   ```

## Stop conditions

- 3–5 reviewers ran (or fewer if fewer predicates matched).
- Every finding has all required fields populated.
- `validate-findings` passes.

## Anti-patterns

- Running every reviewer regardless of predicate match (token waste, dilutes signal).
- Findings without `in_scope` set — the defer stage depends on it.
- "LGTM" with no findings (rubber-stamp; MAST FM-3.1). If a reviewer truly finds nothing, it must justify the clearance with a one-line statement of what it specifically checked.
- Severity inflation (everything as P1) — calibration matters.

---

===== FILE: resolve-finding.md =====

# Phase: resolve-finding

You are running the `resolve-finding` skill from the Groove skill pack.

This phase runs once per finding (P1, plus in-scope P2). Finding id is `$YOKE_ITEM_ID`; full record is the matching entry in `docs/findings.json`.

## What you must do

1. Read the finding record. Note `location`, `description`, `priority`.

2. Read scoped anti-patterns whose `scope` overlaps the finding's `location`.

3. Apply the minimum fix that addresses the finding. Do not refactor adjacent code unless it is required for the fix.

4. If the finding's description contains a reproducer, add it to the test suite as a regression test before fixing. The regression test must fail before the fix and pass after.

5. Run tests, lint, typecheck. All must pass.

## Stop conditions

- Tests pass (including any regression test you added).
- Lint clean. Typecheck clean.
- Commit message references the finding id: `fix: <finding-id> - <one-line>`.

## Anti-patterns

- Fixing more than the finding describes (scope creep).
- Skipping the regression test when a reproducer is available.
- Treating a P2 like a P1 (over-engineering).
- Modifying the finding text to make the fix easier — the finding is the spec.

---

===== FILE: file-issue.md =====

# Phase: file-issue

You are running the `defer-finding` skill from the Groove skill pack.

This phase runs once per deferred finding (out-of-scope P2 + all P3). Finding id is `$YOKE_ITEM_ID`; full record is in `docs/findings.json`.

## What you must do

1. Read the finding record. Note `priority`, `location`, `reviewer`, `title`, `description`, and `in_scope`.

2. **Dedup check.** Before creating an issue, search existing GitHub issues for one that already covers this finding:

   ```bash
   gh issue list --label "deferred-from-loop" --search "<short keyword from title>" --state open --json number,title,body
   ```

   If a clearly matching open issue exists, append to `docs/issues-filed.json` with the existing URL and a `dedup: true` flag. Do not create a duplicate. Exit.

3. **Create the issue.** Use `gh issue create`:
   - **Title:** rewrite the finding title to be actionable and reader-friendly. Drop reviewer jargon. Format: imperative verb + concrete subject.
   - **Body:** include (a) one-paragraph summary, (b) location, (c) reviewer that found it, (d) priority and the deferral reason ("out of scope of feature `<workflow-id>`" or "P3 — nice to fix"), (e) a suggested reproducer if the description has enough info, (f) a link to the workflow's PR for context.
   - **Labels:** map the reviewer category to a label (`security`, `performance`, `architecture`, etc.). Always include `deferred-from-loop`. Always include `priority:<P2|P3>`.

4. **Record the URL.** Append to `docs/issues-filed.json`:

   ```json
   { "finding_id": "$YOKE_ITEM_ID", "url": "<gh-url>", "filed_at": "<iso-timestamp>", "dedup": false }
   ```

   The file is a JSON array. Read it, append, write it back.

## Stop conditions

- An issue exists (either created by this phase or pre-existing via dedup).
- The URL is recorded in `docs/issues-filed.json` with the current finding id.

## Anti-patterns

- Creating duplicate issues — always dedup first.
- Filing P1 findings as issues (P1 is a merge blocker; if it reached this phase, the filter is wrong).
- Verbose issue bodies that paraphrase the finding instead of distilling it. Reviewers reading the issue list need to triage in seconds.
- Inventing labels that don't exist in the repo (use `gh label list` to verify if uncertain).
- Forgetting the `deferred-from-loop` label — it's how harvest finds these later.

---

===== FILE: verify-vs-plan.md =====

# Phase: verify-vs-plan

You are running the `verify-vs-plan` skill from the Groove skill pack. **You did not build this feature.** You are a fresh-context reviewer with no bias toward the implementation.

## What you must do

1. Read `docs/plan.md` and `docs/plan.slices.yml` to understand what was supposed to be built.

2. Compute the diff for this workflow vs. the base branch.

3. For each slice in the plan:
   - Confirm every `acceptance_criterion` has a corresponding test in the diff.
   - Confirm those tests pass.
   - Confirm no `out_of_scope` items appeared in the implementation.

4. For the feature as a whole:
   - Confirm the plan's `out_of_scope` is honored at the feature level.
   - Confirm no slices were silently skipped.
   - Confirm no major undocumented changes appear in the diff.

5. Write `docs/verification.md` with frontmatter, a `## Summary` block, and a `## Findings` section listing any drift between plan and implementation. If everything matches, the Findings section says so explicitly with one line per slice ("slice X: all 3 criteria covered, all tests pass").

## Stop conditions

- Every slice is checked.
- `docs/verification.md` exists and is well-formed.

## Anti-patterns

- Reading the implementation first and then reverse-justifying it as matching the plan. Read the plan first.
- Marking drift as "minor" without listing it. Drift is drift; harvest decides whether it's worth a substrate entry.
- Quoting code in the verification report. The diff is in git; the report is for human consumption.
- Producing a "looks good" verification with no per-slice check. That's MAST FM-3.1 (rubber-stamp).

---

===== FILE: harvest.md =====

# Phase: harvest

You are running the `harvest` skill from the Groove skill pack.

This is the compounding step. The workflow is about to close. Your job: capture lessons that will make the next workflow easier. Write 0–4 substrate entries depending on what the workflow actually surfaced. **No-signal harvests are valid and expected** — do not invent lessons.

## What you must do

1. Read the full workflow trace: `docs/brainstorm.md`, `docs/plan.md`, `docs/findings.json`, `docs/verification.md`, `docs/issues-filed.json`. Plus the git log of this worktree.

2. For each of the four substrate types, ask the falsifiable trigger question. If the trigger fired, write the entry. If not, explicitly say so in `docs/harvest.md`.

### Type 1: Vocabulary

**Trigger:** Did this workflow encounter or invent a domain term that future workflows would benefit from?

**If yes:** Append `.substrate/vocabulary/<term-slug>.md` with frontmatter (`type: vocabulary`, etc.) and a body summary block. Update `.substrate/vocabulary/INDEX.md` with a one-line entry. Cross-link from any ADRs or solutions that use the term.

### Type 2: ADR

**Trigger:** Was a non-obvious choice made — one where the alternative is not visible from the resulting code?

**If yes:** Append `.substrate/adr/<adr-id>-<slug>.md`. Frontmatter must include `supersedes` if this replaces a prior ADR. Body must include: context, decision, alternatives considered, consequences. Update the index.

### Type 3: Anti-pattern

**Trigger:** Did the workflow surface a mistake that a future workflow could repeat? Was a finding raised that, in retrospect, should have been impossible to produce?

**Bonus trigger:** read `docs/issues-filed.json`. If multiple deferrals share a category (e.g., three "performance" issues from review), that's a recurring class of problem — strong anti-pattern candidate. Note the recurring category in your reasoning.

**If yes:** Append `.substrate/anti-patterns/<slug>.md`. Frontmatter must include `scope` (paths/globs where the rule applies). Body must include: the rule ("never X"), the reason ("because Y"), and a positive example of the right thing to do. Update the index.

### Type 4: Solution

**Trigger:** Did the workflow solve a problem retrievable by symptom-similarity that a future workflow might re-encounter?

**If yes:** Append `.substrate/solutions/<slug>.md`. Frontmatter must include `tags` for retrieval. Body: problem statement, solution approach, references to ADRs and anti-patterns that came up, link to the merged PR for the worked example.

## Output

`docs/harvest.md` must explicitly state, for each of the four types, either:
- "Wrote entry: `<path>`" — with the entry path and one-line summary, or
- "No trigger fired" — with a one-line explanation of why this workflow did not produce that type.

Four lines minimum.

## Anti-patterns

- Writing entries because you feel you should produce something.
- Editing existing substrate entries instead of appending new ones with `supersedes`.
- Skipping the index update.
- Writing without scoped paths or tags (anti-patterns and solutions become unfindable without them).
- Ignoring `docs/issues-filed.json` — recurring deferrals are the highest-signal anti-pattern source.

---

End of file. 12 prompts above. Split at the `===== FILE: ... =====` markers and place each at `.yoke/prompts/<name>` to match `feature.yml`.
