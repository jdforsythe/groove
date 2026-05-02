---
name: implement-issue
description: Implement an issue's acceptance criteria without red-green TDD. Use for issues that build static artifacts (SKILL.md files, templates, seed substrate, configs, docs) or pressure-tested skills where red-green doesn't fit. Reads the issue + agent brief, builds artifacts, verifies acceptance criteria.
---

# Implement Issue

Implement an issue by building the artifacts its acceptance criteria call for. No red-green-refactor cycle — for that, use `/tdd`.

The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if not.

## When to use this vs `/tdd`

Use **this skill** when the deliverable is authored content rather than code logic:

- SKILL.md prompt files (whether unit-tested by fixture or pressure-tested by differential comparison — neither verification style admits red-green-refactor on the prompt itself)
- Templates, seed substrate, configs, docs, schemas
- Authored DSL expressions, predicates, frontmatter-driven artifacts

Use **`/tdd`** when the deliverable is executable code logic that admits red-green:

- Validators, parsers, CLI tools, pure functions
- Library code with deterministic input → output behavior verified by classic unit tests on the *code*

The signal is what changes when a test fails: if you'd edit a `.md` prompt file to fix it, this skill. If you'd edit a `.ts`/`.py`/`.js` source file to fix it, `/tdd`.

Fixture-driven verification of an LLM prompt is not red-green TDD — there's no failing-test-first discipline on the prompt; you write the skill, run the fixture, tweak the skill. Use this skill for that loop.

If the issue body explicitly says **do not use /tdd**, this is the skill to invoke.

## Invocation

The user invokes `/implement-issue <N>` where `<N>` is the issue number. If no argument is given, ask for one.

## Process

### 1. Read the issue and agent brief

```bash
gh issue view <N> --comments
```

The triage comment posted by `/triage` contains the agent brief — that is the spec for what to build. If no agent brief exists yet, ask the user to run `/triage <N>` first, or to confirm they want to proceed off the issue body alone.

Parse "Blocked by" — those issues' delivered artifacts on disk are your inputs. If a blocker is unmerged or unfinished, ask the user before proceeding.

### 2. Read project context

Skim. Re-read the specific section when you need an exact shape:

- `CLAUDE.md` (root) — project-wide conventions
- `docs/skills-prd.md` — v1 skill pack PRD (when working on skills)
- `docs/schemas-and-conventions.md` — artifact shapes (slice schema, findings schema, substrate frontmatter, predicate DSL, indexes, workflow doc frontmatter)
- `docs/groove.md` — the loop the skills implement
- `docs/agents/*.md` — issue tracker / triage label / domain doc conventions

Use the project's domain glossary so artifact names match the project's language; respect ADRs in the area you're touching.

### 3. Implement

Pick the right sub-procedure based on the issue's acceptance criteria. Skills follow the deep-module shape: small public interface (trigger description, inputs, outputs, substrate access declaration in frontmatter), deep implementation (procedure, sub-prompts). Skills are progressively disclosed: SKILL.md is the index entry + summary + procedure; deeper references (`schema.md`, `examples.md`, `failure-modes.md`) are separate files loaded on demand.

#### A. Static artifacts (templates, seed substrate, configs, docs, schemas)

Build directly. Write the file. No fixture. Each acceptance-criteria checkbox is a thing that must be true on disk.

#### B. SKILL.md authored against unit-test fixtures (deterministic black-box check)

When the PRD lists the skill under "unit tests" (e.g. `decompose`, `harvest`, `consolidate`, `substrate-read`, `substrate-write`):

1. Write the unit-test fixture first under `tests/fixtures/<skill>/`. Each fixture: input artifact(s) + expected output (exact shape or property assertions per the PRD's testing section).
2. Author the SKILL.md.
3. Run the skill against the fixture; check output against the expectation.
4. If the check fails, edit the SKILL.md (procedure wording, sub-prompts, examples). Re-run. Iterate until the fixture passes.
5. The fixture is fixed; the skill is what you tune. Do not edit the fixture to make the skill pass.

This is fixture-driven prompt authoring, not red-green code TDD. There is no failing-test-first discipline on the prompt — you can't write a prompt-failing test before writing the prompt. The fixture is a black-box acceptance check.

#### C. SKILL.md authored against pressure-test fixtures (differential check)

When the PRD lists the skill under "pressure tests" (e.g. `clarify`, `tracer-test`, `review-fanout`):

1. Write the pressure-test fixture first under `tests/fixtures/<skill>/`. Each fixture: scenario prompt, expected output properties, sample bad output.
2. Run a subagent against the fixture **with** the skill loaded; capture output.
3. Run the same subagent against the same fixture **without** the skill loaded; capture output.
4. Compare. The skill must cause measurably better behavior on the fixture.
5. If the gap isn't real, iterate the SKILL.md procedure until it is. The fixture is fixed; the skill is what you tune.

#### D. SKILL.md with no fixture mandate

When the PRD doesn't specify a test type for the skill (e.g. `research`, `plan-synth`, `slice-impl`, `slice-refactor`, `resolve-finding`, `verify-vs-plan`):

Build directly per (A). Author the SKILL.md against the acceptance criteria. No fixture required unless a criterion explicitly calls for one.

### 4. Verify

Walk through the issue's acceptance criteria checklist literally. Each box is a deliverable. Run any validators referenced in `schemas-and-conventions.md` §9 if they exist; otherwise hand-check shape against the schemas.

If a criterion is ambiguous, ask the user — do not guess.

### 5. Stop

Report what you built (paths + one-line per file) and which acceptance criteria you verified. Do not commit, push, or open a PR unless the user asks.

## Constraints

- **Deep modules.** Small public interface (trigger, inputs, outputs, substrate access declaration), deep implementation. The interface stays stable across implementation rewrites.
- **Progressive disclosure.** SKILL.md = index entry + summary + procedure. Deeper refs (`schema.md`, `examples.md`, `failure-modes.md`) are separate files loaded on demand. Skills practice their own invariant.
- **Harness-agnostic.** Never mention Yoke (or any specific harness). Skills compose via shared artifact paths and substrate, not direct calls. The composition graph is the harness's concern, not the skill's.
- **Format conventions.** Markdown for prose. YAML frontmatter for metadata. YAML in fenced blocks for nested data (slice lists, predicates, items_from configs). JSON only for inter-phase machine artifacts (findings, slice DAG). XML only for in-prompt section delimiters. JSON is forbidden for substrate storage; XML is forbidden everywhere except in-prompt delimiters.
- **Substrate writes are append-only with explicit supersession.** New entries with `supersedes: [old-id]`; old entries stay on disk. If a skill writes substrate, it goes through `substrate-write` semantics (or follows them by hand if `substrate-write` doesn't exist yet).
- **One issue at a time.** If acceptance criteria suggest scope creep into a sibling issue, stop and ask.
