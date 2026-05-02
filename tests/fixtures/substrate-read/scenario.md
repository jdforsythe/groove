# substrate-read fixture

Static specification document. Demonstrates that an agent following the `substrate-read` procedure stops at the correct depth for each candidate and returns hits in the expected order.

---

## Scenario 1 — Topic query, single hit, mixed stop-depths

**Query:** `test approach for vertical slices`
**Type filter:** none (all five substrate types)

### Substrate state (index layer only)

**vocabulary/INDEX.md** — empty

**adr/INDEX.md** — empty

**anti-pattern/INDEX.md**

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |

**solution/INDEX.md** — empty

**reviewers/INDEX.md**

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |

### Expected stop-depth per candidate

| Entry ID | Type | Expected stop-depth | In hits? | Reasoning |
|---|---|---|---|---|
| never-write-all-tests-first | anti-pattern | index | yes | Description directly mentions "slice" and "tests" — unambiguously relevant. |
| security-sentinel | reviewer | index | no | Description is about security vulnerabilities; unrelated to test approach. Exclude at index. |
| code-simplicity-reviewer | reviewer | summary | no | Description mentions YAGNI and premature abstractions — ambiguous (YAGNI could apply to test scope). Fetch ## Summary. Summary confirms this reviewer focuses on production code over-engineering, not test methodology. Exclude after summary. |
| architecture-strategist | reviewer | index | no | Description is about system design and component boundaries; unrelated to test approach. Exclude at index. |

### Expected output

```yaml
hits:
  - type: anti-pattern
    id: never-write-all-tests-first
    description: Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift.
    stop_depth: index
```

### What this scenario verifies

- The skill stops at index for a clearly relevant entry (positive match, no deeper fetch).
- The skill stops at index for clearly irrelevant entries (negative match, no fetch, not included).
- The skill fetches `## Summary` when the index description is ambiguous.
- The skill excludes a candidate after `## Summary` when the summary resolves the ambiguity as irrelevant.
- No full body fetches are triggered — no candidate remains ambiguous after summary.
- Hits are returned ordered by relevance, not by file order.

---

## Scenario 2 — Topic query, body-depth required, multiple hits

**Query:** `authentication token expiry handling`
**Type filter:** none (all five substrate types)

### Substrate state (index layer only)

This scenario uses a hypothetical substrate — entries that do not exist in the seed kit but represent realistic project growth.

**adr/INDEX.md** (hypothetical entries)

| ID | Description | Path |
|---|---|---|
| auth-token-lifecycle | Decision record for how the system handles token lifecycle events. | ./auth-token-lifecycle.md |
| session-store-backend | Decision to use Redis over in-process memory for session persistence. | ./session-store-backend.md |

**anti-pattern/INDEX.md** (hypothetical entry in addition to seed)

| ID | Description | Path |
|---|---|---|
| never-write-all-tests-first | Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift. | ./never-write-all-tests-first.md |
| hardcoded-token-expiry | Embedding token expiry durations as numeric literals rather than named constants causes silent drift between issuance and validation logic. | ./hardcoded-token-expiry.md |

**reviewers/INDEX.md** (seed entries)

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |

### Hypothetical entry body content (for stop-depth verification)

**auth-token-lifecycle.md** (hypothetical):

```
## Summary

Records the team's decision on token refresh vs. reissue strategies when
a token becomes invalid. Covers clock-skew tolerance and rotation policy.
See §Decision for the chosen approach and §Consequences for expiry edge cases.
```

