# PRD: The Groove skill pack

*The composable skill set that implements the Groove framework.*

> Synthesized from prior conversation context. No interview. Deep-module orientation per Ousterhout.

## Problem Statement

Developers using Claude Code want to ship features and improve their codebase substrate at the same time. Current methodologies pick one: vibe-coding ships fast and accumulates debt; formal docs accumulate knowledge but slow shipping. Existing systems also tightly couple the methodology to a single harness, so adoption is all-or-nothing.

The developer needs a set of small, composable skills that implement the loop defined in `groove.md` — usable in any harness with the right primitives, or by hand in plain Claude Code. The skill set must encode the loop's principles without demanding any specific tooling.

## Solution

A pack of 14 skills, each a deep module (small public interface, deep implementation), grouped into core flow, cross-cutting conventions, and meta. Each skill: declares its trigger (when to fire); declares its substrate access pattern (eager vs lazy); produces a typed output artifact at a known path; exits via a deterministic check or explicit gate.

The pack ships with starter substrate templates so a fresh project gets the indexes, summary block conventions, and seed entries the loop assumes. The pack is harness-agnostic but harness-friendly: a tool like Yoke can compose these skills directly via prompt templates and `post:` hooks.

## User Stories

1. As a developer starting a new feature, I want to be relentlessly grilled about my idea, so that I notice gaps before I commit to a plan.
2. As a developer, I want the agent to read substrate indexes (not bodies) before grilling me, so that the grill questions reflect prior project decisions without burning context.
3. As a developer, I want three-way parallel research (codebase patterns, framework docs, prior solutions) before planning, so that the plan reflects how *this* project actually works.
4. As a developer, I want a plan that decomposes into vertical slices with explicit acceptance criteria, so that each slice can be tested independently.
5. As a developer, I want each slice to declare what it is *not* doing, so that GREEN agents do not over-build.
6. As a developer, I want the slice DAG built mechanically from file overlap first, then augmented with semantic edges by the agent, so that I get safe parallelism without manual graph drawing.
7. As a developer, I want to write ONE failing test, then pass it, then optionally refactor, per slice — never bulk-write tests.
8. As a developer, I want each slice to run in fresh agent context, so that long-conversation drift cannot accumulate across slices.
9. As a developer, I want parallel slices to merge through a deterministic gate (the union test suite), so that I find integration failures immediately, not in review.
10. As a developer, I want specialist reviewers chosen from a substrate-declared roster by predicate match, so that small diffs do not pay for unused specialists.
11. As a developer, I want findings prioritized P1/P2/P3 with structured output, so that triage is fast and resolution can be parallelized.
12. As a developer, I want a fresh-context verifier (different from the builder) to compare delivered code against the original plan, so that drift between plan and implementation is caught.
13. As a developer, I want each completed workflow to write 0–4 substrate entries depending on what the workflow actually surfaced, so that the substrate grows only with real signal.
14. As a developer, I want a separate weekly consolidate workflow that promotes recurring patterns, prunes stale entries, and merges duplicates, so that the substrate stays useful as the project ages.
15. As a developer, I want every agent-readable doc (substrate, ADRs, skills) to be progressively disclosed (index → summary → body), so that agents only load what they need.
16. As a developer, I want substrate writes to be append-only with explicit supersession, so that history is preserved and staleness is visible.
17. As a developer, I want skills runnable in plain Claude Code (no harness), so that the methodology can be adopted incrementally.
18. As a developer, I want skills also runnable in a harness (Yoke or similar), so that the loop can be enforced and parallelized when wanted.
19. As a developer, I want gate-failure restarts to be cheap (worktree-isolated), so that "kill and restart from [3]" is not a punishment.
20. As a developer, I want the rejection reason from any failed gate to be written to substrate, so that gate failures become future lessons.
21. As a developer, I want the harvest skill to refuse to write entries when the workflow surfaced no real signal, so that the substrate does not bloat with paperwork.
22. As a developer, I want a spike workflow available as a separate template, so that exploratory code does not contaminate the feature DAG.
23. As a developer, I want an optimize workflow template separate from feature work, so that performance/architecture cleanup runs on its own cadence.
24. As a developer, I want format conventions (Markdown for prose, YAML frontmatter for metadata, YAML in fenced blocks for nested data) specified explicitly, so that token cost is predictable and `substrate-read` is deterministic.

