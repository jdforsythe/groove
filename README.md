# Groove

A planning-and-implementation loop for AI-assisted software development that ships features and improves the codebase substrate at the same time. Every workflow leaves the project's domain knowledge a little sharper than it found it.

Groove is three things in one repo:

1. **The theory** — a harness-agnostic loop ([`docs/groove.md`](docs/groove.md)) that any developer or agent can follow by hand.
2. **A skill pack** — an example implementation as composable Claude Code skills (in [`skills/`](skills/)).
3. **A Yoke template** — an example harness configuration that runs the skill pack with parallelism, gates, and worktree isolation ([`docs/yoke/`](docs/yoke/)).

Pick the layer you need. Read the theory and run it by hand. Drop the skill pack into Claude Code and run it interactively. Wire the Yoke template in and run it AFK.

---

## What Groove gives you

- **Substrate that grows with the work.** Every workflow can write 0–4 entries into `.substrate/` (vocabulary, ADRs, anti-patterns, solutions, reviewers). Append-only with explicit supersession — history is preserved, staleness is visible.
- **Progressive disclosure everywhere.** Substrate, ADRs, and skills are indexed (index → frontmatter description → markdown summary block → body). Agents only load what they need.
- **Vertical slices, not horizontal layers.** Plans decompose into thin tracer-bullet slices with explicit acceptance criteria and `out_of_scope` guards. Each slice cuts through every layer.
- **One failing test, then pass it.** No bulk test writing. Each slice gets a single tracer test that passes through every layer.
- **Specialist review by predicate match.** Reviewers declare predicates that fire on diff shape. Small diffs don't pay for unused specialists.
- **Fresh-context verification.** A separate verifier compares delivered code against the original plan. Drift between plan and implementation gets caught before review.
- **Cheap restart.** Worktree-isolated runs mean "kill and restart from step 3" is not a punishment.

---

## The theory in brief

Groove encodes one loop as a strict directed acyclic graph. No back-edges. Surprises get absorbed by an escalation ladder; a wrong plan means a clean restart, not a patch.

```
IDEA
 │
 ▼
[1] CLARIFY ──► [2] RESEARCH ──► [3] PLAN ══╳ Gate A: plan approved
                                             │
                                             ▼
                                  [4] DECOMPOSE (slice DAG)
                                             │
                          ┌──────────────────┘ (per slice, fresh context)
                          ▼
                    ┌─────────────────────────────────┐
                    │  [5a] RED ──► [5b] GREEN ──► REF │
                    └──────────────────┬──────────────┘
                                       │ batch merged
                                       ▼
                           [6] SPECIALIST REVIEW (parallel)
                                       │
                              ══╳ Gate B: triage findings
                                       │
                                       ▼
                               [7] RESOLVE (P1 → P2)
                                       │
                               [8] VERIFY-vs-PLAN (fresh context)
                                       │
                               [9] HARVEST ──► .substrate/
                                       │
                              ══╳ Gate C: PR / merge
```

**Six primitives:** phase, fresh-context boundary, gate, escalation ladder, substrate, slice.

**Four substrate types:**

| Type | Written by | Loaded by |
|---|---|---|
| Vocabulary | harvest | clarify, research, plan-synth (eager) |
| ADR | harvest | research, plan-synth (lazy search) |
| Anti-pattern | harvest | plan-synth, tracer-test, slice-impl (eager, scoped) |
| Solution | harvest | research (lazy search) |

**Four workflow templates:** Feature (the main loop), Spike (exploratory build → substrate only), Optimize (cadence-driven), Consolidate (substrate hygiene, run weekly).

The full theory with all gates, escalation handling, and principle-to-edge citations lives in [`docs/groove.md`](docs/groove.md).

---

## Repo layout

```
skills/                        Skill pack (SKILL.md per skill)
  clarify/
  research/
  plan-synth/
  review-fanout/
  substrate-read/
  substrate-write/
docs/
  groove.md                    The theory (harness-agnostic loop)
  skills-prd.md                Skill pack PRD (14 skills, deep-module shape)
  schemas-and-conventions.md   Artifact shapes, predicate DSL, index formats
  agents/                      Per-repo conventions (issue tracker, labels, domain docs)
  yoke/                        Example Yoke config
.substrate/                    Project knowledge: vocab, ADRs, anti-patterns, solutions, reviewers
  vocabulary/INDEX.md
  adr/INDEX.md
  anti-pattern/INDEX.md
  solution/INDEX.md
  reviewers/INDEX.md
tests/fixtures/                Per-skill fixtures for pressure tests
```

