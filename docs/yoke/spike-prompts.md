# Yoke prompt files for the Groove `spike.yml`

This file contains all 4 prompts referenced by the Groove spike pipeline. Each section is one file. Split at the `===== FILE: <name> =====` markers; the file should land at `.yoke/prompts/<name>` exactly as listed.

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

1. Read eager substrate first: `.substrate/vocabulary/INDEX.md`, `.substrate/adr/INDEX.md`, `.substrate/anti-patterns/INDEX.md`. Indexes only — do not fetch bodies unless an entry's one-line description suggests it is highly relevant to the spike goal below.

2. Apply the `clarify` skill: relentlessly interview the user about the spike goal. One question per turn. For each question, provide your recommended answer. Walk down the decision tree, resolving dependencies between decisions one at a time. If a question can be answered by exploring the codebase or substrate bodies, explore instead of asking.

   Key questions to resolve for a spike:
   - What specific uncertainty does this spike need to resolve?
   - What is the time box for the exploratory build?
   - What will you do with the findings — which phase of the theory will they unblock?
   - What "done" looks like (substrate entries? a prototype? a recommendation?).

3. When the user signals the brainstorm is complete (or when no decision branches remain), write `docs/brainstorm.md` with the standard frontmatter:

```yaml
---
id: <kebab-case-id-derived-from-title>
type: brainstorm
description: one-line summary of what the spike is investigating
created: <today>
tags: [topic, ...]
---
```

Followed by a `## Summary` block (≤5 lines) and the body, including a `## Spike goal` section naming the specific uncertainty to be resolved.

## Stop conditions

- All decision-tree branches resolved.
- Spike goal is unambiguous.
- User explicitly signals "ready for research."
- 20 questions answered. Past this, the brainstorm is too long; consolidate and exit.

## Anti-patterns

- Asking multiple questions in one turn.
- Failing to provide a recommended answer with each question.
- Skipping substrate read.
- Writing the brainstorm before the spike goal and time box are agreed.

---

===== FILE: research.md =====

# Phase: research

You are running the `research` skill from the Groove skill pack.

## What you must do

1. Read `docs/brainstorm.md`. Identify the spike goal and the specific uncertainty to be resolved.

2. Read substrate indexes lazily: `.substrate/adr/INDEX.md`, `.substrate/solutions/INDEX.md`. Search for entries relevant to the spike domain. Fetch bodies only for entries that look directly applicable — prior spikes or solutions in the same area may have already answered part of the question.

3. Run three research threads in parallel (use the Task tool to dispatch subagents):
   - **Codebase patterns:** how does the relevant area currently work? Read the code, tests, and conventions. What are the boundaries of the system under investigation?
   - **Framework / library docs:** what do the relevant framework or library docs say about the uncertainty area? Is there prior art in the ecosystem?
   - **Prior solutions:** does `.substrate/solutions/` contain a worked example or past spike result for a similar problem?

4. Aggregate the three threads into `docs/research.md` with frontmatter and a `## Summary` block. Body sections: Codebase patterns / Framework guidance / Prior solutions / Open questions / Hypothesis to test.

## Stop conditions

- All three threads complete and aggregated.
- `docs/research.md` contains a `## Hypothesis to test` section — the spike build will either confirm or refute this.

## Anti-patterns

- Skipping the parallel fan-out and reading sequentially.
- Missing the `## Hypothesis to test` section — the spike build is aimless without it.
- Over-researching past the time box. Research unblocks the build; it is not the deliverable.

---

===== FILE: spike-build.md =====

# Phase: spike-build

You are running the `research` and `substrate-write` skills compositionally from the Groove skill pack. This is an exploratory build phase — not a TDD cycle. The goal is to resolve the uncertainty stated in `docs/brainstorm.md`, not to ship code.

## What you must do

1. Read `docs/brainstorm.md` (spike goal and time box) and `docs/research.md` (hypothesis to test).

2. Read scoped anti-patterns: `.substrate/anti-patterns/INDEX.md`, then fetch bodies of entries whose `scope` overlaps the area under investigation. Load these before writing any code.

