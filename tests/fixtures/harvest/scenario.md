# harvest fixture

Static specification document. Demonstrates that an agent following the `harvest` procedure writes exactly the right 0–4 substrate entries for signal-rich traces, writes zero entries for no-signal traces, and never exceeds 4 entries regardless of trace richness.

The fixture is fixed. When a scenario fails, edit the SKILL.md procedure — not this document.

---

## Scenario 1 — Signal trace: new solution and anti-pattern (2 entries)

This scenario exercises the core happy path: a completed workflow trace contains two distinct signals — a reusable solution and a mistake to avoid. The skill must write exactly two entries and no more.

### Inputs

**Workflow trace** (`docs/harvest/<workflow_id>.md`):

```markdown
---
id: add-email-notifications
type: harvest
description: Harvest trace for add-email-notifications workflow
created: 2026-05-01
workflow_id: add-email-notifications
---

## Summary

Workflow completed. Plan had 3 slices; all slices passed gate. No findings blocked
review. One reusable pattern emerged (cursor pagination over unbounded sets).
One mistake was made and reversed (N+1 query in notification list endpoint).

## Workflow outcome

outcome: completed
gate_a: approved
gate_b: all_findings_resolved
gate_c: approved

## Signals observed

### Reusable pattern — cursor pagination

During slice 2 implementation, the team solved the notification list pagination
problem using opaque cursor tokens instead of offset-based pagination. The cursor
encodes the last-seen event_id, making pagination stable even as rows are inserted
asynchronously. This approach is directly transferable to any unbounded list endpoint
in the project.

Touched paths: src/notifications/list.ts, src/api/cursors.ts

### Mistake made and caught — N+1 query in notification fetch

In the initial GREEN pass for slice 2, the implementation fetched each notification's
user_preferences record in a separate query inside the delivery loop. The
code-simplicity-reviewer finding fnd-simplicity-001 caught this as a P2. Resolution
added a batch preload step before the loop. The mistake was caught by review, not
by the test suite — a test for this pattern should be added to the reviewer checklist.

Scope: src/notifications/**

## Issues filed

docs/issues-filed.json: []
```

**All four substrate indexes** (index layer only — bodies not needed to decide what to write):

`.substrate/vocabulary/INDEX.md`:
```
# Vocabulary index

| ID | Description | Path |
|---|---|---|
| workflow | A sequence of agent-executed phases that deliver a feature. | ./workflow.md |
```

`.substrate/adr/INDEX.md`:
```
# ADR index

| ID | Description | Status | Path |
|---|---|---|---|
| use-postgres | Use PostgreSQL as the primary data store. | accepted | ./use-postgres.md |
```

`.substrate/anti-pattern/INDEX.md`:
```
# Anti-pattern index

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |
```

`.substrate/solution/INDEX.md`:
```
# Solution index

| ID | Description | Path |
|---|---|---|
```

`docs/issues-filed.json`: `[]`

### Expected output — exactly 2 substrate-write calls

**Write 1** — solution entry for cursor pagination:

```yaml
type: solution
frontmatter:
  id: cursor-pagination-stable-lists
  type: solution
  description: "Use opaque cursor tokens (encoding last-seen row id) for stable pagination over asynchronously-updated lists."
  created: "2026-05-01"
  scope: ["src/**"]
  tags: ["pagination", "cursor", "notifications"]
body: |
  ## Summary

  Cursor-based pagination avoids offset drift for lists where rows are inserted
  between pages. Encode the last-seen row id in an opaque server-side token.
  Consult when implementing any unbounded list endpoint in this project.

  ## Problem

  Offset-based pagination (`LIMIT N OFFSET M`) silently skips or duplicates rows
  when the underlying result set changes between page fetches. Notification lists
  are asynchronously appended, making offset pagination unreliable.

  ## Approach

  Encode the last-seen `event_id` in an opaque cursor token returned with each page.
  The next-page query becomes `WHERE event_id < :cursor ORDER BY event_id DESC LIMIT N`.
  The cursor is opaque to the client — never expose raw database ids.

  ## References

  Established during workflow `add-email-notifications`, slice 2 (src/notifications/list.ts, src/api/cursors.ts).
```