---

## Skill pack status

The pack targets 14 skills. Currently implemented:

| Skill | Phase | Status |
|---|---|---|
| `clarify` | [1] Grill → brainstorm doc | ✅ |
| `research` | [2] Three-track parallel research | ✅ |
| `plan-synth` | [3] Brainstorm + research → plan with slices | ✅ |
| `review-fanout` | [6] Predicate-matched specialist review | ✅ |
| `substrate-read` | Cross-cutting read | ✅ |
| `substrate-write` | Cross-cutting write | ✅ |
| `decompose` | [4] Slice DAG with file-overlap + semantic edges | planned |
| `tracer-test` | [5a] One failing test per slice | planned |
| `slice-impl` | [5b] Minimal code to pass it | planned |
| `slice-refactor` | [5c] Optional cleanup (tests still pass) | planned |
| `resolve-finding` | [7] Apply triage-approved fix | planned |
| `verify-vs-plan` | [8] Fresh-context plan vs. delivered comparison | planned |
| `harvest` | [9] Write 0–4 substrate entries | planned |
| `consolidate` | Weekly substrate hygiene | planned |

---

## How to adopt

### Run by hand (no harness, no skills)

Read [`docs/groove.md`](docs/groove.md). The theory is a loop with named phases, artifact shapes, and three human gates (plan, triage, PR). Run each phase yourself, write the artifacts the loop names, apply the escalation ladder on failure. No tooling required.

### Run interactively in Claude Code

Install the skills from `skills/` into your project (`.claude/skills/`) or your global Claude Code skills directory. Then trigger them by name as you work through the loop:

```
/clarify     → start a feature workflow
/research    → after brainstorm is approved
/plan-synth  → after research is done
...
```

Each skill declares its inputs and outputs in its `SKILL.md` frontmatter. They compose via shared artifact paths (`docs/brainstorms/`, `docs/research/`, `docs/plans/`, `docs/findings.json`) and the substrate — not via direct calls to each other.

### Run AFK in a harness

The Yoke template at [`docs/yoke/feature.yml`](docs/yoke/feature.yml) shows how phases, parallelism, gates, and worktrees compose the pack. Yoke is one option — any harness with per-phase prompts, `items_from` iteration, `pre:`/`post:` hooks, retry ladders, and worktree isolation can run the same skills.

---

## Step-by-step: running a feature interactively

This is the full interactive loop using the Claude Code skill pack. Skip phases you don't need, but don't skip gates.

### Step 1 — Start with clarify

**When:** You have an idea. Any idea. Even a vague one.

**Prompt:**

```
/clarify I want to add email notifications when a workspace member is mentioned in a comment
```

**What happens:** The skill loads your substrate vocabulary and ADR indexes, then grills you one question at a time. It explores your codebase before asking questions whose answers are already in the code. After 4–8 turns it writes `docs/brainstorms/<workflow-id>.md`.

**You're done when:** The brainstorm file exists and you agree with its Summary, Scope, Trigger, Mechanism, Constraints, and Out-of-scope sections.

**Don't move on if:** The brainstorm has open questions you haven't settled — resolve them first or explicitly accept them as open.

---

### Step 2 — Run research

**When:** Brainstorm is approved.

**Prompt:**

```
/research add-email-notifications-mention
```

(Pass the `workflow_id` from the brainstorm frontmatter.)

**What happens:** Three parallel tracks run — codebase patterns, framework/library docs, prior solutions from substrate. Results land in `docs/research/<workflow-id>.md`.

**You're done when:** The research file exists with findings in all three tracks.

---

### Step 3 — Synthesize the plan

**When:** Both brainstorm and research docs exist.

**Prompt:**

```
/plan-synth add-email-notifications-mention
```

**What happens:** The skill loads all four substrate indexes, reads both input docs, and derives vertical slices — each with acceptance criteria (test-in-prose), touched paths, and explicit YAGNI guards. Writes `docs/plans/<workflow-id>.md`.

**Gate A (human, required):** Read the plan. Ask yourself: are these slices thin enough to test independently? Are the acceptance criteria observable? Are the YAGNI guards naming the right things? If yes, proceed. If the plan is wrong, say so — the skill will help you restart from clarify.

**Don't move on if:** You have doubts about the slice boundaries or acceptance criteria. Gate A is the cheapest place to catch a wrong plan.

---

### Step 4 — Decompose (slice DAG)

*(Skill not yet implemented — run by hand or wait for the planned skill.)*

