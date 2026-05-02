---
name: plan-synth
description: >-
  Synthesize a brainstorm doc and research doc into a slice-decomposed plan doc.
  Fires when both docs/brainstorms/<workflow_id>.md and docs/research/<workflow_id>.md exist.
inputs:
  brainstorm_doc: "docs/brainstorms/<workflow_id>.md"
  research_doc: "docs/research/<workflow_id>.md"
outputs:
  plan_doc: "docs/plans/<workflow_id>.md — workflow-doc frontmatter (type: plan) + ## Summary block (≤5 lines) + YAML slice list in fenced block"
substrate_access:
  pattern: eager
  reads:
    - .substrate/vocabulary/INDEX.md
    - .substrate/adr/INDEX.md
    - .substrate/anti-pattern/INDEX.md
    - .substrate/solution/INDEX.md
  on_demand: "Bodies fetched via substrate-read only when an index entry is directly relevant to a slice boundary or constraint"
---

## Summary

Triggered when both `docs/brainstorms/<workflow_id>.md` and `docs/research/<workflow_id>.md` are present. Refuses to proceed if either is absent. Eagerly loads all four substrate indexes before planning. Derives vertical slices from brainstorm scope, research findings, and substrate signals — each slice has independently testable acceptance criteria and explicit YAGNI guards. Produces `docs/plans/<workflow_id>.md` with valid workflow-doc frontmatter (`type: plan`), a `## Summary` block ≤5 lines, and the slice list as YAML in a fenced block.

## Procedure

### Step 1 — Verify inputs

Before doing anything else, check that both input files exist:

- `docs/brainstorms/<workflow_id>.md`
- `docs/research/<workflow_id>.md`

If either file is absent, stop immediately and output:

```
Cannot start plan-synth: missing required input(s).
  Missing: docs/brainstorms/<workflow_id>.md   (if absent)
  Missing: docs/research/<workflow_id>.md      (if absent)
Run the clarify skill first to produce the brainstorm doc, then the research skill to produce the research doc.
```

Do not proceed until both files exist.

### Step 2 — Load eager substrate (before synthesizing)

Before reading any input docs, load all four substrate indexes:

- `.substrate/vocabulary/INDEX.md`
- `.substrate/adr/INDEX.md`
- `.substrate/anti-pattern/INDEX.md`
- `.substrate/solution/INDEX.md`

Read the index layer only — do not open any entry body files at this stage. Record:

- Domain terms relevant to the feature (vocabulary index)
- Accepted architectural decisions that constrain slice boundaries (ADR index)
- Anti-patterns in scope for paths the feature will touch (anti-pattern index)
- Prior solutions whose approach may be reused or extended (solution index)

If an index entry is ambiguous relative to the feature's scope, open that entry's body via `substrate-read` to resolve the ambiguity before proceeding to Step 3.

### Step 3 — Read the input docs

Read both input docs in full.

From `docs/brainstorms/<workflow_id>.md`, extract:

- **Feature topic** — the `description` frontmatter field and `## Summary` block
- **Scope** — `## Scope` section (who is affected, what is included)
- **Trigger** — `## Trigger` section (what initiates the feature)
- **Mechanism** — `## Mechanism` section (how the outcome is delivered)
- **Constraints** — `## Constraints` section (prior decisions, technical limits)
- **Out of scope** — `## Out of scope` section (explicit exclusions)
- **Open questions** — `## Open questions` section (unresolved uncertainties, if present)

From `docs/research/<workflow_id>.md`, extract:

- **Codebase patterns** — Track 1 findings (file paths, architectural patterns relevant to the feature)
- **Framework / library constraints** — Track 2 findings (API surfaces, known edge cases)
- **Prior solutions and ADRs** — Track 3 findings (substrate hits that constrain or inform design)

Use these three sources — brainstorm, research, substrate indexes — to inform every slice decision in Step 4.

### Step 4 — Synthesize slices

Derive the slice list. Each slice is a vertical unit of work: a self-contained change that can be implemented, reviewed, and tested independently.

Apply the following rules for each slice:

#### 4a. Slice boundaries

- A slice must correspond to a coherent behavioral change, not a file or layer. Slices cut vertically through the stack (model + service + API + UI, or equivalent layers in the project).
- A slice must be small enough that its acceptance criteria can be confirmed by a single automated test or a clearly described manual check.
- If the research found multiple independent subsystems that must change, each subsystem is a separate slice unless they share a data model that must change atomically.
- If an ADR or anti-pattern index entry constrains how a boundary should be drawn, respect it.

#### 4b. `acceptance_criteria`

For each slice, write ≥1 acceptance criterion. Each criterion must:

- Describe one observable behavior — what a reviewer can verify against the running system or test suite.
- Use test-in-prose phrasing: "Given X, when Y, then Z" or "After Y, Z is observable."
- Not describe implementation steps — describe outcomes.