**Write 2** — anti-pattern entry for N+1 in delivery loops:

```yaml
type: anti-pattern
frontmatter:
  id: n-plus-one-in-delivery-loop
  type: anti-pattern
  description: "Fetching per-record dependencies inside a delivery loop produces N+1 queries; batch-preload before the loop instead."
  created: "2026-05-01"
  scope: ["src/notifications/**"]
body: |
  ## Summary

  Never fetch per-notification data (e.g., user preferences, templates) inside the
  notification delivery loop. Caught during add-email-notifications review as P2.
  Consult when implementing any bulk dispatch or delivery loop.

  ## Rule

  Never issue per-record queries inside a delivery or dispatch loop.

  ## Reason

  Because each inner query adds one round-trip per record, producing O(N) queries
  for a list of N items. This degrades under load and is invisible in unit tests
  that mock individual records.

  ## Positive example

  Collect all record ids before the loop, batch-preload the required associations
  in a single query, then pass the preloaded map into the loop.
```

### What this scenario verifies

- Exactly 2 entries are written for 2 distinct signals — no more, no less.
- Entry types match the signal type: solution for a reusable pattern, anti-pattern for a mistake.
- All writes go through `substrate-write` (no direct file I/O).
- All entries have valid frontmatter (id is kebab-case, type is valid, description ≤200 chars, created is ISO date).
- All bodies open with a `## Summary` block of ≤5 non-blank lines.
- `issues-filed.json` is empty so no recurring-deferral entry is written.
- Substrate indexes are read lazily (only to confirm no duplicate ids exist).

---

## Scenario 2 — No-signal trace: writes zero entries

This scenario exercises the refuse-if-no-signal invariant. The workflow completed without surfacing any vocabulary, ADR, anti-pattern, or solution signal. The skill must write zero entries.

### Inputs

**Workflow trace** (`docs/harvest/<workflow_id>.md`):

```markdown
---
id: fix-typo-in-readme
type: harvest
description: Harvest trace for fix-typo-in-readme workflow
created: 2026-05-01
workflow_id: fix-typo-in-readme
---

## Summary

Workflow completed. Single-slice plan; no gate failures; no review findings.
Change was a one-line documentation fix. No new patterns, decisions, or mistakes
surfaced during the workflow.

## Workflow outcome

outcome: completed
gate_a: approved
gate_b: no_findings
gate_c: approved

## Signals observed

No signals were observed. The change was mechanical and introduced no novel
patterns, non-obvious decisions, recurring mistakes, or reusable solutions.

## Issues filed

docs/issues-filed.json: []
```

**Substrate indexes**: same as Scenario 1 (irrelevant — no writes will happen).

`docs/issues-filed.json`: `[]`

### Expected output — zero substrate-write calls

The skill writes zero substrate entries. Its output is:

```
No signal found in workflow trace fix-typo-in-readme. Zero substrate entries written.
```

No `substrate-write` calls are made. No substrate files or indexes are modified.

### What this scenario verifies

- The skill refuses to write when nothing meaningful surfaced.
- The no-signal message is output so the caller knows the decision was deliberate.
- Zero `substrate-write` calls are made — no noise in the substrate.
- The decision is based on trace content, not on a mechanical count.

---

## Scenario 3 — Rich trace: exactly 4 entries maximum even when more signals exist

This scenario verifies the hard cap: a workflow that surfaced five or more potential signals must be capped at exactly 4 substrate entries. The skill must prioritize by impact and write the top 4.

### Inputs

**Workflow trace** (`docs/harvest/<workflow_id>.md`):

