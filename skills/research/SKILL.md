---
name: research
description: >-
  Run three parallel research tracks after an approved brainstorm doc: codebase
  patterns, framework/library docs, and prior solutions from substrate. Writes
  docs/research/<workflow_id>.md with workflow-doc frontmatter, a Summary block,
  and one citable section per track. Refuses to start if the brainstorm doc is absent.
inputs:
  brainstorm_doc: "docs/brainstorms/<workflow_id>.md — must exist and be approved before invoking"
outputs:
  research_doc: "docs/research/<workflow_id>.md — workflow-doc frontmatter (type: research) + ## Summary block (≤5 lines) + three track sections"
substrate_access:
  pattern: lazy
  reads: []
  on_demand: >-
    ADR entries and solution entries queried via substrate-read by topic or
    tag:<value> derived from the brainstorm; no direct index reads
---

## Summary

Triggered after a brainstorm doc is approved and present at `docs/brainstorms/<workflow_id>.md`. Refuses to proceed if that file does not exist. Derives research queries from the brainstorm. Runs three tracks in parallel — codebase patterns, framework/library docs, prior solutions via `substrate-read`. Produces `docs/research/<workflow_id>.md` with valid workflow-doc frontmatter (`type: research`) and a `## Summary` block of ≤5 lines, followed by one citable section per track.

## Procedure

### Step 1 — Verify the brainstorm doc exists

Before doing anything else, check that `docs/brainstorms/<workflow_id>.md` exists.

If the file does not exist, stop immediately and output:

```
Cannot start research: no approved brainstorm doc found at docs/brainstorms/<workflow_id>.md.
Run the clarify skill first, or pass the correct workflow_id.
```

Do not proceed.

### Step 2 — Read the brainstorm doc

Read `docs/brainstorms/<workflow_id>.md` in full. Extract:

- **Feature topic** — the `description` frontmatter field and the `## Summary` block content
- **Scope** — the `## Scope` section
- **Mechanism** — the `## Mechanism` section
- **Constraints** — the `## Constraints` section
- **Out of scope** — the `## Out of scope` section

From these sections, derive 3–5 research query terms for use across all three tracks. Prefer the vocabulary the brainstorm uses (respect domain terms from the project). Terms should be specific enough to return focused results — not "user" but "notification delivery" or "workspace member event".

### Step 3 — Run all three tracks in parallel

Run the following three tracks simultaneously. Each track is independent; do not wait for one before starting another.

<parallel-tracks>

#### Track 1 — Codebase patterns

Explore the project codebase for patterns relevant to the feature described in the brainstorm.

1. Search for existing modules, files, and directories whose names relate to the research query terms.
2. Identify relevant data models, interfaces, services, event handlers, and middleware already present in the codebase.
3. Note architectural patterns in use: how are similar features implemented? What layers exist? How does data flow between them?
4. Identify any utilities, abstractions, or shared infrastructure (queues, event buses, auth helpers, HTTP clients) relevant to the feature.
5. Record 3–6 concrete findings. For each finding: path, a one-sentence description of relevance.

Do not read substrate indexes directly. This track is codebase-only.

#### Track 2 — Framework and library docs

Research the frameworks, libraries, and external APIs relevant to the feature described in the brainstorm.

1. Identify the key frameworks and libraries involved (infer from the codebase in Track 1 and the brainstorm's mechanism and constraints).
2. For each relevant framework or library, look up:
   - The specific API surface, method signatures, or config options relevant to the feature
   - Known constraints, edge cases, or pitfalls for this use case
   - Version-specific behavior if the brainstorm or codebase reveals a version constraint
3. Record 3–6 concrete findings. For each finding: library/framework name + version if known, the specific API or behavior, and relevance to the feature.

Do not read substrate indexes directly. This track is external-docs-only.

#### Track 3 — Prior solutions via substrate-read

Query the substrate for prior solutions and ADR decisions relevant to the feature.

1. For each research query term derived in Step 2, call `substrate-read` with a topic query (e.g. `notification delivery`) or a tag query (`tag:notifications`). Use both forms if the term has a known tag in the project.
2. Call `substrate-read` with `type_filter: solution` first to surface directly reusable prior solutions.
3. Call `substrate-read` with `type_filter: adr` to surface architectural decisions that constrain or inform the design.
4. Do NOT read `.substrate/` index files directly. All substrate access goes through `substrate-read`.
5. Record all returned hits with stop-depth ≥ `summary`. For each hit: type, id, description, and the relevance to the feature in one sentence.

</parallel-tracks>

### Step 4 — Synthesize the research doc

After all three tracks complete, write `docs/research/` if it does not exist. Then write `docs/research/<workflow_id>.md` with the following structure:

```markdown
---
id: <workflow_id>
type: research
description: <one-line summary of what was researched, ≤200 chars>
created: <YYYY-MM-DD>
workflow_id: <workflow_id>
---

## Summary

<≤5 lines: what the three tracks surfaced, any tensions between codebase state and framework docs, and the most important prior-solution or ADR constraint the plan must respect>

## Track 1 — Codebase Patterns

<3–6 findings. For each: file path or module name (as a relative path from repo root), one sentence explaining its relevance to the feature. Use a bullet list.>

## Track 2 — Framework and Library Docs

<3–6 findings. For each: library/framework name and version if known, the specific API or behavior discovered, one sentence explaining its relevance. Use a bullet list.>

## Track 3 — Prior Solutions and ADRs

<All substrate-read hits with stop-depth ≥ summary. For each: substrate type, id, description from the index, one sentence explaining relevance to the feature. If no hits were returned, state "No relevant substrate entries found." Use a bullet list.>
```

The `id` and `workflow_id` fields must match the brainstorm doc's `workflow_id`. The `created` date is today's date.

### Step 5 — Confirm output

After writing the file, confirm the path to the user and state that the research doc is ready for the `plan-synth` phase.

## Constraints

- Never proceed if `docs/brainstorms/<workflow_id>.md` does not exist — refuse immediately with the message from Step 1.
- Never read substrate index files directly — all substrate access goes through `substrate-read`.
- The three tracks in Step 3 run in parallel, not sequentially.
- The `## Summary` block must be ≤5 non-blank lines.
- The `description` frontmatter field must be ≤200 characters.
- The `id` and `workflow_id` fields must match and conform to the workflow-id convention (kebab-case, `[a-z0-9-]`, max 50 chars).
- Each track section must contain only findings attributable to that track's method — no cross-contamination.
