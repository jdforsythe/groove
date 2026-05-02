# substrate-write fixture

Static specification document. Demonstrates that an agent following the `substrate-write` procedure produces the correct file output, index updates, and rejection messages for each scenario.

The fixture is fixed. When a scenario fails, edit the SKILL.md procedure — not this document.

---

## Scenario 1 — Append a vocabulary entry (happy path)

**Inputs:**

```yaml
type: vocabulary
frontmatter:
  id: substrate
  type: vocabulary
  description: "The persistent project-knowledge store, organized by type under .substrate/"
  created: "2026-05-01"
body: |
  ## Summary

  The substrate is the append-only knowledge base that survives across workflows.
  Each entry type (vocabulary, adr, anti-pattern, solution, reviewer) lives in its
  own subdirectory with a shared INDEX.md.

  ## Definition

  A flat-file store under `.substrate/<type>/`. Entries are Markdown files with YAML
  frontmatter. Each type's `INDEX.md` is the always-loaded scan layer.
```

**Initial disk state:**

`.substrate/vocabulary/INDEX.md`:
```
# Vocabulary index

| ID | Description | Path |
|---|---|---|
```

No `.substrate/vocabulary/substrate.md` exists.

**Expected outcomes:**

1. `.substrate/vocabulary/substrate.md` is created with the frontmatter and body above.
2. `.substrate/vocabulary/INDEX.md` has one new row appended:

```
# Vocabulary index

| ID | Description | Path |
|---|---|---|
| substrate | The persistent project-knowledge store, organized by type under .substrate/ | ./substrate.md |
```

3. No other files are created, modified, or removed.

### What this scenario verifies

- Happy-path write for the simplest substrate type.
- Correct index row format for standard (3-column) types.
- No existing files are disturbed (append-only).

---

## Scenario 2 — Append an anti-pattern entry (type-specific validation, multiple existing entries)

**Inputs:**

```yaml
type: anti-pattern
frontmatter:
  id: god-object-domain-model
  type: anti-pattern
  description: "Putting all domain logic in a single God Object violates single-responsibility and makes slices unsafe to parallelize."
  created: "2026-05-01"
  scope: ["src/domain/**", "src/models/**"]
body: |
  ## Summary

  Never collapse multiple domain concepts into a single class or module under `src/domain/`.
  Consult when a new feature touches more than one entity type in the same file.

  ## Rule

  Never build a God Object domain model.

  ## Reason

  Because downstream slices that touch the same monolithic object create implicit
  coupling that the file-overlap DAG cannot detect. Parallel slices corrupt each other's
  work through the shared object.

  ## Positive example

  Separate `UserAccount`, `BillingRecord`, and `Subscription` into distinct modules
  each owning its own state and validation logic.
```

**Initial disk state:**

`.substrate/anti-pattern/INDEX.md`:
```
# Anti-pattern index

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |
```

`.substrate/anti-pattern/never-write-all-tests-first.md` exists (contents irrelevant).

No `.substrate/anti-pattern/god-object-domain-model.md` exists.

**Expected outcomes:**

1. `.substrate/anti-pattern/god-object-domain-model.md` is created.
2. `.substrate/anti-pattern/INDEX.md` has the new row appended after the existing row:

```
# Anti-pattern index

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |
| god-object-domain-model | Putting all domain logic in a single God Object violates single-responsibility and makes slices unsafe to parallelize. | ./god-object-domain-model.md |
```

3. `never-write-all-tests-first.md` is **not** modified.

### What this scenario verifies

- Append-only invariant: existing files are untouched during a write.
- New index row is appended after existing rows — existing rows are not disturbed.
- `scope` field is accepted (type-specific validation passes).

---

## Scenario 3 — Append a reviewer entry (5-column index row, predicate summary)

**Inputs:**

```yaml
type: reviewer
frontmatter:
  id: performance-auditor
  type: reviewer
  description: "Flags N+1 queries, missing indexes, and unbounded result sets in database-touching diffs."
  created: "2026-05-01"
  predicate:
    any:
      - paths: ["src/db/**", "src/repositories/**"]
      - diff_contains: ["findAll(", "query("]
  category: performance
  priority_floor: P2
body: |
  ## Summary

  Performance specialist that fires on diffs touching database access code or containing
  raw query calls. Checks for N+1 patterns, missing pagination, and unbounded scans.
  Minimum finding priority is P2.

  ## Review checklist

  - [ ] No N+1 query patterns; eager-load associations when fetching collections
  - [ ] All list queries have explicit pagination or a documented upper bound
  - [ ] New queries use indexed columns in WHERE clauses
  - [ ] `findAll()` and equivalent calls are not called without a scope or limit
```

