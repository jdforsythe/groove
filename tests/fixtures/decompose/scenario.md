# decompose fixture

Unit-test specification document. Defines input plan fixtures and expected DAG topology used to verify that an agent following the `decompose` procedure produces the correct slice DAG. Also verifies that file-overlap edges derived in phase (a) cannot be dropped by the agent in phase (b).

The fixtures are fixed. When a scenario fails the check, edit the SKILL.md procedure — not this document.

---

## Scenario 1 — File-overlap edges derived mechanically from touched_paths

**Description:** A plan with four slices where file overlap is unambiguous. Verifies that phase (a) produces exactly the right set of file-overlap edges and that no `reason` field is present on them.

### Input plan (`docs/plans/add-email-notifications.md`)

````markdown
---
id: add-email-notifications
type: plan
description: Add transactional email notifications triggered by workspace events.
created: 2026-05-01
workflow_id: add-email-notifications
---

## Summary

Four slices covering the data model, delivery service, event wiring, and user preferences
for transactional email. Each slice can be implemented and tested independently, with
dependency ordering enforced by the DAG.

## Slices

```yaml
slices:
  - id: data-model
    title: Add notification record and preferences schema
    acceptance_criteria:
      - "Given a new workspace event, a notification record is persisted with status=pending."
    touched_paths:
      - src/db/migrations/**
      - src/models/notification.ts
      - src/models/user-preferences.ts
    semantic_depends_on: []
    out_of_scope:
      - Delivery logic or retry queues.

  - id: delivery-service
    title: Implement email delivery service
    acceptance_criteria:
      - "Given a notification record in status=pending, the delivery service sends the email and sets status=sent."
    touched_paths:
      - src/services/email-delivery.ts
      - src/models/notification.ts
    semantic_depends_on: []
    out_of_scope:
      - SMS or push delivery channels.

  - id: event-wiring
    title: Wire workspace events to notification creation
    acceptance_criteria:
      - "Given a workspace-member-added event, a notification record is created in the database."
    touched_paths:
      - src/events/workspace-events.ts
      - src/services/notification-creator.ts
      - src/models/notification.ts
    semantic_depends_on: []
    out_of_scope:
      - Delivery; only creation is in scope for this slice.

  - id: user-preferences
    title: Expose user notification preferences API
    acceptance_criteria:
      - "Given a PUT /users/:id/notification-preferences request, preferences are persisted and returned."
    touched_paths:
      - src/api/users.ts
      - src/models/user-preferences.ts
    semantic_depends_on: []
    out_of_scope:
      - Preference-gated delivery filtering (downstream concern).
```
````

### Phase (a) — File-overlap derivation (mechanical, no LLM reasoning)

For each pair of slices, compute `intersection(touched_paths_A, touched_paths_B)`. A non-empty intersection means the later slice in topological order depends on the earlier one. Where the dependency direction is ambiguous (both slices share a file and neither is clearly "earlier"), the agent resolves direction using semantic understanding only in phase (b) — phase (a) records the overlap edge without direction assignment and marks it for phase (b) review.

Overlap computation (exact path matching, not glob expansion — globs are matched by string equality at the glob level for this fixture):

| Slice A | Slice B | Shared paths | Edge exists? |
|---|---|---|---|
| data-model | delivery-service | `src/models/notification.ts` | yes |
| data-model | event-wiring | `src/models/notification.ts` | yes |
| data-model | user-preferences | `src/models/user-preferences.ts` | yes |
| delivery-service | event-wiring | `src/models/notification.ts` | yes |
| delivery-service | user-preferences | (none) | no |
| event-wiring | user-preferences | (none) | no |

### Expected output — after phase (a) only

After phase (a) completes, the slice list has file-overlap edges inserted. No `reason` field is present on any edge. The direction of each edge is: the slice that *creates* a shared resource depends on... — when direction cannot be determined mechanically from file names alone, both directed edge candidates are recorded and flagged for phase (b) to resolve direction.

For this fixture, direction is resolved by the agent in phase (b) based on semantic understanding. The expected final DAG (after both phases) is shown in Scenario 2 below. What phase (a) guarantees: every pair with overlap produces at least one edge in the final output. The validator checks this invariant.

**File-overlap edges that MUST appear in final output (no `reason` field on any of these):**

- `delivery-service` depends on `data-model` (shared: `src/models/notification.ts`) — no reason field
- `event-wiring` depends on `data-model` (shared: `src/models/notification.ts`) — no reason field
- `user-preferences` depends on `data-model` (shared: `src/models/user-preferences.ts`) — no reason field
- Either `event-wiring` depends on `delivery-service` OR `delivery-service` depends on `event-wiring` (shared: `src/models/notification.ts`) — whichever direction the agent assigns, it must exist and have no reason field