```markdown
---
id: overhaul-billing-integration
type: harvest
description: Harvest trace for overhaul-billing-integration workflow
created: 2026-05-01
workflow_id: overhaul-billing-integration
---

## Summary

Large workflow: 6 slices, 4 review findings (2 P1, 2 P2), gate B required 3 P1 resolutions.
Multiple signals surfaced: a new vocabulary term, an ADR on webhook idempotency,
an anti-pattern on over-broad transaction scope, a solution for retry-with-backoff
on external API calls, and a minor naming convention observation (low signal).

## Workflow outcome

outcome: completed
gate_a: approved
gate_b: findings_resolved
gate_c: approved

## Signals observed

### Vocabulary — idempotency key

The term "idempotency key" was used across 3 slices and 2 reviewers without a
shared definition. The team converged on: a client-supplied token stored with the
webhook event that guarantees at-most-once processing regardless of delivery count.
This is a project-specific term that should be documented.

### ADR — webhook receiver must validate idempotency key before processing

After the two P1 findings from the security-sentinel reviewer, the team made a
non-obvious decision: all webhook receivers must check for a previously-processed
idempotency key before taking any side effect. This was not in the original plan and
is not obvious from the code alone. It constrains all future webhook receiver slices.

Status: accepted

### Anti-pattern — over-broad transaction scope in billing handlers

Slice 3 wrapped the full billing event handler (including external Stripe API call)
in a database transaction. The architecture-strategist reviewer caught this as a P1:
external API calls inside DB transactions hold locks indefinitely on network latency
spikes. Resolution was to complete the external call before opening the transaction.

Scope: src/billing/**

### Solution — retry-with-exponential-backoff for external payment API

The team implemented a retry-with-exponential-backoff pattern for the Stripe charge
API (max 3 retries, base delay 500ms, jitter ±100ms). This pattern is directly
reusable for any external payment or webhook-sending operation in the project.

Scope: src/billing/**, src/integrations/**
Tags: retry, backoff, stripe, external-api

### Low-signal observation — inconsistent variable naming in billing module

Some variables in the new billing code use snake_case, others camelCase. This is
a style issue already covered by the linter config. Not worth a substrate entry —
the linter enforces this automatically.

## Issues filed

docs/issues-filed.json: []
```

**Substrate indexes**: same as Scenario 1 (empty solution index, single anti-pattern).

`docs/issues-filed.json`: `[]`

### Expected output — exactly 4 substrate-write calls

The skill selects the top 4 signals by impact and writes:

1. **vocabulary** entry for `idempotency-key` (project-specific term used across slices and reviewers)
2. **adr** entry for `webhook-idempotency-key-required` (non-obvious decision constraining all future webhook slices)
3. **anti-pattern** entry for `external-call-inside-db-transaction` (P1 finding, scope: billing)
4. **solution** entry for `retry-exponential-backoff-external-api` (directly reusable pattern)

The low-signal naming observation is **not** written — it is already enforced by tooling and produces no substrate value.

**Write 1** — vocabulary:

```yaml
type: vocabulary
frontmatter:
  id: idempotency-key
  type: vocabulary
  description: "A client-supplied token stored with a webhook event guaranteeing at-most-once processing regardless of delivery count."
  created: "2026-05-01"
body: |
  ## Summary

  An idempotency key is a client-supplied token that the receiver stores on first
  processing. On redelivery, the stored key is found and the event is skipped.
  Guarantees at-most-once side effects regardless of how many times the event arrives.
```

**Write 2** — adr:

```yaml
type: adr
frontmatter:
  id: webhook-idempotency-key-required
  type: adr
  description: "All webhook receivers must check for a previously-processed idempotency key before taking any side effect."
  created: "2026-05-01"
  status: accepted
body: |
  ## Summary

  Non-obvious constraint established during overhaul-billing-integration. Applies to
  all future webhook receiver implementations. Prevents duplicate side effects on
  redelivery without requiring exactly-once delivery from the message broker.

  ## Context

  During billing integration, two P1 security findings identified handlers that
  processed events multiple times on redelivery, causing duplicate charges.

  ## Decision

  All webhook receivers must look up the incoming idempotency key before taking any
  side effect. If the key has been processed, return a success response with no action.
  Store the key atomically with the side effect (within the same DB transaction).

  ## Alternatives considered

  - Rely on the message broker for exactly-once delivery (rejected: no broker in use
    provides this guarantee under all failure modes)
  - Deduplicate at the API gateway (rejected: adds infrastructure coupling and does
    not protect against internal re-queueing)

  ## Consequences

  Every new webhook receiver slice must include idempotency-key lookup as an
  acceptance criterion. Reviewers should flag any handler missing this check.
```

**Write 3** — anti-pattern:

```yaml
type: anti-pattern
frontmatter:
  id: external-call-inside-db-transaction
  type: anti-pattern
  description: "Wrapping an external API call inside a database transaction holds locks indefinitely on network latency spikes."
  created: "2026-05-01"
  scope: ["src/billing/**", "src/**"]
body: |
  ## Summary

  Never place external API calls (payment processors, webhooks, third-party services)
  inside an open database transaction. Caught as P1 during overhaul-billing-integration.
  Consult whenever a slice touches billing handlers or any external-call boundary.

  ## Rule

  Never issue an external network call inside an open database transaction.

  ## Reason

  Because network latency on the external call holds the DB lock for the duration,
  blocking all other transactions on the locked rows. Under load or on network errors,
  this causes cascading lock contention and timeout failures.

  ## Positive example

  Complete the external API call first. Record its result in memory. Then open a
  transaction to persist the side effect atomically.
```

**Write 4** — solution:

```yaml
type: solution
frontmatter:
  id: retry-exponential-backoff-external-api
  type: solution
  description: "Retry external payment and webhook-sending API calls with exponential backoff: max 3 retries, 500ms base delay, ±100ms jitter."
  created: "2026-05-01"
  scope: ["src/billing/**", "src/integrations/**"]
  tags: ["retry", "backoff", "external-api", "stripe"]
body: |
  ## Summary

  Use exponential backoff with jitter for transient failures on external API calls.
  Established in overhaul-billing-integration for Stripe; reusable for any external
  payment or outbound webhook operation in this project.

  ## Problem

  External API calls (payment processors, webhook delivery) fail transiently due to
  rate limits, network blips, or provider maintenance. Naive immediate retries amplify
  load on the external provider and increase the chance of being rate-limited further.

  ## Approach

  Max 3 retries. Base delay 500ms. Multiply by 2 on each retry. Add ±100ms random
  jitter to prevent thundering herd when multiple callers retry simultaneously.
  Do not retry on 4xx non-rate-limit responses (those are caller errors, not transient).

  ## References

  Established during workflow `overhaul-billing-integration`, slice 4 (src/billing/, src/integrations/).
```

The low-signal naming observation produces no write call.

### What this scenario verifies

- The skill caps output at exactly 4 entries regardless of how many signals exist in the trace.
- The 4 highest-impact signals are selected: vocabulary term (cross-slice), ADR (constrains future work), anti-pattern (P1 finding), solution (directly reusable).
- A low-signal observation (linter-enforced style issue) is deliberately excluded.
- All 4 entries have valid frontmatter and bodies opening with `## Summary` ≤5 non-blank lines.
- All 4 entries are written via `substrate-write`.

---

## Scenario 4 — Failed-gate trace: rejection reason written as anti-pattern or ADR

This scenario verifies that a failed-gate workflow produces a substrate entry recording the rejection reason, so future workflows learn from the failure.

### Inputs

**Workflow trace** (`docs/harvest/<workflow_id>.md`):