3. Build the minimum exploratory artifact needed to confirm or refute the hypothesis. This may be:
   - A small proof-of-concept script or module.
   - A set of automated measurements (benchmarks, trace output, schema diffs).
   - A manual walkthrough of a code path with annotated notes.

   **No TDD cycle.** Do not write tests-first. Do not write production-quality code. The build is a learning vehicle; it is throw-away unless you explicitly note otherwise.

4. Write `docs/spike-findings.md` with:

```yaml
---
id: <same-id-as-brainstorm>
type: spike-findings
hypothesis: <one-line restatement of the hypothesis from research.md>
outcome: confirmed | refuted | inconclusive
created: <today>
tags: [topic, ...]
---
```

Followed by:
- `## Summary` (≤5 lines): outcome, confidence level, what the next workflow step is.
- `## Evidence`: what you built, what you observed, what the data showed.
- `## Implications`: what does this mean for the plan that was blocked? What substrate entries should harvest write?
- `## Throw-away code`: list any files created during the spike that should NOT be shipped. They should be deleted before this workflow closes.

5. Delete any throw-away code listed in `docs/spike-findings.md`. The spike's output is the findings doc, not the exploratory code.

## Stop conditions

- `docs/spike-findings.md` exists.
- The `outcome` field is populated.
- Throw-away code is deleted.

## Anti-patterns

- Spending more time building than the time box allows — spikes are bounded.
- Shipping spike code (it was never reviewed, planned, or vertically sliced).
- Writing a "findings" doc that doesn't state the outcome clearly.
- Not deleting throw-away code — it will confuse the next workflow.

---

===== FILE: spike-substrate-write.md =====

# Phase: spike-substrate-write

You are running the `substrate-write` skill from the Groove skill pack.

This is the compounding step for a spike. The spike resolved (or failed to resolve) an uncertainty. Your job: write the substrate entries that make the next workflow easier. Write 0–3 entries depending on what the spike actually surfaced.

## What you must do

1. Read `docs/brainstorm.md` and `docs/spike-findings.md` in full.

2. For each of the relevant substrate types, ask the falsifiable trigger question. If the trigger fired, write the entry via `substrate-write`. If not, note it explicitly.

### Vocabulary

**Trigger:** Did the spike encounter or coin a domain term that future workflows should know?

**If yes:** Call `substrate-write` with `type: vocabulary`. Body must include a definition, usage context, and any anti-patterns around misuse.

### ADR

**Trigger:** Did the spike resolve a non-obvious architectural choice that a future workflow could repeat by accident?

**If yes:** Call `substrate-write` with `type: adr`. Body must include: context (the uncertainty), decision (the outcome of the spike), alternatives considered (what would have happened if the hypothesis was wrong), and consequences. Include `supersedes: []` if this updates a prior decision.

### Anti-pattern

**Trigger:** Did the spike reveal a mistake that a future workflow could easily repeat — an approach that looks reasonable but fails for non-obvious reasons?

**If yes:** Call `substrate-write` with `type: anti-pattern`. Frontmatter must include `scope` (paths/globs). Body must include: the rule ("never X"), the reason ("because Y"), and a positive example.

### Solution

**Trigger:** Did the spike produce a reusable technique or approach that a future workflow could retrieve by symptom-similarity?

**If yes:** Call `substrate-write` with `type: solution`. Frontmatter must include `tags` for retrieval. Body must include: problem statement, approach, link to `docs/spike-findings.md` as the worked example.

## Output

After all writes (or no-writes), output a one-paragraph summary:
- What entries were written (type + id for each).
- What triggers did not fire and why.

## Stop conditions

- All four trigger questions answered.
- Each entry that was written passes `substrate-write` validation.
- Substrate indexes updated.

## Anti-patterns

- Writing entries because you feel you should produce something.
- Appending entries for inconclusive spikes without stating the inconclusiveness in the entry body.
- Skipping the index update (substrate-write handles this; do not bypass substrate-write).
- Not calling `substrate-write` and writing files directly (index will be stale).

---

End of file. 4 prompts above. Split at the `===== FILE: ... =====` markers and place each at `.yoke/prompts/<name>` to match `spike.yml`.