### What this scenario verifies

- Phase (a) produces file-overlap edges for every pair of slices that share a path.
- No `reason` field appears on file-overlap edges.
- Phase (a) produces no edges between slices with disjoint `touched_paths`.
- The mechanical derivation uses only set intersection on `touched_paths` — no LLM reasoning about file semantics.

---

## Scenario 2 — Full two-phase execution: expected final DAG topology

**Description:** Using the same plan from Scenario 1, the agent runs both phases. Phase (a) produces file-overlap edges; phase (b) adds semantic edges and assigns direction where ambiguous. The result must be a valid, acyclic DAG.

### Expected final output (YAML in fenced block in `docs/plans/add-email-notifications.md`)

```yaml
slices:
  - id: data-model
    title: Add notification record and preferences schema
    acceptance_criteria:
      - "Given a new workspace event, a notification record is persisted with status=pending."
    touched_paths:
      - src/db/migrations/**
      - src/models/notification.ts
      - src/models/user-preferences.ts
    semantic_depends_on: []
    out_of_scope:
      - Delivery logic or retry queues.

  - id: delivery-service
    title: Implement email delivery service
    acceptance_criteria:
      - "Given a notification record in status=pending, the delivery service sends the email and sets status=sent."
    touched_paths:
      - src/services/email-delivery.ts
      - src/models/notification.ts
    semantic_depends_on:
      - id: data-model
      # no reason field — this is a file-overlap edge
    out_of_scope:
      - SMS or push delivery channels.

  - id: event-wiring
    title: Wire workspace events to notification creation
    acceptance_criteria:
      - "Given a workspace-member-added event, a notification record is created in the database."
    touched_paths:
      - src/events/workspace-events.ts
      - src/services/notification-creator.ts
      - src/models/notification.ts
    semantic_depends_on:
      - id: data-model
      # no reason field — file-overlap edge
      - id: delivery-service
        reason: "event-wiring calls the delivery service to dispatch emails after creating records; needs the delivery service's API shape."
    out_of_scope:
      - Delivery; only creation is in scope for this slice.

  - id: user-preferences
    title: Expose user notification preferences API
    acceptance_criteria:
      - "Given a PUT /users/:id/notification-preferences request, preferences are persisted and returned."
    touched_paths:
      - src/api/users.ts
      - src/models/user-preferences.ts
    semantic_depends_on:
      - id: data-model
      # no reason field — file-overlap edge
    out_of_scope:
      - Preference-gated delivery filtering (downstream concern).
```

### DAG topology assertions

1. `data-model` has no dependencies — it is the root.
2. `delivery-service` depends on `data-model` via file-overlap edge (no reason).
3. `event-wiring` depends on `data-model` via file-overlap edge (no reason) AND on `delivery-service` via semantic edge (has reason).
4. `user-preferences` depends on `data-model` via file-overlap edge (no reason).
5. The DAG is acyclic — topological sort succeeds: `data-model` → `delivery-service`, `user-preferences` (parallel batch) → `event-wiring`.
6. All `semantic_depends_on[*].id` values reference real slice ids from the same plan.
7. No file-overlap edges from phase (a) are absent from the final output.

### What this scenario verifies

- Phase (b) adds semantic edges with `reason` fields where appropriate.
- Phase (b) does not remove any file-overlap edge from phase (a).
- The resulting DAG is acyclic.
- All dependency ids reference real slice ids.
- The output is stored as YAML in a fenced block within `docs/plans/<workflow_id>.md` (the plan doc is extended in place).

---

## Scenario 3 — Validator rejects agent diff that drops a file-overlap edge

**Description:** The agent produces output that is missing a file-overlap edge that was established in phase (a). The validator must detect and reject this.

### Phase (a) established edges (from Scenario 1)

The following file-overlap edge was mechanically derived and must appear in the final output:

- `delivery-service` depends on `data-model` (shared: `src/models/notification.ts`) — no reason field

### Invalid agent output (must be rejected)

The agent produces the following `delivery-service` slice entry in its output, dropping the `data-model` file-overlap edge:

```yaml
  - id: delivery-service
    title: Implement email delivery service
    acceptance_criteria:
      - "Given a notification record in status=pending, the delivery service sends the email and sets status=sent."
    touched_paths:
      - src/services/email-delivery.ts
      - src/models/notification.ts
    semantic_depends_on: []
    out_of_scope:
      - SMS or push delivery channels.
```