Build the dependency graph: first derive edges mechanically from file-path overlap (slices touching the same paths can't run in parallel). Then augment with semantic edges (slice B needs slice A's output to make sense). The result is topological batches — slices in the same batch run in parallel.

---

### Step 5 — Red, green, (refactor) per slice

*(Skills not yet implemented — run by hand.)*

For each slice in topological order:

1. **RED:** Write exactly one failing test against the slice's acceptance criteria. Not multiple tests. Not implementation alongside the test. One test. It must fail.
2. **GREEN:** Write the minimal code to make the test pass. Anti-patterns from `.substrate/anti-pattern/` that are scoped to the touched paths should be checked before building.
3. **REFACTOR (optional):** Clean up without breaking tests.

Run each slice in fresh agent context. Do not carry state from one slice into the next.

After each batch, merge and run the union test suite. Fail = stop and diagnose before continuing.

---

### Step 6 — Review fanout

**When:** All batches are merged and green.

**Prompt:**

```
/review-fanout
```

(The skill reads the diff and the slice DAG automatically.)

**What happens:** Evaluates each reviewer's predicate in `.substrate/reviewers/` against the diff. Loads body files only for matches. Runs matched reviewers in parallel (3–5 max). Writes `docs/findings.json` sorted P1 → P2 → P3.

**Gate B (human, required):** Triage the findings. P1s must be resolved before proceeding. P2s: your call. P3s: file or defer. If triage reveals the plan was fundamentally wrong, restart from plan-synth.

---

### Step 7 — Resolve findings

*(Skill not yet implemented — run by hand.)*

Apply triage-approved fixes. Start with P1s. Each fix: write the fix, run tests, confirm green.

---

### Step 8 — Verify vs. plan

*(Skill not yet implemented — run by hand or use a fresh context.)*

In a fresh conversation with no history of building this feature, read the original plan and the delivered code. Ask: does the delivered code match the acceptance criteria? Are there slices that over-built beyond their YAGNI guards? Write a short verification report.

---

### Step 9 — Harvest

*(Skill not yet implemented — run by hand.)*

Look at the workflow trace. Ask: did the workflow surface anything worth adding to the substrate?

- Did you encounter or invent a term that isn't in vocabulary? → write a vocabulary entry.
- Did you make a non-obvious architectural choice? → write an ADR.
- Did you see an agent over-build in a way that would happen again? → write an anti-pattern.
- Did you solve a problem someone else might face? → write a solution.

Write 0–4 entries. If the workflow surfaced nothing new, write zero — the substrate should grow only from real signal.

**Gate C (human):** Open the PR. Merge.

---

## Full example: shipping a feature

**Scenario:** You're building a web app. Users want in-app notifications when someone comments on their post.

### 1. Clarify

```
/clarify I want to add in-app notifications when someone comments on a post
```

The skill grills you:

> I checked the codebase — there's already a `User` model with an `email` field and a `notifications` table with a `type` and `read_at` column. Given that, my first question: should this notification appear only in the app UI, or should it also send an email?

You answer: in-app only for now. The skill asks about triggers, delivery, read/unread state. After 5 turns it writes `docs/brainstorms/add-comment-notifications.md`.

### 2. Research

```
/research add-comment-notifications
```

Track 1 finds: existing `Comment` model, `Notification` model, `NotificationsController`. Track 2 finds: your framework's real-time push API. Track 3 finds no relevant prior substrate entries. Writes `docs/research/add-comment-notifications.md`.

### 3. Plan-synth

```
/plan-synth add-comment-notifications
```

Produces three slices:

```yaml
slices:
  - id: create-notification-on-comment
    title: Create notification record when a comment is posted
    acceptance_criteria:
      - "Given a post exists and user B comments on it, when the comment is saved, then a notification row is inserted for the post author with type=comment and read_at=null."
    touched_paths:
      - src/comments/comment.service.ts
      - src/notifications/**
    semantic_depends_on: []
    out_of_scope:
      - Email delivery
      - Push delivery to mobile clients
      - Batch notification digests

  - id: mark-notification-read
    title: Mark notification as read when user views it
    acceptance_criteria:
      - "Given an unread notification exists, when the user GETs /notifications/:id, then read_at is set to now."
    touched_paths:
      - src/notifications/**
    semantic_depends_on: []
    out_of_scope:
      - Bulk mark-all-read endpoint

  - id: list-unread-notifications
    title: Expose unread notification count in the API
    acceptance_criteria:
      - "Given 3 unread notifications exist for a user, when the user GETs /notifications?unread=true, then the response contains exactly 3 items with read_at=null."
    touched_paths:
      - src/notifications/**
    semantic_depends_on: []
    out_of_scope:
      - Pagination beyond 50 results
      - Filtering by notification type
```

