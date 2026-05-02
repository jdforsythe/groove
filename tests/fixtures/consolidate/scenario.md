# consolidate fixture

Static specification document. Demonstrates that an agent following the `consolidate` procedure produces the correct promotions, merges, prunes, and retags on a stale substrate fixture.

The fixture is fixed. When a scenario fails, edit the SKILL.md procedure — not this document.

---

## Fixture substrate state (shared initial state for all scenarios)

The substrate below is the starting point for all scenarios. Each scenario describes only the subset of the substrate relevant to the operation being verified.

### `.substrate/anti-pattern/INDEX.md`

```
# Anti-pattern index

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |
| raw-sql-in-handlers | Embedding raw SQL strings directly in request handlers bypasses the query layer and prevents parameterized queries. | ./raw-sql-in-handlers.md |
| mutable-shared-state | Sharing mutable objects across concurrent slices without synchronization causes data races. | ./mutable-shared-state.md |
```

### `.substrate/anti-pattern/never-write-all-tests-first.md`

```markdown
---
id: never-write-all-tests-first
type: anti-pattern
description: Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift.
created: 2026-01-10
scope: ["**"]
---

## Summary

Never write all tests for a slice upfront before beginning any implementation. Write
one failing test, make it pass, then write the next. Consult when starting any slice.
Key term: horizontal-slice TDD.

## Rule

Never write all tests for a slice or feature before writing any implementation code.

## Reason

Because batch-writing tests first creates tight coupling between the test suite and
speculative implementation details.

## Positive example

Write one test, make it pass, write the next test.
```

### `.substrate/anti-pattern/raw-sql-in-handlers.md`

```markdown
---
id: raw-sql-in-handlers
type: anti-pattern
description: Embedding raw SQL strings directly in request handlers bypasses the query layer and prevents parameterized queries.
created: 2026-01-15
scope: ["src/handlers/**", "src/routes/**"]
---

## Summary

Never embed raw SQL in handler or route files. Consult when adding or modifying HTTP
request handlers that interact with the database. Key term: query layer.

## Rule

Never write raw SQL strings inside handler or route files.

## Reason

Because handler-level SQL bypasses centralized query sanitization, making injection
vectors easy to miss in review.

## Positive example

Call a repository method that encapsulates the query; the handler receives a typed result.
```

### `.substrate/anti-pattern/mutable-shared-state.md`

```markdown
---
id: mutable-shared-state
type: anti-pattern
description: Sharing mutable objects across concurrent slices without synchronization causes data races.
created: 2026-02-01
scope: ["src/**"]
---

## Summary

Never share mutable state across concurrent slice builds without synchronization.
Consult when a slice's touched_paths overlaps with another batch-parallel slice.
Key term: data race.

## Rule

Never mutate shared objects from parallel-running slices.

## Reason

Because concurrent writes without a lock produce undefined results and flaky tests
that pass in serial but fail under load.

## Positive example

Pass immutable snapshots to each slice; collect results and merge after all slices complete.
```

### `.substrate/adr/INDEX.md`

```
# ADR index

| ID | Description | Path |
|---|---|---|
| use-repository-pattern | All database access must go through a repository class; no direct ORM calls from handlers or services. | ./use-repository-pattern.md |
| enforce-repository-pattern | Centralise all ORM access in repository classes; handlers must never import ORM models directly. | ./enforce-repository-pattern.md |
| use-redis-for-sessions | Session data is stored in Redis using ioredis; no server-side memory sessions. | ./use-redis-for-sessions.md |
```

> Note: `use-repository-pattern` and `enforce-repository-pattern` are near-duplicates — same decision restated.

### `.substrate/adr/use-repository-pattern.md`

```markdown
---
id: use-repository-pattern
type: adr
status: accepted
description: All database access must go through a repository class; no direct ORM calls from handlers or services.
created: 2026-01-12
---

## Summary

All database access must be mediated by a repository class. No handler, service, or
utility may import ORM models directly. Consult when adding any data-access code.

## Context

Early code had ORM calls scattered across handlers.

## Decision

Introduce a repository layer. All data access is encapsulated in repository classes under `src/repositories/`.

## Alternatives considered

- Active Record pattern (rejected: too much coupling)

## Consequences

New repositories must be added for each entity. Handlers stay thin.
```

### `.substrate/adr/enforce-repository-pattern.md`