### Validator behavior

The validator compares the agent's output against the phase (a) edge list. For every file-overlap edge derived in phase (a), the validator checks that the corresponding edge appears in `semantic_depends_on` with no `reason` field. If any file-overlap edge is absent, the validator rejects the output with a message identifying the missing edge.

**Expected rejection message:**

```
Validation failed: file-overlap edge dropped by agent.
  delivery-service.semantic_depends_on must contain { id: "data-model" } (no reason field).
  This edge was derived mechanically from shared path: src/models/notification.ts.
  Agent-phase output may only ADD edges; it must not remove file-overlap edges.
```

### What this scenario verifies

- The validator reads the phase (a) edge list and confirms all edges are preserved.
- The validator identifies the specific missing edge and the shared path that produced it.
- The validator rejects any output that drops a file-overlap edge, even if the agent adds other valid semantic edges.
- The validator's error message names the slice, the missing dependency id, and the shared path.

---

## Scenario 4 — Cyclic DAG is rejected

**Description:** The agent produces a DAG with a cycle. The validator must detect and reject this.

### Input plan (minimal, three slices)

```yaml
slices:
  - id: slice-a
    title: Slice A
    acceptance_criteria:
      - "Slice A is implemented."
    touched_paths:
      - src/a.ts
      - src/shared.ts
    semantic_depends_on: []
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.

  - id: slice-b
    title: Slice B
    acceptance_criteria:
      - "Slice B is implemented."
    touched_paths:
      - src/b.ts
      - src/shared.ts
    semantic_depends_on: []
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.

  - id: slice-c
    title: Slice C
    acceptance_criteria:
      - "Slice C is implemented."
    touched_paths:
      - src/c.ts
    semantic_depends_on: []
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.
```

### Invalid agent output (must be rejected)

```yaml
slices:
  - id: slice-a
    title: Slice A
    acceptance_criteria:
      - "Slice A is implemented."
    touched_paths:
      - src/a.ts
      - src/shared.ts
    semantic_depends_on:
      - id: slice-b
      # no reason — file-overlap edge (shared: src/shared.ts)
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.

  - id: slice-b
    title: Slice B
    acceptance_criteria:
      - "Slice B is implemented."
    touched_paths:
      - src/b.ts
      - src/shared.ts
    semantic_depends_on:
      - id: slice-a
      # no reason — file-overlap edge (shared: src/shared.ts)
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.

  - id: slice-c
    title: Slice C
    acceptance_criteria:
      - "Slice C is implemented."
    touched_paths:
      - src/c.ts
    semantic_depends_on:
      - id: slice-a
        reason: "slice-c semantically depends on slice-a's interface."
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.
```

Note: `slice-a` depends on `slice-b` AND `slice-b` depends on `slice-a` — this is a cycle. In this case, both are mechanically derived file-overlap edges (both slices share `src/shared.ts`). The skill must detect the cycle in phase (a) and resolve it: for any pair of slices where overlap creates a mutual dependency, the agent must choose a direction (not both). The validator rejects any output containing a cycle.

**Expected rejection message:**

```
Validation failed: DAG contains a cycle.
  Cycle detected: slice-a → slice-b → slice-a
  The DAG must be acyclic. Review semantic_depends_on entries and remove the back-edge.
```

### What this scenario verifies

- The validator runs a topological sort and rejects any output that contains a cycle.
- The rejection message names the cycle path so the agent can diagnose it.
- When two slices share a path and would create a mutual file-overlap edge, the skill's procedure instructs the agent to pick a direction — the validator confirms only one direction appears.

---

## Scenario 5 — Dangling dependency id is rejected

**Description:** The agent references a slice id in `semantic_depends_on` that does not exist in the slice list.

### Invalid agent output (must be rejected)

```yaml
slices:
  - id: slice-a
    title: Slice A
    acceptance_criteria:
      - "Slice A is implemented."
    touched_paths:
      - src/a.ts
    semantic_depends_on:
      - id: nonexistent-slice
        reason: "slice-a needs something from a slice that does not exist."
    out_of_scope:
      - No foreseeable over-build risk for this atomic slice.
```

**Expected rejection message:**

```
Validation failed: dangling dependency id.
  slice-a.semantic_depends_on[0].id "nonexistent-slice" does not reference any slice id in this plan.
  Valid ids: [slice-a]
```

### What this scenario verifies

- The validator checks every `dependency.id` against the set of slice ids.
- The validator rejects any output containing a reference to a non-existent slice id.
- The rejection message names the slice, the array index, the bad id, and the valid ids.