*(Note: the `## Summary` mentions "invalid" tokens and "rotation policy" but does not explicitly address expiry duration handling — the query term "expiry" appears only in the body's §Consequences section.)*

**Body of auth-token-lifecycle.md** (hypothetical §Consequences excerpt):

> §Consequences: The chosen reissue-on-use policy means the effective expiry window is reset on every authenticated request. Idle sessions expire after the configured `token.max_idle_seconds` value. This directly governs token expiry handling in all auth middleware.

### Expected stop-depth per candidate

| Entry ID | Type | Expected stop-depth | In hits? | Reasoning |
|---|---|---|---|---|
| hardcoded-token-expiry | anti-pattern | index | yes | Description directly mentions "token expiry" — unambiguous match. |
| auth-token-lifecycle | adr | body | yes | Description mentions "token lifecycle events" — ambiguous (lifecycle ≠ expiry specifically). Fetch ## Summary: mentions "invalid" and "rotation" but not "expiry" explicitly — still ambiguous. Fetch body: §Consequences confirms expiry handling is a direct consequence of this decision. Include at body. |
| session-store-backend | adr | index | no | Description is about storage backend selection; unrelated to expiry handling. Exclude at index. |
| security-sentinel | reviewer | index | no | Description is about OWASP and injection vectors; does not address expiry semantics. Exclude at index. |
| never-write-all-tests-first | anti-pattern | index | no | Description is about test writing order; unrelated to token expiry. Exclude at index. |
| code-simplicity-reviewer | reviewer | index | no | Description is about YAGNI and readability; unrelated to token expiry. Exclude at index. |
| architecture-strategist | reviewer | index | no | Description is about component boundaries; unrelated to token expiry. Exclude at index. |

### Expected output

```yaml
hits:
  - type: anti-pattern
    id: hardcoded-token-expiry
    description: Embedding token expiry durations as numeric literals rather than named constants causes silent drift between issuance and validation logic.
    stop_depth: index
  - type: adr
    id: auth-token-lifecycle
    description: Decision record for how the system handles token lifecycle events.
    stop_depth: body
```

Ordering rationale: `hardcoded-token-expiry` ranks first because its description directly names "token expiry" — the exact query topic — and it is an anti-pattern (constraints surface before decisions in the same relevance tier). `auth-token-lifecycle` ranks second: relevance was confirmed only at body depth, placing it in a lower tier than the direct index match.

### What this scenario verifies

- A body-depth fetch is triggered when both the index description and `## Summary` are ambiguous.
- A body-depth hit is included in the result even though it required the deepest fetch.
- An index-depth hit outranks a body-depth hit when the index match is more direct.
- Anti-patterns surface before ADRs in the same relevance tier (constraint-first ordering).
- The skill does not pre-fetch bodies beyond what ambiguity resolution requires — candidates that were excluded at index are never opened.

---

## Scenario 3 — Path glob query, reviewer index

**Query:** `src/auth/**`
**Type filter:** reviewer

### Substrate state

**reviewers/INDEX.md** (seed entries — see Scenario 1 for full table)

### Expected stop-depth per candidate

| Entry ID | Expected stop-depth | In hits? | Reasoning |
|---|---|---|---|
| security-sentinel | index | yes | `Fires on` column is `auth/, api/, sql` — the query glob `src/auth/**` overlaps `auth/`. Match at index. |
| code-simplicity-reviewer | index | yes | `Fires on` column is `always` — fires on every diff, including auth diffs. Match at index. |
| architecture-strategist | index | no | `Fires on` column is `new-files-in src/` — a path match, but no new files are implied by the query; this is a path glob query, not a new-files query. Exclude at index. |

*(Note: For reviewers, the `Fires on` column enables heuristic path glob matching at the index layer without opening any entry body. The architecture-strategist exclusion reflects that its `Fires on` condition is specifically about newly-added files, which is not what a plain path glob query implies. An agent applying this rule should treat `new-files-in X` Fires-on values as non-matching for plain path queries.)*

### Expected output

```yaml
hits:
  - type: reviewer
    id: security-sentinel
    description: Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs.
    stop_depth: index
  - type: reviewer
    id: code-simplicity-reviewer
    description: Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff.
    stop_depth: index
```

Ordering: `security-sentinel` ranks first because its `Fires on` and `Description` both specifically name auth — a direct domain match. `code-simplicity-reviewer` ranks second — it fires always, making it a weaker signal for this specific query.

### What this scenario verifies

- Path glob queries against the reviewer index resolve at index stop-depth using the `Fires on` column.
- No entry body is opened for a reviewer path glob query.
- `always` reviewers match path glob queries (they fire on every diff).
- `new-files-in X` Fires-on values do not match plain path glob queries.