**Gate A:** You read the plan. The slices are thin, criteria are testable, YAGNI guards are specific. You approve.

### 4. Implement slices

For each slice (fresh agent context per slice):

**RED for slice 1:**
```
Write one failing test: when a comment is saved, a notification row is inserted for the post author.
```

Test file created. You run it — it fails (notification service doesn't exist yet). Good.

**GREEN for slice 1:**
```
Write minimal code to make that test pass.
```

Agent adds the notification insert to the comment service. Test passes. Lint passes. Done.

Repeat for slices 2 and 3.

### 5. Review fanout

```
/review-fanout
```

Diff touches `src/notifications/**` and `src/comments/comment.service.ts`. The security-sentinel predicate doesn't match (no auth paths changed). The code-simplicity reviewer fires (`always: true`). Finds one P2: the notification query doesn't have an index on `user_id + read_at`. You note it. The architecture reviewer fires on new files — finds that the notification insert is synchronous inside the comment service, coupling two domains. P2.

**Gate B:** You triage. P1s: none. P2s: you decide to add the index (quick) and defer the async decoupling to a follow-on issue (it's real but not blocking).

### 6. Resolve

Add the database index. Tests pass. File a GitHub issue for the async decoupling.

### 7. Verify

Fresh context. Read the plan, read the delivered code. Delivered code matches acceptance criteria. No over-building beyond YAGNI guards. Pass.

### 8. Harvest

The workflow surfaced one term the substrate didn't have: "notification fan-out pattern" (the technique of inserting a notification row per recipient vs. a single notification row with a recipients junction). Write a vocabulary entry. The async-coupling issue is a P2 finding filed to GitHub — not a substrate entry (it's a deferred task, not project knowledge). Write zero other entries. Total: 1 entry.

**Gate C:** Open PR, review, merge.

---

## When to use which skill

| Situation | Skill |
|---|---|
| Starting any feature (even tiny) | `/clarify` |
| After brainstorm is approved | `/research` |
| After research is done, need a plan | `/plan-synth` |
| All batches green, need review | `/review-fanout` |
| Need to query what the project knows | `/substrate-read` |
| harvest or consolidate needs to persist knowledge | `/substrate-write` |
| Issue deliverable is authored content (docs, configs, SKILL.md files) | `/implement-issue` |
| Not sure which skill fits | ask Claude — it reads the SKILL.md descriptions |

**Don't use `/clarify` if you already have a brainstorm doc.** Go straight to `/research`.

**Don't skip Gate A.** A wrong plan that makes it to implementation costs 10x more to fix than a wrong plan caught at Gate A.

**Don't invent substrate entries.** `harvest` writes entries when the workflow surfaced real signal. If nothing was surprising, write zero.

---

## Key conventions

- **Format.** Markdown for prose. YAML frontmatter for metadata. YAML in fenced blocks for nested data (slice lists, predicates). JSON for inter-phase machine artifacts (findings, slice DAG). XML only for in-prompt section delimiters.
- **Substrate is append-only.** New entries use `supersedes: [old-id]`; old entries stay on disk.
- **Skills are deep modules.** Small public interface (trigger, inputs, outputs, substrate access); deep, mutable implementation. The interface is what other skills, harnesses, and developers depend on.
- **Skills are harness-agnostic.** They compose via shared artifact paths and substrate, not direct calls.
- **Workflow IDs are kebab-case slugs** derived from the feature idea (strip articles, first 4–6 words). Used as the `workflow_id` frontmatter field across all docs in one worktree.

---

## Status

The theory and schemas are stable. The skill pack is being built out under [GitHub Issues](https://github.com/jdforsythe/groove/issues) — 6 of 14 skills implemented. See `docs/skills-prd.md` for the v1 plan.

---

## Credits

Groove draws on:

- John Ousterhout's *A Philosophy of Software Design* (deep modules, complexity as cumulative drag)
- Kent Beck's tracer-bullet TDD (one test, one impl, repeat)
- Matt Pocock's `setup-matt-pocock-skills` and triage skill set (issue-tracker conventions, AGENT-BRIEF discipline)
- The Superpowers project's pressure-testing methodology for skills with fuzzy LLM behavior
- Compound Engineering's substrate idea (system improvements per feature shipped)