#### 4c. `touched_paths`

For each slice, populate `touched_paths` with the set of globs (relative to repo root) that will be created or modified. Base these on the codebase patterns found in the research doc. Use the narrowest glob that is accurate — prefer `src/notifications/delivery.ts` over `src/**`. If the exact path is uncertain, use a directory-level glob (e.g., `src/notifications/**`).

#### 4d. `semantic_depends_on`

Leave `semantic_depends_on` as an empty array on every slice. This field is populated by the `decompose` skill in the next phase.

#### 4e. YAGNI guards (`out_of_scope`)

For each slice, ask: what might a GREEN (over-eager) implementation agent add that is not required by the acceptance criteria? Enumerate those items in `out_of_scope`.

Typical YAGNI guard categories:
- Configuration or feature-flag infrastructure not needed for the slice
- Admin UI for data that can be seeded or managed via DB tooling
- Retry logic, dead-letter queues, or circuit breakers beyond what the brainstorm specified
- Observability instrumentation beyond what is already project-standard
- Generalization of a pattern that has only one instance so far
- Tests for error paths that are unreachable given the constraints

If a slice genuinely has no foreseeable over-build risk, state the rationale explicitly as a one-item array: `["No foreseeable over-build risk for this atomic slice."]`. Do not leave `out_of_scope` empty.

#### 4f. Substrate signals

Before finalizing the slice list:

- If any solution index entry describes a prior solution directly relevant to a slice's mechanism, call `substrate-read` to fetch its body and incorporate its approach or reference it in the slice's notes.
- If any anti-pattern index entry applies to a `touched_paths` glob in the slice, call `substrate-read` to fetch the anti-pattern body and verify the slice's approach does not violate it.

### Step 5 — Write the plan doc

Create `docs/plans/` if it does not exist. Write `docs/plans/<workflow_id>.md` with this structure:

````markdown
---
id: <workflow_id>
type: plan
description: <one-line summary of the feature plan, ≤200 chars>
created: <YYYY-MM-DD>
workflow_id: <workflow_id>
---

## Summary

<≤5 lines: what this plan covers, how many slices, any major substrate constraints or ADR decisions reflected in the slice boundaries>

## Slices

```yaml
slices:
  - id: <kebab-case-id>
    title: <descriptive title, ≤120 chars>
    acceptance_criteria:
      - "Given ..., when ..., then ..."
    touched_paths:
      - src/path/to/changed/file.ts
    semantic_depends_on: []
    out_of_scope:
      - <YAGNI guard>

  - id: <kebab-case-id>
    title: <descriptive title, ≤120 chars>
    acceptance_criteria:
      - "Given ..., when ..., then ..."
    touched_paths:
      - src/path/to/changed/file.ts
    semantic_depends_on: []
    out_of_scope:
      - <YAGNI guard>
```
````

The `id` and `workflow_id` fields must match the brainstorm and research docs' `workflow_id`. The `created` date is today's date.

### Step 6 — Integrity check

Before confirming the output, verify:

1. **Unique slice ids** — all `id` values in the slice list are unique and conform to kebab-case (`[a-z0-9]+(-[a-z0-9]+)*`).
2. **Empty `semantic_depends_on`** — every slice has `semantic_depends_on: []`.
3. **Acceptance criteria present** — every slice has ≥1 `acceptance_criteria` entry, each non-empty.
4. **Non-empty `out_of_scope`** — every slice has ≥1 item in `out_of_scope`, or an explicit rationale item.
5. **`touched_paths` populated** — every slice has ≥1 glob in `touched_paths`.
6. **Frontmatter validity** — `type: plan`, `description` ≤200 chars, `id` and `workflow_id` match and conform to the workflow-id convention.
7. **Summary length** — `## Summary` block is ≤5 non-blank lines.

If any check fails, correct the plan doc before confirming output. Do not report the plan as complete if any check fails.

### Step 7 — Confirm output

After writing and verifying the file, confirm the path to the user and state that the plan doc is ready for the `decompose` phase.

## Constraints

- Never proceed if either `docs/brainstorms/<workflow_id>.md` or `docs/research/<workflow_id>.md` is absent — refuse immediately with the message from Step 1.
- All four substrate indexes must be loaded before any slice is written — no exceptions.
- Slice ids must be unique, kebab-case, and ≤50 chars.
- `semantic_depends_on` must be empty on every slice — it is the `decompose` skill's responsibility to populate it.
- `out_of_scope` must be non-empty on every slice, or contain an explicit no-risk rationale.
- The `## Summary` block must be ≤5 non-blank lines.
- The `description` frontmatter field must be ≤200 characters.
- The `id` and `workflow_id` frontmatter fields must match the brainstorm and research docs' `workflow_id`.
- Never mention Yoke or any specific harness.
- Do not proceed to Step 5 until the integrity check in Step 6 is mentally verified against the draft slices.