```markdown
---
id: enforce-repository-pattern
type: adr
status: accepted
description: Centralise all ORM access in repository classes; handlers must never import ORM models directly.
created: 2026-02-20
---

## Summary

A restatement of the repository pattern decision with stronger enforcement language.
Handlers must not import ORM models. Added after a code review found three violations.

## Context

The original decision (use-repository-pattern) was being violated in practice.

## Decision

Enforce the same rule as use-repository-pattern. Lint rule added to prevent ORM model
imports outside `src/repositories/`.

## Alternatives considered

- Runtime checks (rejected: lint-time is earlier)

## Consequences

Lint failures on ORM imports outside repositories. Same architectural outcome as the
original decision.
```

### `.substrate/adr/use-redis-for-sessions.md`

```markdown
---
id: use-redis-for-sessions
type: adr
status: accepted
description: Session data is stored in Redis using ioredis; no server-side memory sessions.
created: 2026-01-18
---

## Summary

All session state lives in Redis. No in-process memory sessions. Consult when
modifying authentication, session lifecycle, or deployment topology.

## Context

In-memory sessions do not survive process restarts or scale-out.

## Decision

Use Redis via ioredis for all session storage.

## Alternatives considered

- Cookie-only sessions (rejected: too much data for a cookie)

## Consequences

Redis is a required infrastructure dependency for all environments.
```

### `.substrate/solution/INDEX.md`

```
# Solution index

| ID | Description | Path |
|---|---|---|
| cursor-pagination | Stable pagination over large result sets using opaque cursor tokens. | ./cursor-pagination.md |
| file-upload-multipart | Handling multipart file uploads via streaming to avoid memory pressure. | ./file-upload-multipart.md |
```

### `.substrate/solution/cursor-pagination.md`

```markdown
---
id: cursor-pagination
type: solution
description: Stable pagination over large result sets using opaque cursor tokens.
created: 2026-01-20
scope: ["src/api/**", "src/repositories/**"]
tags: [pagination, api, database]
---

## Summary

Use opaque cursor tokens for pagination to avoid offset drift when rows are inserted
or deleted between pages. Consult for any list API returning more than 100 records.
Key terms: cursor, stable pagination, opaque token.

## Approach

Encode the last-seen primary key and sort key into a base64 token. Decode on next
request. Never expose raw database ids in cursor tokens.

## References

- ADR: use-repository-pattern
```

### `.substrate/solution/file-upload-multipart.md`

```markdown
---
id: file-upload-multipart
type: solution
description: Handling multipart file uploads via streaming to avoid memory pressure.
created: 2026-01-25
scope: ["src/handlers/**"]
tags: [file-upload, streaming, multipart]
---

## Summary

Stream multipart uploads directly to object storage without buffering in memory.
Consult when adding any file upload handler. Key terms: multipart, streaming, busboy.

## Approach

Use busboy to parse multipart streams. Pipe each part directly to the object storage
write stream. Abort on error; clean up partially written objects.

## References

- ADR: use-repository-pattern
```

### `.substrate/reviewers/INDEX.md`

```
# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |
```

### Harvest history summary (harvest counts, last 8 workflows)

Anti-pattern match counts across the last 8 workflows (the window used for promotion scoring):

| Anti-pattern ID | Match count (last 8 workflows) | Scopes triggered in |
|---|---|---|
| never-write-all-tests-first | 8 | `**` (every workflow) |
| raw-sql-in-handlers | 6 | `src/handlers/**`, `src/routes/**` |
| mutable-shared-state | 1 | `src/**` |

Promotion threshold N = 5 (matches in the same scope in last 8 workflows).

Solution retrieval history (last 8 workflows):

| Solution ID | Retrieval count |
|---|---|
| cursor-pagination | 4 |
| file-upload-multipart | 0 |

ADR retrieval history (last 8 workflows):

| ADR ID | Retrieval count | Status |
|---|---|---|
| use-repository-pattern | 3 | accepted |
| enforce-repository-pattern | 0 | accepted |
| use-redis-for-sessions | 2 | accepted |

File move history (git log, last 8 weeks):

| Old path | New path |
|---|---|
| `src/handlers/**` | `src/http/**` |

---

## Scenario 1 — Promote: anti-pattern matched ≥N times in same scope → new reviewer entry

### What this scenario tests