**Initial disk state:**

`.substrate/reviewers/INDEX.md` (seed state — three existing reviewers):
```
# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |
```

No `.substrate/reviewers/performance-auditor.md` exists.

**Expected outcomes:**

1. `.substrate/reviewers/performance-auditor.md` is created.

2. `.substrate/reviewers/INDEX.md` has the new row appended. The `Fires on` summary for the predicate `any: [{paths: ["src/db/**", "src/repositories/**"]}, {diff_contains: ["findAll(", "query("]}]` is `db/, repositories/ | diff-contains: findAll(, query(`.

```
# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |
| performance-auditor | Flags N+1 queries, missing indexes, and unbounded result sets in database-touching diffs. | performance | db/, repositories/ | diff-contains: findAll(, query( | ./performance-auditor.md |
```

3. The three existing reviewer files are **not** modified.

### What this scenario verifies

- Reviewer index uses 5-column format; header is preserved.
- `Fires on` summary is generated correctly for a composite `any` predicate with `paths` and `diff_contains` leaves.
- Existing reviewer files are untouched.

---

## Scenario 4 — ADR supersession (core supersession scenario)

**Inputs:**

```yaml
type: adr
frontmatter:
  id: auth-session-store-redis-cluster
  type: adr
  description: "Supersedes single-node Redis decision; session store now runs on a Redis Cluster for HA."
  created: "2026-05-15"
  status: accepted
  supersedes: [auth-session-store-redis]
body: |
  ## Summary

  Replaces the prior single-node Redis session store decision (auth-session-store-redis).
  Motivated by production failover incidents in Q1. HA is now required.

  ## Context

  The original decision (auth-session-store-redis) chose a single Redis node for
  simplicity. Two production incidents exposed the risk of a single point of failure.

  ## Decision

  Use Redis Cluster (minimum 3 primary shards, 1 replica per shard) for all session
  storage. The client library switches from `ioredis` (single-node mode) to `ioredis`
  (cluster mode).

  ## Alternatives considered

  - Stick with single-node + Sentinel (rejected: Sentinel adds ops overhead without
    eliminating the SPOF for fast failover)
  - Use a managed session store (DynamoDB, Upstash) (rejected: added vendor dependency)

  ## Consequences

  Deployment requires a Redis Cluster. Local development uses a single-node container
  with a compatibility shim.
supersedes:
  - auth-session-store-redis
```

**Initial disk state:**

`.substrate/adr/INDEX.md`:
```
# ADR index

| ID | Description | Path |
|---|---|---|
| auth-session-store-redis | Decision to use a single Redis node for session persistence. | ./auth-session-store-redis.md |
```

`.substrate/adr/auth-session-store-redis.md` exists (content irrelevant — must not be modified).

No `.substrate/adr/auth-session-store-redis-cluster.md` exists.

**Expected outcomes:**

1. `.substrate/adr/auth-session-store-redis-cluster.md` is created with the frontmatter and body above, including `supersedes: [auth-session-store-redis]` in the frontmatter.

2. `.substrate/adr/auth-session-store-redis.md` is **not** modified (contents identical to initial state).

3. `.substrate/adr/INDEX.md` is updated in two ways:
   - Header upgraded from 3-column to 4-column format.
   - Existing row for `auth-session-store-redis` gets Status cell `superseded`.
   - New row appended for `auth-session-store-redis-cluster` with Status `accepted`.

   Final INDEX.md:
   ```
   # ADR index

   | ID | Description | Status | Path |
   |---|---|---|---|
   | auth-session-store-redis | Decision to use a single Redis node for session persistence. | superseded | ./auth-session-store-redis.md |
   | auth-session-store-redis-cluster | Supersedes single-node Redis decision; session store now runs on a Redis Cluster for HA. | accepted | ./auth-session-store-redis-cluster.md |
   ```

### What this scenario verifies

- Supersession: new entry is created with `supersedes:` frontmatter array.
- Supersession: old entry file is untouched (append-only invariant holds even for superseded entries).
- Supersession: ADR index row for the old entry has its Status column updated to `superseded`.
- ADR index upgrade: 3-column header is replaced with 4-column header; existing rows receive `accepted` status cells.
- New ADR row is appended with the entry's own status value.

