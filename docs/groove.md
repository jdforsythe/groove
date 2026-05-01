# Groove

*A theory of the agentic coding loop.*

How an idea becomes shipped, reviewed, and harvested code — without losing the lesson. The framework deepens the project's substrate with each pass, like a groove worn into a working surface. Pairs with the Yoke harness for execution, but the theory is harness-agnostic.

## Abstract

Five popular agentic-coding methodologies (Pocock skills, Forge, the 10 Principles, Superpowers, Compound Engineering) describe the same workflow under different names. The science (MetaGPT, DeepMind multi-agent scaling, PRISM, Liu et al. *Lost in the Middle*, the MAST taxonomy, METR's 2025 RCT, Anthropic's internal study) supports the convergent core. This document extracts the workflow as a strict DAG with four substrate types, six primitives, and a single invariant. It is harness-agnostic. Any tool that can run typed phases with deterministic gates and force fresh context between them can implement it. A developer with discipline can run it by hand.

---

## The graph

```
IDEA
 │
 ▼
[1] CLARIFY ───► [2] RESEARCH ───► [3] PLAN ═══╳ Gate A: plan approved
                                               │
                                               ▼
                              ┌──── [4a] DERIVE-FILE-DAG (deterministic)
                              ▼
                          [4b] ADD-SEMANTIC-EDGES (agent; additive only)
                              │
                              ▼
                       slice DAG → topological batches
                              │
              ┌───────────────┘ (per slice in batch; fresh context per slice)
              ▼
        ┌─────────────────────────────────────────┐
        │  [5a] RED ──► [5b] GREEN ──► [5c] REF.  │
        │       ▲           │                     │
        │       └─escalate──┘                     │
        └────────────────┬────────────────────────┘
                         │ batch green
                         ▼
                  [5d] BATCH-MERGE (deterministic gate)
                         │
                         ▼ all batches merged
              [6] SPECIALIST REVIEW (fan-out, parallel, substrate-chosen)
                         │
                         ▼
                ═══╳ Gate B: triage findings
                         │
                         ▼
                  [7] RESOLVE (P1 → P2)
                         │
                         ▼
              [8] VERIFY-vs-PLAN (fresh context; reviewer ≠ builder)
                         │
                         ▼
                  [9] HARVEST ──► writes SUBSTRATE
                         │
                         ▼
                ═══╳ Gate C: PR / merge
```

Strict DAG. No back-edges. Mid-workflow surprises are absorbed by the escalation ladder; if the plan was wrong, kill the workflow and restart from [1] or [3]. Worktree isolation makes restart cheap; the cost of restart is the forcing function that keeps Gate A honest.

---

## Six primitives

1. **Phase** — node with: input artifact(s) → activity (fuzzy or deterministic) → output artifact(s) → exit gate.
2. **Fresh-context boundary** — edge property. Agent context resets when traversed. Required before [5] for each slice, before [6], and before [8]. Mitigates Liu et al.'s U-shaped attention curve and writer-bias in review.
3. **Gate** — exit condition. Deterministic (tests/lint/types/schema-validation) or human (only at A, B, C — the three strategic checkpoints).
4. **Escalation ladder** — policy on gate failure: `same-context retry` → `fresh-context retry with failure summary` → `human checkpoint`. Encodes MAST FM-3.1 mitigation structurally.
5. **Substrate** — persistent project knowledge. Read at the start of [1]/[2]/[3]; written only by [9] HARVEST and the consolidate workflow.
6. **Slice** — vertical cut of the plan, small enough that one RED-GREEN cycle ships it. Decomposition produces a DAG; iteration is fan-out across topological batches.

---

## Four substrate types