When an anti-pattern has been matched ≥N times in the same scope across recent harvest history, `consolidate` must create a new reviewer entry (via `substrate-write`) with a predicate derived from the anti-pattern's scope and a checklist derived from the anti-pattern's rule.

`raw-sql-in-handlers` has 6 matches ≥ N=5 in `src/handlers/**` and `src/routes/**`.

`never-write-all-tests-first` has 8 matches but its scope is `["**"]` (universal) — it is already effectively applied everywhere and promotion would produce a low-value `always: true` reviewer; the procedure must only promote when the scope is non-universal (not `["**"]`). See constraint in SKILL.md.

`mutable-shared-state` has 1 match < N=5 — must not be promoted.

### Expected outcome

One new reviewer entry is written via `substrate-write`:

```yaml
type: reviewer
frontmatter:
  id: raw-sql-reviewer
  type: reviewer
  description: Checks that no raw SQL strings appear in handler or route files; all database access must go through the repository layer.
  created: 2026-05-01
  predicate:
    any:
      - paths: ["src/handlers/**", "src/routes/**"]
  category: code-quality
  priority_floor: P2
body: |
  ## Summary

  Reviewer derived from the raw-sql-in-handlers anti-pattern. Fires on diffs touching
  handler or route files. Checks that no raw SQL appears in those files.
  Promoted after 6 repeated anti-pattern matches in src/handlers/** and src/routes/**.

  ## Review checklist

  - [ ] No raw SQL strings in handler or route files
  - [ ] All database calls go through a repository method
  - [ ] ORM models are not imported directly in handler or route files
```

**Files created:** `.substrate/reviewers/raw-sql-reviewer.md`
**Index updated:** `.substrate/reviewers/INDEX.md` — one row appended.

**Files NOT changed:**
- `never-write-all-tests-first.md` (universal scope — excluded from promotion)
- `mutable-shared-state.md` (count below threshold)
- Any anti-pattern file (promotion does not delete or modify anti-pattern entries)

### What this verifies

- Promotion fires only for anti-patterns with match count ≥ N.
- Universal scope (`["**"]`) anti-patterns are excluded from promotion.
- Derived predicate uses the anti-pattern's scope array with `paths` leaf form.
- Priority floor defaults to P2 for promoted reviewers.
- Promotion writes via `substrate-write` (append-only, frontmatter-valid).
- The source anti-pattern entries are not modified or deleted.

---

## Scenario 2 — Merge: ADRs with overlapping decisions → consolidated entry that supersedes both

### What this scenario tests

`use-repository-pattern` and `enforce-repository-pattern` both record the same architectural decision (repository layer; no ORM imports in handlers). `consolidate` must detect the overlap, write a single consolidated ADR via `substrate-write`, and mark both originals as superseded.

`use-redis-for-sessions` is a distinct decision (different domain) — must not be merged.

### Expected outcome

One new ADR entry is written via `substrate-write`:

```yaml
type: adr
frontmatter:
  id: repository-layer-canonical
  type: adr
  status: accepted
  description: Canonical decision: all ORM access is mediated by repository classes; enforced by lint rule preventing direct ORM model imports outside src/repositories/.
  created: 2026-05-01
  supersedes:
    - use-repository-pattern
    - enforce-repository-pattern
body: |
  ## Summary

  Canonical consolidation of two overlapping repository-pattern decisions. Replaces
  use-repository-pattern (2026-01-12) and enforce-repository-pattern (2026-02-20).
  All database access goes through repository classes; lint prevents ORM model imports
  outside src/repositories/.

  ## Context

  Two separate ADRs recorded the same repository-layer decision: the original
  use-repository-pattern and a later restatement enforce-repository-pattern added
  after lint enforcement was introduced.

  ## Decision

  Use a repository layer for all database access. Handlers must never import ORM
  models directly. A lint rule enforces this at CI time.

  ## Alternatives considered

  - Active Record pattern (rejected: too much coupling, from use-repository-pattern)
  - Runtime checks (rejected: lint-time is earlier, from enforce-repository-pattern)

  ## Consequences

  New repositories must be added for each entity. Lint fails on ORM imports outside
  src/repositories/. Handlers stay thin.
supersedes:
  - use-repository-pattern
  - enforce-repository-pattern
```