## Implementation Decisions

The skill set is 14 skills in three groups. Each skill is a **deep module**: trigger/inputs/outputs/substrate-needs are the public interface; everything else is internal.

### Core flow skills (one per phase activity in the graph)

| Skill | Trigger | Reads | Writes |
|---|---|---|---|
| `clarify` | "I want to build X" / start of feature workflow | Vocab index, ADR index (eager) | `docs/brainstorms/<id>.md` |
| `research` | After approved brainstorm | Brainstorm; ADR + Solutions search (lazy) | `docs/research/<id>.md` |
| `plan-synth` | Brainstorm + research present | All four indexes (eager); bodies as needed | `docs/plans/<id>.md` (with slice schema) |
| `decompose` | Approved plan present | Plan only | `docs/plans/<id>.slices.json` (slice DAG) |
| `tracer-test` | Slice ready, no test yet | Slice + scoped anti-patterns (eager) | One failing test file |
| `slice-impl` | Failing test present | Slice + test + scoped anti-patterns (eager) | Implementation passing the test |
| `slice-refactor` | Slice green, optional | Slice + tests | Refactored implementation, tests still green |
| `review-fanout` | Diff present after all batches green | Reviewer index (eager); reviewer body for matches | Findings JSON, prioritized |
| `resolve-finding` | Triage approved a finding | Finding + scoped anti-patterns | Fixed slice |
| `verify-vs-plan` | All findings resolved | Plan + delivered code (fresh context) | Verification report |
| `harvest` | Workflow about to exit | Workflow trace + all four indexes (lazy) | 0–4 substrate entries |

### Cross-cutting skills (substrate access conventions)

| Skill | Trigger | Notes |
|---|---|---|
| `substrate-read` | Any skill needing substrate | Index first, summary block second, body only if needed. Returns hits in priority order. |
| `substrate-write` | `harvest` and `consolidate` | Enforces frontmatter, summary block, and append-only with supersession links. |

### Meta skill

| Skill | Trigger | Notes |
|---|---|---|
| `consolidate` | Cadence (weekly) or when substrate signal degrades | Promote recurring anti-patterns to reviewers; merge duplicate ADRs with supersession; prune stale solutions; retag scopes for files that moved. |

### Module shape

Each skill is a deep module:

- **Public interface (small, stable):** the trigger string in the description field, the input artifact paths/types, the output artifact paths/types, the substrate access declaration (eager set + lazy queries).
- **Implementation (deep, can change):** the prompt template, internal step order, internal sub-prompts, retry behavior.
- **Stable across refactors:** the interface is what callers (harness, developer, other skills) depend on. The implementation can be rewritten without breaking callers.

### Format conventions

All agent-readable artifacts follow these format rules. Choices reflect token efficiency and accuracy benchmarks: Markdown is 40–60% more token-efficient than JSON for prose; YAML matches or beats JSON on nested-data tasks with ~30% fewer tokens; XML costs ~80% more tokens than Markdown for the same content (Improving Agents 2025; Claude API benchmark across Haiku/Sonnet/Opus 4.x; Anthropic prompt engineering guidance).

| Artifact | Format | Rationale |
|---|---|---|
| Substrate body (ADR, anti-pattern, solution, vocab entry) | Markdown | LLM-native, token-efficient |
| Substrate metadata | YAML frontmatter | Structured, deterministic read, matches SKILL.md convention |
| Substrate index | Markdown table | Token-efficient, scannable |
| Slice schema, reviewer predicate, items_from configs | YAML in fenced code block | Nested data; ~30% fewer tokens than JSON |
| Inter-phase machine artifacts (findings, slice DAG) | JSON | Downstream parsers consume them |
| In-prompt section delimiters | XML tags (`<context>`, `<task>`) | Anthropic-recommended for prompt structure only |

JSON is forbidden for substrate storage. XML is forbidden everywhere except in-prompt section delimiters. TOON and similar emerging formats are not adopted — insufficient track record and weaker comprehension scores than Markdown/YAML.

**Mandatory frontmatter shape (all substrate files):**

```yaml
---
id: stable-id
type: vocabulary | adr | anti-pattern | solution
description: one-line summary, used as the index entry
created: YYYY-MM-DD
supersedes: [other-id]   # optional
scope: [path/glob, ...]  # required for anti-patterns + solutions
tags: [topic, ...]
---
```