```markdown
---
id: migrate-auth-to-jwt
type: harvest
description: Harvest trace for migrate-auth-to-jwt workflow — gate A failure
created: 2026-05-01
workflow_id: migrate-auth-to-jwt
---

## Summary

Workflow killed at gate A (plan not approved). The plan was rejected because it
proposed replacing the existing session store with stateless JWT tokens without
accounting for the active-session invalidation requirement. Any token-based approach
must address how administrators can force-invalidate active sessions — a requirement
not captured in the original plan.

## Workflow outcome

outcome: killed
gate_a: rejected
gate_a_rejection_reason: |
  Plan proposes stateless JWT tokens but does not address forced session invalidation.
  Stateless tokens cannot be revoked before expiry without a server-side token
  blocklist — effectively reintroducing server-side state. The plan must either
  retain the session store for invalidation, use short-lived tokens with a blocklist,
  or document why forced invalidation is not a requirement.

## Signals observed

Gate A rejection. No build, review, or resolve phases ran.

## Issues filed

docs/issues-filed.json: []
```

**Substrate indexes**: same as Scenario 1.

`docs/issues-filed.json`: `[]`

### Expected output — exactly 1 substrate-write call (ADR recording the constraint)

The rejection reason describes a non-obvious architectural constraint that must apply to any future JWT or token-based auth plan. The skill writes it as an ADR:

```yaml
type: adr
frontmatter:
  id: stateless-jwt-requires-invalidation-strategy
  type: adr
  description: "Any stateless token scheme must address forced session invalidation; server-side state or a token blocklist is required."
  created: "2026-05-01"
  status: accepted
body: |
  ## Summary

  Gate A rejection constraint from migrate-auth-to-jwt. Applies to any future plan
  that proposes stateless (JWT or equivalent) tokens. A pure stateless scheme cannot
  satisfy the forced-invalidation requirement without server-side state.

  ## Context

  The migrate-auth-to-jwt plan proposed replacing the session store with stateless
  JWT tokens. Gate A was rejected because stateless tokens cannot be revoked before
  expiry, and the project requires administrators to force-invalidate active sessions.

  ## Decision

  Any token-based authentication scheme must explicitly document its session
  invalidation strategy. Acceptable approaches: (a) retain the session store for
  invalidation while using tokens for transport, (b) use short-lived tokens paired
  with a server-side token blocklist, or (c) document a confirmed business decision
  that forced invalidation is not required.

  ## Alternatives considered

  - Pure stateless JWT without invalidation (rejected: does not satisfy the
    forced-invalidation requirement)

  ## Consequences

  Future auth plans must include an invalidation strategy section. Reviewers should
  flag any auth plan that proposes stateless tokens without addressing invalidation.
```

### What this scenario verifies

- A failed-gate trace (outcome: killed, gate_a: rejected) triggers a substrate write.
- The rejection reason is captured as an ADR (non-obvious architectural constraint).
- Exactly 1 entry is written — the gate failure is the sole signal when no build or review phases ran.
- The ADR has valid frontmatter (status: accepted — the constraint is accepted going forward).
- The body opens with a `## Summary` ≤5 non-blank lines.

---

## Scenario 5 — Recurring deferral: issues-filed.json signals a pattern

This scenario verifies that `harvest` reads `docs/issues-filed.json` and writes a substrate entry when the same finding category has been deferred repeatedly.

### Inputs

**Workflow trace** (`docs/harvest/<workflow_id>.md`):

```markdown
---
id: add-audit-logging
type: harvest
description: Harvest trace for add-audit-logging workflow
created: 2026-05-01
workflow_id: add-audit-logging
---

## Summary

Workflow completed. 2 slices, no gate failures. One finding was deferred: the
security-sentinel reviewer flagged missing rate limiting on the audit log export
endpoint (fnd-security-003, P2). This was filed as a GitHub issue and deferred.

## Workflow outcome

outcome: completed
gate_a: approved
gate_b: finding_deferred
gate_c: approved

## Signals observed

No novel patterns, decisions, or solutions surfaced. The deferred finding is
a recurring security gap — rate limiting on export endpoints has been deferred
in two prior workflows (see issues-filed.json).

## Issues filed

docs/issues-filed.json: see below
```

