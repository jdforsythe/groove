---
name: decompose
description: >-
  Derive the slice execution DAG from an approved plan. Fires when
  docs/plans/<workflow_id>.md exists and has been approved. Two phases: (a)
  mechanical file-overlap edges — derived from touched_paths intersections, no
  LLM reasoning; (b) agent-added semantic edges with reason fields. Extends the
  plan doc in place; stores the updated slice YAML in a fenced block.
inputs:
  plan_doc: "docs/plans/<workflow_id>.md — workflow-doc frontmatter (type: plan) + ## Summary block + YAML slice list in fenced block"
outputs:
  plan_doc: "docs/plans/<workflow_id>.md — same file, slice list extended with semantic_depends_on edges from both phases"
substrate_access:
  pattern: none
  reads: []
  rationale: "decompose reads only the plan. No substrate access. Substrate signals were already incorporated by plan-synth."
---

## Summary

Triggered when `docs/plans/<workflow_id>.md` is present and approved. Reads the plan's slice list, derives a dependency DAG in two explicit phases, and writes the extended slice list back into the same plan doc. Phase (a) is deterministic set-intersection over `touched_paths` — no LLM judgment. Phase (b) adds semantic edges with `reason` fields. The validator rejects any output that drops a phase-(a) edge, contains a cycle, or references a non-existent slice id.

## Procedure

### Step 1 — Verify input

Check that `docs/plans/<workflow_id>.md` exists. If absent, stop immediately and output:

```
Cannot start decompose: docs/plans/<workflow_id>.md not found.
Run plan-synth first to produce the plan doc, then obtain approval before running decompose.
```

Do not proceed until the file exists.

### Step 2 — Parse the slice list

Read `docs/plans/<workflow_id>.md`. Locate the fenced `yaml` block under `## Slices`. Parse the YAML. Extract:

- Each slice's `id`
- Each slice's `touched_paths` array

Confirm every slice has `semantic_depends_on: []` (as produced by `plan-synth`). If any slice already has non-empty `semantic_depends_on`, stop and ask the user whether the plan doc was already partially processed by a previous decompose run. Do not overwrite existing edges silently.

### Step 3 — Phase (a): Derive file-overlap edges (mechanical, no LLM reasoning)

This phase is purely algorithmic. No LLM judgment about file semantics is used.

#### 3a. Compute pairwise path intersections

For every ordered pair of distinct slices `(A, B)`:

1. Compute `overlap = intersection(A.touched_paths, B.touched_paths)`.
2. Use exact string equality on the glob strings themselves (do not expand globs — compare the written glob patterns as strings).
3. If `overlap` is non-empty, record an undirected overlap relationship between `A` and `B`, noting the shared paths.

#### 3b. Assign edge direction

For each overlapping pair `(A, B)`, assign a directed dependency edge. Apply this decision rule in order:

1. **Creation vs. mutation:** If one slice's `touched_paths` includes a database migration or schema file (e.g., `src/db/migrations/**`, `*.sql`, `*.prisma`, `schema.*`) and the other does not, the schema slice is the dependency (the non-schema slice depends on it).
2. **Model vs. service:** If one slice's `touched_paths` includes a model or entity file (e.g., `src/models/**`, `*.entity.*`) and the other touches only service or controller files, the model slice is the dependency.
3. **Mutual overlap (neither rule applies):** If neither rule resolves direction, record both slices as candidates for direction assignment and flag the pair for phase (b). In the phase (a) output, pick the alphabetically earlier slice id as the dependency — this is a stable placeholder; phase (b) may override the direction but must preserve the edge.

#### 3c. Build the phase-(a) edge list

Collect all directed edges as an ordered list:

```
phase_a_edges = [
  { from: "<slice_id>", to: "<dep_slice_id>", shared_paths: ["..."] },
  ...
]
```

This list is the invariant that the validator checks. Every edge in `phase_a_edges` must appear in the final output's `semantic_depends_on` with no `reason` field.

#### 3d. Cycle check after phase (a)