**Mandatory body opening (after frontmatter):**

```markdown
## Summary

≤5 lines. Scope, when to consult, key terms.

## (rest of body)
```

The two summaries serve two read sites: the frontmatter `description` is what `substrate-read` returns when scanning the index (the agent decides whether to fetch the body based on this line). The markdown summary block is what the agent sees first if it does fetch the body — primacy attention within the body lands here, so it gets one more chance to stop reading. Both are required; neither replaces the other.



Ships alongside the skills: empty indexes for all four substrate types; an empty reviewer index with three seed reviewers (security, simplicity, architecture) using PRISM-aligned brief identities; a seed anti-pattern entry warning against horizontal-slice TDD; a CONTRIBUTING-style doc explaining the progressive-disclosure invariant.

## Testing Decisions

A good test verifies external behavior through the public interface and survives refactors of the internal implementation. A test that breaks when a prompt template is reworded — but the skill still produces the right artifact — is testing implementation, not behavior.

Two test types:

**Unit tests** (skills with deterministic logic):

- `decompose`: given a plan with N slices and known file paths, the produced slice DAG matches an expected topology.
- `harvest`: given a workflow trace fixture, exactly the right 0–4 entries are written; given a no-signal trace, zero entries are written.
- `consolidate`: given a stale substrate fixture, the right promotions/prunes/merges happen.
- `substrate-read`: given a query, the skill stops at the index summary unless the body is genuinely needed.
- `substrate-write`: writes are append-only with valid frontmatter; supersession links resolve.

**Pressure tests** (skills with fuzzy LLM behavior, per Superpowers' writing-skills methodology):

- For each fuzzy skill, run a subagent with the skill loaded against a fixture scenario; run the same subagent without the skill; compare. The skill must cause measurably better behavior on the fixture.
- Fixtures live in `tests/fixtures/<skill>/`. Each fixture: scenario prompt, expected output properties, sample bad output.
- `clarify`: with-skill should ask one question at a time and explore the codebase when answerable; without-skill, the agent jumps to recommendations.
- `tracer-test`: with-skill should produce exactly one failing test; without-skill, the agent often produces multiple tests or implementation alongside.
- `review-fanout`: with-skill should pick 3–5 reviewers by predicate; without-skill, the agent runs every reviewer or picks at random.

**Prior art:** Pocock's skills include implicit testing via real-project use; Superpowers' `writing-skills` skill formalizes pressure-testing as RED-GREEN-REFACTOR for documentation. We adopt the Superpowers methodology for fuzzy skills and standard unit tests for deterministic ones.

## Out of Scope

- The harness itself. Yoke or any other tool that runs phases is a separate concern.
- Specialist reviewer skills beyond the seed kit. The reviewer roster is project-specific and grows via consolidate.
- IDE integrations.
- Multi-tenant / team coordination features.
- Token-economy enforcement and observability dashboards.
- Specific language/framework support beyond what the seed reviewers cover.
- Migration tooling from existing methodologies (Compound, Superpowers, etc.).

> Formal artifact schemas (slice, findings, issues-filed, substrate frontmatter, reviewer predicate, workflow doc frontmatter) and the workflow-id convention are specified in `schemas-and-conventions.md`. Validator implementations referenced from the Yoke template (`validate-slices`, `validate-findings`, `validate-substrate`, etc.) are out of scope here but their behavior is fully constrained by those schemas.

## Further Notes

- Skills are themselves progressively disclosed: SKILL.md is the index entry + summary + procedure; deeper references (`schema.md`, `examples.md`, `failure-modes.md`) are on-demand. The skill set practices its own invariant.
- Skills compose via shared artifact paths and the substrate, not via direct calls. This keeps each skill's interface narrow and makes the composition graph (which skill follows which) the harness's concern, not the skill's.
- The pack does not enforce a particular plan-to-review ratio. Compound's 80/20 claim is unverified at the skill level. Time spent in each phase is observable from harness logs and can be tuned per team.
- The pack does not enforce the four-template separation (feature/spike/optimize/consolidate). It provides skills; templates are user-authored. The graph document is the recommended starting structure.
- A future `compound-delta` reporter could analyze harvest output over time and chart "system improvements per feature shipped" — empirical validation of the 50/50 rule. Out of scope for v1.