**Files created:** `.substrate/adr/repository-layer-canonical.md`
**Index updated:** `.substrate/adr/INDEX.md`
  - Header upgraded from 3-column to 4-column (Status column added).
  - Existing rows for `use-repository-pattern` and `enforce-repository-pattern` updated to `superseded`.
  - Existing row for `use-redis-for-sessions` updated to `accepted` (status column added).
  - New row appended for `repository-layer-canonical` with `accepted` status.

**Files NOT changed:**
- `use-repository-pattern.md` (superseded but file preserved on disk)
- `enforce-repository-pattern.md` (superseded but file preserved on disk)
- `use-redis-for-sessions.md` (not merged — distinct decision, not modified)

### What this verifies

- ADR merge produces a consolidated entry that supersedes both originals.
- Supersession links are recorded in the new entry's `supersedes:` frontmatter array.
- The old ADR files are not deleted or modified.
- The ADR index is updated: superseded rows get `superseded` status; the new row gets `accepted`.
- Distinct ADRs are not merged (use-redis-for-sessions is untouched).
- Write goes through `substrate-write` semantics (append-only, frontmatter-valid).

---

## Scenario 3 — Prune: stale solutions and superseded ADRs marked stale, not deleted

### What this scenario tests

`file-upload-multipart` has 0 retrievals in the last 8 workflows — it qualifies as stale (retrieval count = 0 in the observation window). `consolidate` must write a new solution entry that supersedes the stale one and is marked with a staleness tag. It must not delete the original entry.

`cursor-pagination` has 4 retrievals — it must not be pruned.

The two ADRs superseded in Scenario 2 (`use-repository-pattern`, `enforce-repository-pattern`) must also be marked stale after the merge pass (they are now superseded; consolidate marks superseded ADRs stale in the prune pass). `use-redis-for-sessions` is active — must not be pruned.

### Expected outcomes

**Stale solution entry written** via `substrate-write`:

```yaml
type: solution
frontmatter:
  id: file-upload-multipart-stale
  type: solution
  description: "[STALE] Handling multipart file uploads via streaming — no retrievals in last 8 workflows. May be outdated."
  created: 2026-05-01
  supersedes: [file-upload-multipart]
  scope: ["src/handlers/**"]
  tags: [file-upload, streaming, multipart, stale]
body: |
  ## Summary

  Stale marker for file-upload-multipart. Zero retrievals in the last 8 workflows.
  The original entry is preserved on disk. Review before using; approach may be outdated.

  ## Original description

  Handling multipart file uploads via streaming to avoid memory pressure.
```

**Files created:** `.substrate/solution/file-upload-multipart-stale.md`
**Index updated:** `.substrate/solution/INDEX.md` — one row appended for the stale marker.

**Files NOT changed:** `file-upload-multipart.md` (original preserved on disk), `cursor-pagination.md` (active — not touched).

> Note: The superseded ADRs from Scenario 2 are already handled in the merge pass (their INDEX.md rows are already `superseded`). The prune pass does not re-write them but may add a staleness annotation to the index summary if the implementation tracks that separately. Fixtures treat the merge-pass supersession as sufficient for ADR staleness visibility.

### What this verifies

- Stale solutions (0 retrievals in window) are marked via a superseding entry.
- The original solution file is not deleted.
- The stale marker entry is a valid substrate write via `substrate-write`.
- Active solutions (cursor-pagination, 4 retrievals) are not touched.
- The stale marker's tags include `stale` for downstream filterability.
- The prune pass does not delete any file.

---

## Scenario 4 — Retag: scope globs rewritten for moved files

### What this scenario tests

Git history shows that `src/handlers/**` was moved to `src/http/**`. Two substrate entries have scope globs that reference the old path:
- `raw-sql-in-handlers` (anti-pattern) — scope: `["src/handlers/**", "src/routes/**"]`
- `file-upload-multipart` (solution) — scope: `["src/handlers/**"]`

`consolidate` must write new entries with updated scope globs (via `substrate-write`, superseding the originals). It must not modify the original files in place.

> Note: If Scenario 1 already promoted `raw-sql-in-handlers`, the retag pass should additionally update the promoted reviewer's predicate paths. For fixture simplicity, scenarios are independent — assume the retag pass runs on the initial substrate state (before Scenario 1 promotions). Cross-scenario ordering is discussed in the full procedure.

### Expected outcomes

**New anti-pattern entry** (scope updated) written via `substrate-write`:

```yaml
type: anti-pattern
frontmatter:
  id: raw-sql-in-handlers-v2
  type: anti-pattern
  description: Embedding raw SQL strings directly in request handlers bypasses the query layer and prevents parameterized queries.
  created: 2026-05-01
  supersedes: [raw-sql-in-handlers]
  scope: ["src/http/**", "src/routes/**"]
body: |
  ## Summary

  Never embed raw SQL in handler or route files. Consult when adding or modifying HTTP
  request handlers that interact with the database. Key term: query layer.
  Scope updated: src/handlers/** renamed to src/http/**.

  ## Rule

  Never write raw SQL strings inside handler or route files.

  ## Reason

  Because handler-level SQL bypasses centralized query sanitization, making injection
  vectors easy to miss in review.

  ## Positive example

  Call a repository method that encapsulates the query; the handler receives a typed result.
supersedes:
  - raw-sql-in-handlers
```

**New solution entry** (scope updated) written via `substrate-write`:

```yaml
type: solution
frontmatter:
  id: file-upload-multipart-v2
  type: solution
  description: Handling multipart file uploads via streaming to avoid memory pressure.
  created: 2026-05-01
  supersedes: [file-upload-multipart]
  scope: ["src/http/**"]
  tags: [file-upload, streaming, multipart]
body: |
  ## Summary

  Stream multipart uploads directly to object storage without buffering in memory.
  Consult when adding any file upload handler. Key terms: multipart, streaming, busboy.
  Scope updated: src/handlers/** renamed to src/http/**.

  ## Approach

  Use busboy to parse multipart streams. Pipe each part directly to the object storage
  write stream. Abort on error; clean up partially written objects.

  ## References

  - ADR: use-repository-pattern
supersedes:
  - file-upload-multipart
```

**Files created:** `raw-sql-in-handlers-v2.md`, `file-upload-multipart-v2.md`
**Indexes updated:** `anti-pattern/INDEX.md` (one row appended), `solution/INDEX.md` (one row appended).
**Files NOT changed:** `raw-sql-in-handlers.md`, `file-upload-multipart.md` (originals preserved).

**Entries NOT retagged:**
- `mutable-shared-state` — scope `["src/**"]` does not reference `src/handlers/**` exactly, and `src/**` still covers the renamed path (it is a broader glob). No retag needed.
- `cursor-pagination` — scope `["src/api/**", "src/repositories/**"]` — no moved path reference.
- `never-write-all-tests-first` — scope `["**"]` — no moved path reference.

### What this verifies

- Retag detects scope globs that reference moved file paths.
- Retag writes a new entry with updated scope, superseding the original (append-only).
- Original files are preserved on disk.
- Entries with broad globs (`src/**`, `**`) that still cover the new path are not retagged.
- Entries whose scope has no overlap with the moved path are not retagged.
- Write goes through `substrate-write` semantics.

---

## Scenario 5 — Nothing-else-changes invariant

This scenario is a cross-cutting assertion that all four passes in any consolidate run must satisfy.

**Invariant:** Consolidate makes only the writes explicitly required by the promote, merge, prune, and retag rules. It does not:
- Delete any existing substrate entry file.
- Modify any existing substrate entry file in place.
- Add substrate entries beyond what each pass's rules require.
- Alter any substrate index row except by appending new rows or updating ADR Status cells (as `substrate-write` permits for supersession).

**Verification table for the four scenarios above:**

| Pass | Entries created | Entries modified in place | Entries deleted |
|---|---|---|---|
| Promote (Scenario 1) | `raw-sql-reviewer.md` | none | none |
| Merge (Scenario 2) | `repository-layer-canonical.md` | none (index rows updated via substrate-write ADR supersession logic) | none |
| Prune (Scenario 3) | `file-upload-multipart-stale.md` | none | none |
| Retag (Scenario 4) | `raw-sql-in-handlers-v2.md`, `file-upload-multipart-v2.md` | none | none |

**Key assertion:** Every operation is additive. The substrate after consolidate is a strict superset of the substrate before — no information is lost, only supersession links are added to index rows (for ADRs only, via the `substrate-write` ADR supersession logic).

### What this verifies

- Hard-delete is never performed by any pass.
- In-place mutation of entry files is never performed.
- Only `substrate-write` is used for all writes, which enforces append-only.
- The consolidate skill respects the append-only invariant across all four passes.