| Type | Read site | Write site | Activates |
|---|---|---|---|
| Vocabulary | [1]/[2]/[3] eager | [9] | Domain knowledge cluster (Forge P1) |
| ADR | [2] lazy search | [9] | Past decisions + reasons (10P #3) |
| Anti-pattern | [3] exit + [5b] eager (scoped) | [9] | Steering away from generic mean (10P #5) |
| Solution | [2] lazy search | [9] | Worked examples for similar problems |

[9] writes 0–4 entries depending on what the workflow surfaced. Each type has a falsifiable trigger: encountered/invented term → vocabulary; non-obvious choice → ADR; mistake to avoid → anti-pattern; problem someone else might re-solve → solution. No trigger = no write.

Append-only with explicit supersession. Silent edits poison context. History is debuggable; staleness is visible.

---

## The progressive disclosure invariant

**Every agent-readable artifact follows the same shape.**

- An **index** at the root of each substrate type: one-line entries + paths.
- Each **detailed doc** starts with a summary block (≤5 lines: scope, when to consult, key terms).
- **References** link to summaries, never deep into long bodies. Each link traversal is a deliberate read.

Always-loaded layer = indexes only. Bodies fetched on demand. This holds for substrate, ADRs, skills (the SKILL.md description is the index entry, body is the summary + procedure, deeper files are on-demand), and any documentation an agent will read.

The invariant only stays true if the consolidate workflow runs. Indexes rot into noise without it.

---

## Four workflow templates

All four are strict DAGs sharing the substrate.

1. **Feature** — the main graph above. Idea → shipped + harvested.
2. **Spike** — `[1] → [2] → small exploratory build → write findings to substrate → exit`. Used when [3] cannot be written without exploratory code. Output is substrate updates, not shipped code.
3. **Optimize** — cadence-driven (weekly, after big features, on perf regressions). Input from profilers, production logs, error trackers, `git log --stat` heuristics. Same shape as Feature; different `items_from`. Touches code outside any single feature's blast radius, so it must not piggyback on a Feature workflow.
4. **Consolidate** — substrate hygiene. Promotes recurring patterns to higher tiers (anti-pattern → reviewer; ADR pile → ADR with supersession), prunes stale entries, merges duplicates, retags scopes. Run weekly or as needed. Without this, the eager substrate layer poisons context within months.

---

## Phase reference

| # | Activity | Input | Output | Gate |
|---|---|---|---|---|
| 1 | Clarify (grill) | Idea + substrate indexes | Brainstorm doc | None |
| 2 | Research (3-way parallel) | Brainstorm | Codebase patterns + framework facts + prior solutions | None |
| 3 | Plan-synth | Brainstorm + research | PRD with slice list (per slice schema) | A: human approves |
| 4a | Derive file DAG | Slice list | Slice DAG with file-overlap edges | Det: schema valid |
| 4b | Add semantic edges | Slice DAG + scoped anti-patterns | Slice DAG with reasons | Det: edges additive only |
| 5a | RED | Slice | One failing test against criterion | Det: test exists, fails |
| 5b | GREEN | Slice + failing test | Minimal code to pass | Det: tests + lint + types pass |
| 5c | REFACTOR | Green slice | Refactored code (optional) | Det: tests still pass |
| 5d | BATCH-MERGE | Parallel slice outputs | Merged worktree | Det: union test suite passes |
| 6 | Specialist review (fan-out) | Diff + reviewer index | Findings, prioritized | None |
| 7 | Resolve | Findings (P1 first) | Fixed slices | Det: tests pass per resolution |
| 8 | Verify-vs-plan | Plan + delivered code (fresh context) | Pass/fail + delta report | None |
| 9 | Harvest | Workflow trace | 0–4 substrate entries | None (or B if rejection wraps) |
| - | PR/merge | Merged worktree + harvest | Shipped change | C: human approves |

---

## Slice schema

```yaml
id: stable-id
title: one-line
acceptance_criteria:
  - observable behavior 1
  - observable behavior 2
touched_paths:
  - src/foo/**
  - test/foo/**
semantic_depends_on:
  - other-slice-id  # filled by [4b], with reason
out_of_scope:
  - explicit YAGNI guard
```

No descriptions, no estimates, no implementation hints. If a slice can't fit this schema, [3] failed and Gate A catches it.

`acceptance_criteria` are tests-in-prose. RED writes one test per criterion. GREEN passes them.
`out_of_scope` exists because GREEN agents over-build by default. Naming what's *not* in the slice is a steering mechanism.

---

## Specialist roster (Q10 resolution)

Reviewers are substrate-declared. The reviewer index lists each reviewer with a "when to fire" predicate (matches paths, file types, or other diff features). [6] picks the top 3–5 matching specialists by predicate score and runs them in parallel. The cap reflects DeepMind's saturation data.

New reviewers are not authored by hand. They emerge from harvest: a recurring anti-pattern → consolidate promotes it to a reviewer with an automated check. The system grows its own immune response.

---

## Gate failure handling

| Gate | Reject = | Action |
|---|---|---|
| A (plan) | Plan is wrong | Kill workflow. Restart from [1]. Write rejection reason to substrate. |
| B (triage, single finding) | Drop / defer | Substrate update, no restart. |
| B (triage, batch) | Plan invalidated by review | Kill, restart from [3]. |
| C (PR, small) | Reviewer found something specialists missed | Loop to [7] with finding as synthetic P1. |
| C (PR, fundamental) | Plan or design wrong | Kill, restart from [3] or [1]. |

One rule across all three: never partial-restart from a wrong upstream artifact. Partial restarts preserve contamination.

---

## Principles encoded by edges

| Where | Principle | Source |
|---|---|---|
| [1] grill | Alignment fix | Pragmatic Programmer; Pocock /grill-me |
| [3] PRD durable | Structured handoff | MetaGPT (Hong et al. 2023): ~40% error reduction |
| Gate A | Disposable Blueprint | 10P #4 |
| [4a/b] split | Hardening Principle | 10P #1; Forge: 98.4% deterministic infra |
| [5] vertical TDD | Small batches | DORA; Pocock anti-horizontal-slice |
| Fresh context per slice | U-shaped attention | Liu et al. 2024 |
| [6] brief specialists | PRISM <50-token roles | PRISM; 10P #6 |
| Cap at 3–5 specialists | Saturation at 4 | DeepMind multi-agent scaling 2025 |
| [8] reviewer ≠ builder | Bias-isolated review | Anthropic best-practices |
| Gates A/B/C | Strategic Human Gate | 10P #8; MAST FM-3.1 |
| [9] harvest | Compound philosophy | Compound Engineering; 10P #5 |
| Substrate vocabulary | Vocabulary routing | Forge P1; Ranjan et al. 2024 |
| Substrate anti-patterns | Steering via negation | "Why Johnny Can't Prompt" CHI 2023 |
| Progressive disclosure | Layered context | Anthropic context engineering guide |
| Append-only substrate | Living Documentation | 10P #3 |
| Consolidate workflow | Toolkit Principle | 10P #10 (recursive hardening) |

---

## What survives implementation

- The graph and the four templates.
- The six primitives.
- The four substrate types and their read/write sites.
- The progressive-disclosure invariant.
- The slice schema.
- The escalation ladder.
- The principle-to-edge mapping.

What does **not** survive implementation: specific commands, file paths, harness UI, languages, frameworks. Those are choices a team makes when they apply the theory.