---

## Scenario 5 — Supersession cross-links resolve (non-ADR, vocabulary)

**Inputs:**

```yaml
type: vocabulary
frontmatter:
  id: groove-workflow
  type: vocabulary
  description: "A single end-to-end feature cycle: clarify → research → plan → build → review → harvest."
  created: "2026-05-01"
  supersedes: [workflow]
body: |
  ## Summary

  The full Groove feature cycle from first clarification to substrate harvest.
  Replaces the earlier generic "workflow" term with a scoped definition.
```

**Initial disk state:**

`.substrate/vocabulary/INDEX.md`:
```
# Vocabulary index

| ID | Description | Path |
|---|---|---|
| workflow | A sequence of agent-executed phases that deliver a feature. | ./workflow.md |
```

`.substrate/vocabulary/workflow.md` exists.

No `.substrate/vocabulary/groove-workflow.md` exists.

**Expected outcomes:**

1. `.substrate/vocabulary/groove-workflow.md` is created with `supersedes: [workflow]` in its frontmatter.

2. `.substrate/vocabulary/workflow.md` is **not** modified.

3. `.substrate/vocabulary/INDEX.md` has the new row appended. The old `workflow` row is **not** modified (vocabulary is not ADR — no Status column update):

   ```
   # Vocabulary index

   | ID | Description | Path |
   |---|---|---|
   | workflow | A sequence of agent-executed phases that deliver a feature. | ./workflow.md |
   | groove-workflow | A single end-to-end feature cycle: clarify → research → plan → build → review → harvest. | ./groove-workflow.md |
   ```

### What this scenario verifies

- Supersession for non-ADR types: old entry stays on disk, old index row is unchanged.
- Status-column update is ADR-only — vocabulary index rows are never modified on supersession.
- `supersedes` array is recorded in the new entry's frontmatter.
- Cross-links resolve: the new entry's `supersedes: [workflow]` points to a real entry (`workflow.md` exists on disk).

---

## Scenario 6 — Reject: missing required base field

**Inputs:**

```yaml
type: vocabulary
frontmatter:
  id: trace-depth
  type: vocabulary
  description: "How far into the call stack substrate-read descends before stopping."
  # created field intentionally absent
body: |
  ## Summary

  The stop-depth annotation returned by substrate-read.
```

**Expected outcome:**

The skill rejects the write before touching any file:

```
REJECT: `created` is missing or not a valid ISO date
```

No files are written or modified.

---

## Scenario 7 — Reject: invalid date format

**Inputs:**

```yaml
type: adr
frontmatter:
  id: use-kebab-case-ids
  type: adr
  description: "All substrate entry ids must use kebab-case."
  created: "05/01/2026"
  status: accepted
body: |
  ## Summary

  Kebab-case ids are required across all substrate types.
```

**Expected outcome:**

```
REJECT: `created` is missing or not a valid ISO date
```

The string `05/01/2026` does not match `YYYY-MM-DD`. No files written or modified.

---

## Scenario 8 — Reject: bad enum value for ADR status

**Inputs:**

```yaml
type: adr
frontmatter:
  id: use-kebab-case-ids
  type: adr
  description: "All substrate entry ids must use kebab-case."
  created: "2026-05-01"
  status: active
body: |
  ## Summary

  Kebab-case ids are required across all substrate types.
```

**Expected outcome:**

```
REJECT: `adr` entries require a `status` field with value `accepted`, `superseded`, or `deprecated`
```

`active` is not in the valid enum. No files written or modified.

---

## Scenario 9 — Reject: body does not open with ## Summary

**Inputs:**

```yaml
type: vocabulary
frontmatter:
  id: harvest-signal
  type: vocabulary
  description: "A substrate-worthy observation produced during a workflow."
  created: "2026-05-01"
body: |
  This is the definition of a harvest signal.

  ## Summary

  A harvest signal is an observation that warrants a new substrate entry.
```

**Expected outcome:**

```
REJECT: body must open with `## Summary` — found `This is the definition of a harvest signal.` instead
```

`## Summary` must be the first non-blank line. Placing it after introductory prose is invalid. No files written or modified.

---

## Scenario 10 — Reject: ## Summary block exceeds 5 non-blank lines

**Inputs:**