**`docs/issues-filed.json`**:

```json
[
  {
    "finding_id": "fnd-security-001",
    "url": "https://github.com/example/repo/issues/41",
    "filed_at": "2026-03-10T14:00:00Z",
    "dedup": false,
    "labels_applied": ["security", "deferred"]
  },
  {
    "finding_id": "fnd-security-002",
    "url": "https://github.com/example/repo/issues/47",
    "filed_at": "2026-04-15T09:30:00Z",
    "dedup": false,
    "labels_applied": ["security", "deferred"]
  },
  {
    "finding_id": "fnd-security-003",
    "url": "https://github.com/example/repo/issues/52",
    "filed_at": "2026-05-01T11:00:00Z",
    "dedup": false,
    "labels_applied": ["security", "deferred"]
  }
]
```

All three findings share the label `security` and `deferred`. The trace notes the pattern: rate limiting on export endpoints deferred three times.

**Substrate indexes**: same as Scenario 1.

### Expected output — exactly 1 substrate-write call (anti-pattern for the recurring gap)

The skill detects 3 deferred `security` findings (≥3 is the recurring-deferral threshold) and writes an anti-pattern:

```yaml
type: anti-pattern
frontmatter:
  id: missing-rate-limit-export-endpoints
  type: anti-pattern
  description: "Export endpoints are repeatedly shipped without rate limiting; this security gap has been deferred 3 times across workflows."
  created: "2026-05-01"
  scope: ["src/api/**", "src/**"]
body: |
  ## Summary

  Rate limiting on export endpoints has been deferred across 3 workflows (issues #41,
  #47, #52). This recurring gap signals a missing implementation standard. Consult
  when any new export or bulk-download endpoint is planned.

  ## Rule

  Never ship an export or bulk-download endpoint without explicit rate limiting.

  ## Reason

  Because export endpoints are high-cost and attacker-visible. Repeated deferral
  of rate limiting on these endpoints has produced 3 open security issues. The
  pattern will continue without a documented standard.

  ## Positive example

  Apply a per-user rate limit (e.g., max 10 export requests per hour) at the API
  middleware layer before the handler runs. Document the chosen limit in the slice's
  acceptance criteria.
```

### What this scenario verifies

- The skill reads `docs/issues-filed.json` before deciding what to write.
- 3 deferred findings sharing a category label triggers a recurring-deferral write.
- The write is an anti-pattern (the recurring gap) — not an ADR or solution.
- The entry references the issue URLs/numbers to make the pattern traceable.
- Exactly 1 entry is written (the recurring deferral is the only signal in this trace).

---

## Cross-cutting invariants

These assertions hold across all scenarios:

| Assertion | Verified by |
|---|---|
| Entry count is 0–4; never >4 | Scenarios 1 (2), 2 (0), 3 (4), 4 (1), 5 (1) |
| Zero entries when no signal | Scenario 2 |
| Failed-gate rejection written as substrate entry | Scenario 4 |
| Recurring deferrals trigger an anti-pattern write | Scenario 5 |
| All writes go through substrate-write; no direct file I/O | All scenarios |
| Substrate indexes read lazily (indexes first; bodies only if needed) | Scenarios 1, 3 |
| All frontmatter fields are valid per substrate-frontmatter-base schema | All write scenarios |
| All bodies open with ## Summary ≤5 non-blank lines | All write scenarios |
| Entry type matches signal type (solution, anti-pattern, adr, vocabulary) | All write scenarios |

**The fixture is fixed. When a scenario fails, edit `skills/harvest/SKILL.md` — not this document.**
