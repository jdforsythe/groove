# Groove

A planning-and-implementation loop for AI-assisted software development that ships features and improves the codebase substrate at the same time. Every workflow leaves the project's domain knowledge a little sharper than it found it.

Groove is three things in one repo:

1. **The theory** — a harness-agnostic loop ([`docs/groove.md`](docs/groove.md)) that any developer or agent can follow by hand.
2. **A skill pack** — an example implementation as composable Claude Code skills ([`docs/skills-prd.md`](docs/skills-prd.md)).
3. **A Yoke template** — an example harness configuration that runs the skill pack with parallelism, gates, and worktree isolation ([`docs/yoke/`](docs/yoke/)).

Pick the layer you need. Read the theory and run it by hand. Drop the skill pack into Claude Code and run it interactively. Wire the Yoke template in and run it AFK.

## What Groove gives you

- **Substrate that grows with the work.** Every workflow can write 0–4 entries into `.substrate/` (vocabulary, ADRs, anti-patterns, solutions, reviewers). Append-only with explicit supersession — history is preserved, staleness is visible.
- **Progressive disclosure everywhere.** Substrate, ADRs, and skills are themselves indexed (index → frontmatter description → markdown summary block → body). Agents only load what they need; tokens stop being a tax on knowledge depth.
- **Vertical slices, not horizontal layers.** Plans decompose into thin tracer-bullet slices with explicit acceptance criteria and `out_of_scope` guards. The slice DAG is built mechanically from file overlap first, then augmented with semantic edges by the agent.
- **One failing test, then pass it.** No bulk test writing. Each slice gets a single tracer test that passes through every layer.
- **Specialist review by predicate match.** Reviewers (security, simplicity, architecture, project-grown specialists) declare predicates that fire on diff shape. Small diffs don't pay for unused specialists.
- **Fresh-context verification.** A separate verifier compares delivered code against the original plan. Drift between plan and implementation gets caught before review, not after.
- **Cheap restart.** Worktree-isolated runs mean "kill and restart from step 3" is not a punishment.

## Repo layout

```
docs/
  groove.md                      The theory (harness-agnostic loop)
  skills-prd.md                  Skill pack PRD (14 skills, deep-module shape)
  schemas-and-conventions.md     Artifact shapes (slice, findings, substrate frontmatter, predicate DSL, indexes)
  agents/                        Per-repo conventions (issue tracker, triage labels, domain docs)
  yoke/                          Example Yoke config that composes the skill pack
.claude/
  skills/                        Project-local Claude Code skills (e.g. implement-issue)
  settings.json                  Shared Claude Code settings
.substrate/                      (created on first use) Project knowledge: vocab, ADRs, anti-patterns, solutions, reviewers
tests/fixtures/                  Per-skill fixtures (unit-test or pressure-test) per PRD §Testing
```

## How to adopt

### As a developer running Groove by hand

Read [`docs/groove.md`](docs/groove.md). Follow the loop. Write the artifacts the loop names. The substrate seed kit ships in this repo — copy `.substrate/` into your project to bootstrap.

### As a Claude Code user running the skill pack interactively

Install the skills under `.claude/skills/` (or your global skills directory) and invoke them by trigger. Each `SKILL.md` is a deep module with a small public interface:

- `clarify` opens a feature workflow
- `research` runs three-way parallel research
- `plan-synth` produces a plan with the slice schema
- `decompose` builds the slice DAG
- `tracer-test` writes one failing test
- `slice-impl` makes it pass
- `slice-refactor` cleans up (optional)
- `review-fanout` evaluates reviewer predicates and runs matches
- `resolve-finding` applies a triage-approved fix
- `verify-vs-plan` checks delivered code against the plan in fresh context
- `harvest` writes 0–4 substrate entries on workflow exit
- `consolidate` runs weekly to promote anti-patterns, merge ADRs, prune stale solutions
- `substrate-read` and `substrate-write` are the cross-cutting access skills

Pair with project-local helpers like [`/implement-issue`](.claude/skills/implement-issue/SKILL.md) for issues whose deliverable is authored content rather than red-green code logic.

### As a harness implementer running the skill pack AFK

The Yoke template at [`docs/yoke/feature.yml`](docs/yoke/feature.yml) shows how phases, parallelism, gates, and worktrees compose the pack. Yoke is one example — any harness with the right primitives (per-phase prompts, `items_from` iteration, `pre:` / `post:` hooks, retry ladders, worktree isolation) can run the same pack.

## Key conventions

- **Format conventions.** Markdown for prose. YAML frontmatter for metadata. YAML in fenced blocks for nested data (slice lists, predicates). JSON for inter-phase machine artifacts (findings, slice DAG). XML only for in-prompt section delimiters. JSON is forbidden for substrate; XML is forbidden everywhere except in-prompt delimiters.
- **Substrate writes are append-only with explicit supersession.** New entries with `supersedes: [old-id]`; old entries stay on disk.
- **Skills are deep modules.** Small public interface (trigger, inputs, outputs, substrate access declaration); deep, mutable implementation. The interface is what other skills, harnesses, and developers depend on.
- **Skills are harness-agnostic.** They compose via shared artifact paths and substrate, not direct calls. The composition graph is the harness's concern.

## Status

This repo is the planning home for Groove. The theory and schemas are stable; the skill pack and Yoke template are being built out under [GitHub Issues](https://github.com/jdforsythe/groove/issues). See `docs/skills-prd.md` for the v1 plan and the open issues for current state.

## Credits

Groove draws on:

- John Ousterhout's *A Philosophy of Software Design* (deep modules, complexity as cumulative drag)
- Kent Beck's tracer-bullet TDD (one test, one impl, repeat)
- Matt Pocock's `setup-matt-pocock-skills` and triage skill set (issue-tracker conventions, AGENT-BRIEF discipline)
- The Superpowers project's pressure-testing methodology for skills with fuzzy LLM behavior
- Compound Engineering's substrate idea (system improvements per feature shipped) — though Groove does not enforce a fixed plan-to-review ratio