```yaml
type: vocabulary
frontmatter:
  id: progressive-disclosure
  type: vocabulary
  description: "The practice of revealing information in layers: index → summary → body."
  created: "2026-05-01"
body: |
  ## Summary

  Progressive disclosure organizes information into three layers.
  The index layer is always loaded and contains only id and description.
  The summary layer adds a five-line-max ## Summary block to each entry.
  The body layer is the full entry content, loaded only when the summary is insufficient.
  Agents stop reading as early as the query can be answered.
  This sixth line exceeds the five-line limit.

  ## Definition

  Full body follows here.
```

**Expected outcome:**

```
REJECT: `## Summary` block exceeds 5 non-blank lines — found 6 lines
```

No files written or modified.

---

## Scenario 11 — Reject: anti-pattern with empty scope

**Inputs:**

```yaml
type: anti-pattern
frontmatter:
  id: magic-numbers
  type: anti-pattern
  description: "Using unexplained numeric literals instead of named constants."
  created: "2026-05-01"
  scope: []
body: |
  ## Summary

  Never use unexplained numeric literals; define named constants instead.
```

**Expected outcome:**

```
REJECT: `anti-pattern` entries require a non-empty `scope` array
```

An empty `scope: []` fails the type-specific validation. No files written or modified.

---

## Scenario 12 — Reject: solution with missing tags

**Inputs:**

```yaml
type: solution
frontmatter:
  id: pagination-cursor-pattern
  type: solution
  description: "Use opaque cursor tokens for stable pagination over large result sets."
  created: "2026-05-01"
  scope: ["src/api/**"]
  # tags intentionally absent
body: |
  ## Summary

  Cursor-based pagination avoids the offset drift problem for result sets
  that change between pages. Use an opaque, server-generated cursor token.
```

**Expected outcome:**

```
REJECT: `solution` entries require a non-empty `tags` array
```

`tags` is absent. No files written or modified.

---

## Scenario 13 — Reject: superseded id not found on disk

**Inputs:**

```yaml
type: anti-pattern
frontmatter:
  id: premature-abstraction-v2
  type: anti-pattern
  description: "Refactored version of the premature-abstraction guidance."
  created: "2026-05-01"
  scope: ["**"]
  supersedes: [premature-abstraction]
body: |
  ## Summary

  Do not extract abstractions until the pattern has appeared at least three times.
supersedes:
  - premature-abstraction
```

**Initial disk state:**

`.substrate/anti-pattern/premature-abstraction.md` does **not** exist.

**Expected outcome:**

```
REJECT: superseded id `premature-abstraction` not found in `.substrate/anti-pattern/` — old entry must exist before it can be superseded
```

No files written or modified.

---

## Scenario 14 — Append-only invariant summary

This scenario is a cross-cutting assertion, not a single execution. It states the invariant that all scenarios above must satisfy:

**Invariant:** For any successful write (Scenarios 1–5), exactly one new file is created (`.substrate/<type>/<id>.md`) and exactly one existing file is modified (`.substrate/<type>/INDEX.md`). No other files are created, modified, or removed. Files referenced by `supersedes` are read but never written.

**Verification table for successful-write scenarios:**

| Scenario | Files created | Files modified | Files untouched |
|---|---|---|---|
| 1 (vocabulary append) | `substrate.md` | `vocabulary/INDEX.md` | — |
| 2 (anti-pattern append) | `god-object-domain-model.md` | `anti-pattern/INDEX.md` | `never-write-all-tests-first.md` |
| 3 (reviewer append) | `performance-auditor.md` | `reviewers/INDEX.md` | `security-sentinel.md`, `code-simplicity-reviewer.md`, `architecture-strategist.md` |
| 4 (ADR supersession) | `auth-session-store-redis-cluster.md` | `adr/INDEX.md` | `auth-session-store-redis.md` |
| 5 (vocab supersession) | `groove-workflow.md` | `vocabulary/INDEX.md` | `workflow.md` |

**Key assertion:** In Scenarios 4 and 5, the old entry file appears in the "Files untouched" column despite being superseded. Supersession is additive — the new entry's frontmatter carries the `supersedes:` link, and the ADR index row is updated — but the old file is never removed, archived, or overwritten.

### What this scenario verifies

- The append-only invariant holds across all write types.
- Supersession cross-links resolve: new entry points to old entries that remain readable on disk.
- Index updates are surgical: only the minimum necessary rows and columns are changed.