Before proceeding to phase (b), verify the directed edges from step 3b form an acyclic graph. Run a topological sort (Kahn's algorithm or DFS-based). If a cycle exists, stop and report:

```
Phase (a) produced a cycle. This means two or more slices share touched_paths in a way that
creates a circular dependency. The plan must be revised before decompose can proceed.

Cycle: <slice_id> → <dep_id> → ... → <slice_id>
Shared paths involved: <paths>

Options:
1. Edit the plan to separate the conflicting paths into a new slice.
2. Re-run decompose after plan approval.
```

Do not proceed to phase (b) if a cycle exists after phase (a).

### Step 4 — Phase (b): Add semantic edges (agent judgment, additive only)

<constraint>Phase (b) may only ADD edges to semantic_depends_on. It must not remove, modify, or reassign any edge established in phase (a).</constraint>

Review the full slice list — titles, acceptance criteria, and touched_paths — and consider whether any slices have dependencies not captured by file overlap. Examples of semantic (non-file) dependencies:

- Slice B calls an API or function defined by slice A, even if they touch different files.
- Slice B's implementation requires knowledge of an interface, type, or contract authored in slice A.
- Slice B can only be tested correctly once slice A's behavior is observable in the running system.
- Slice B's acceptance criterion references an entity or concept created by slice A.

For each semantic dependency identified:

1. Verify the dependency id references a real slice id in this plan. If not, skip it — do not create a dangling reference.
2. Verify adding the edge does not create a cycle. If it would, skip it and note the conflict.
3. Add the edge to `semantic_depends_on` with a `reason` field that explains the non-file dependency in one sentence.

Do not add a semantic edge between two slices just because they are related in theme. The edge must represent a real ordering constraint: slice B cannot proceed (or cannot be correctly tested) until slice A is complete.

#### 4a. Direction resolution for flagged pairs

For any pair flagged in step 3c (mutual overlap, alphabetical placeholder direction), revisit the direction now. Use your understanding of each slice's acceptance criteria and implementation intent to assign the correct direction. The edge must exist in the final output — direction change is permitted, but edge removal is not.

#### 4b. Phase (b) cycle check

After adding all semantic edges, run the topological sort again. If a semantic edge introduced a cycle, remove that edge and note it in the output:

```
Semantic edge <from> → <to> was skipped: it would create a cycle.
Reason attempted: "<reason>"
```

### Step 5 — Integrity check

Before writing output, verify:

1. **All phase-(a) edges present:** For every edge in `phase_a_edges`, the final slice list contains a `semantic_depends_on` entry with matching `id` and no `reason` field.
2. **Semantic edges have reason:** Every edge added in phase (b) has a non-empty `reason` field.
3. **No dangling ids:** Every `semantic_depends_on[*].id` in the final output references a real slice `id` in this plan.
4. **DAG is acyclic:** Topological sort of the final edge set succeeds.
5. **Slice ids unique and unchanged:** No slice `id` was altered; all original slices are present.
6. **No other slice fields modified:** Only `semantic_depends_on` arrays were changed. All other fields (`title`, `acceptance_criteria`, `touched_paths`, `out_of_scope`) are identical to the plan doc's original values.

If any check fails, correct the issue before writing output. Do not write a partial or invalid DAG.

### Step 6 — Write output

Update `docs/plans/<workflow_id>.md` in place:

- Keep all frontmatter and prose sections unchanged.
- Replace only the YAML slice list in the `## Slices` fenced block with the updated slice list.
- The updated slice list must be valid YAML parseable as a `slices:` array.

Output format within the fenced block:

````markdown
```yaml
slices:
  - id: <id>
    title: <title>
    acceptance_criteria:
      - "<criterion>"
    touched_paths:
      - <path>
    semantic_depends_on:
      - id: <dep_id>
      # file-overlap edges have no reason field
      - id: <dep_id>
        reason: "<why this slice depends on the other>"
    out_of_scope:
      - <guard>
```
````

After writing, confirm the output to the user:

```
decompose complete.
Plan: docs/plans/<workflow_id>.md
Slices: <N>
Phase (a) edges: <count> (file-overlap, no reason field)
Phase (b) edges: <count> (semantic, with reason field)
Topological batches:
  Batch 1 (no dependencies): <slice ids>
  Batch 2 (depends on batch 1): <slice ids>
  ...
```

The plan doc is now ready for the build phase, which consumes the DAG to derive topological batches for parallel execution.

## Constraints

- **No substrate access.** This skill reads only the plan doc. Substrate signals were incorporated by `plan-synth`. Do not open any substrate file.
- **Two phases are mandatory and explicit.** Phase (a) must complete (including its cycle check) before phase (b) begins. The phases must not be merged or collapsed.
- **Phase (a) is purely mechanical.** No LLM reasoning about file semantics in phase (a). Only set intersection on `touched_paths` strings and the three-rule direction algorithm.
- **Phase (b) is additive only.** The agent may add edges and may correct placeholder direction from step 3c, but must not remove any edge that phase (a) established.
- **File-overlap edges have no `reason` field.** If an edge was derived in phase (a), its entry in `semantic_depends_on` must contain only `id:`. Adding a `reason` field to a file-overlap edge is a schema violation.
- **Semantic edges must have a `reason` field.** Every edge added in phase (b) must have a non-empty `reason` explaining the non-file dependency.
- **Output must be acyclic.** If the final DAG contains a cycle, do not write it — report the cycle and stop.
- **All dep ids must be real.** No dangling references. Check every `id` in `semantic_depends_on` against the slice list before writing.
- **Extend in place.** Do not create a new file. Update `docs/plans/<workflow_id>.md` in place, changing only the YAML in the `## Slices` fenced block.
- **Never mention any specific harness.** Skills compose via shared artifact paths; the composition graph is the harness's concern.
