# review-fanout fixture

Pressure-test specification document. Defines the scenario, expected output properties, and sample bad output used to verify that an agent following the `review-fanout` procedure behaves measurably better than an agent without the skill.

The fixture is fixed. When a scenario fails the differential check, edit the SKILL.md procedure — not this document.

---

## Scenario — "Auth and migration diff"

**Trigger:** All batches are green. A diff is present. Run the review-fanout skill.

**Diff (unified format):**

```diff
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 3a1f2e4..9b0c5d8 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -12,7 +12,14 @@ export async function login(req: Request, res: Response) {
-  const user = await db.query(`SELECT * FROM users WHERE username = '${req.body.username}'`);
+  const user = await db.query(
+    'SELECT * FROM users WHERE username = $1',
+    [req.body.username]
+  );
   if (!user) return res.status(401).json({ error: 'Invalid credentials' });
+  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
+  res.cookie('session', token, { httpOnly: true });
+  return res.json({ ok: true });
 }

diff --git a/migrations/0042_add_user_preferences.sql b/migrations/0042_add_user_preferences.sql
new file mode 100644
index 0000000..4f3b0a1
--- /dev/null
+++ b/migrations/0042_add_user_preferences.sql
@@ -0,0 +1,8 @@
+-- Migration: add user_preferences table
+ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
+CREATE INDEX idx_users_preferences ON users USING GIN (preferences);
```

**Slice DAG (`docs/plan.slices.yml`):**

```yaml
slices:
  - id: auth-login-fix
    title: Fix SQL injection in login handler and add JWT session
    acceptance_criteria:
      - Login query uses parameterized statements
      - JWT token is set as httpOnly cookie
    touched_paths:
      - src/auth/**
      - test/auth/**
    semantic_depends_on: []
    out_of_scope:
      - OAuth login
      - refresh token rotation
  - id: user-preferences-schema
    title: Add user preferences column to users table
    acceptance_criteria:
      - Migration adds preferences JSONB column with GIN index
    touched_paths:
      - migrations/**
    semantic_depends_on:
      - id: auth-login-fix
    out_of_scope:
      - Preference UI
```

**Reviewer index (`.substrate/reviewers/INDEX.md`):**

```markdown
# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | OWASP top 10, injection, auth flaws, secret handling | security | auth/, api/, sql | ./security-sentinel.md |
| db-migration-reviewer | Schema safety, index strategy, backward-compat migrations | database | migrations/ | ./db-migration-reviewer.md |
| code-simplicity-reviewer | YAGNI, complexity flags, readability, dead code | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | System design, component boundaries, layer coupling | architecture | new-files-in src/ | ./architecture-strategist.md |
| performance-reviewer | Query efficiency, N+1 patterns, caching opportunities | performance | migrations/, src/api/ | ./performance-reviewer.md |
```

**Individual reviewer bodies:**

`.substrate/reviewers/security-sentinel.md`:

```markdown
---
id: security-sentinel
type: reviewer
description: OWASP top 10, injection, auth flaws, secret handling
created: 2025-01-15
category: security
priority_floor: P2
predicate:
  any:
    - paths: ["src/auth/**", "src/api/**"]
    - diff_contains: ["execute(", "raw_sql", "process.env"]
tags: [security, owasp]
---

## Summary

Security reviewer. Checks for injection vulnerabilities, authentication weaknesses, insecure secret handling, and OWASP top-10 issues. Fires on auth or API path changes, or when the diff contains raw SQL or environment variable access.

## Checklist

- [ ] No raw SQL string interpolation (parameterized queries only)
- [ ] No secrets in source code or diff text
- [ ] JWT or session tokens use httpOnly and secure cookie flags
- [ ] Token expiry is appropriate for the use case
- [ ] Environment variables used for secrets are not committed
```

`.substrate/reviewers/db-migration-reviewer.md`:

```markdown
---
id: db-migration-reviewer
type: reviewer
description: Schema safety, index strategy, backward-compat migrations
created: 2025-01-15
category: database
predicate:
  new_files_in: ["migrations/**"]
tags: [database, migrations, schema]
---

## Summary

Database migration reviewer. Checks that new migrations are backward-compatible, indexes are appropriate, and destructive operations are gated. Fires only when new migration files are added.

## Checklist

- [ ] Migration is backward-compatible (no dropped columns without a transition period)
- [ ] Index type matches query pattern (GIN for JSONB containment, B-tree for equality/range)
- [ ] No unbounded table locks (prefer `CREATE INDEX CONCURRENTLY`)
- [ ] Default value for new column is safe and non-breaking
```

`.substrate/reviewers/code-simplicity-reviewer.md`:

```markdown
---
id: code-simplicity-reviewer
type: reviewer
description: YAGNI, complexity flags, readability, dead code
created: 2025-01-15
category: quality
predicate:
  always: true
tags: [quality, simplicity, readability]
---

## Summary

Code simplicity reviewer. Checks every diff for YAGNI violations, unnecessary complexity, dead code, and readability issues. Always fires — even small diffs can accumulate complexity.

## Checklist

- [ ] No dead code or unused imports introduced
- [ ] Each new function does exactly one thing
- [ ] Variable and function names are self-explanatory
- [ ] No premature abstraction
```

`.substrate/reviewers/architecture-strategist.md`:

```markdown
---
id: architecture-strategist
type: reviewer
description: System design, component boundaries, layer coupling
created: 2025-01-15
category: architecture
predicate:
  new_files_in: ["src/**"]
tags: [architecture, design, coupling]
---

## Summary

Architecture reviewer. Checks for boundary violations, inappropriate coupling between layers, and system design concerns. Fires only when new source files are added.

## Checklist

- [ ] New files respect existing module boundaries
- [ ] No direct cross-layer imports (e.g., route handler importing from data layer directly)
- [ ] Dependencies flow in the correct direction
```

`.substrate/reviewers/performance-reviewer.md`:

```markdown
---
id: performance-reviewer
type: reviewer
description: Query efficiency, N+1 patterns, caching opportunities
created: 2025-01-15
category: performance
predicate:
  any:
    - new_files_in: ["migrations/**"]
    - paths: ["src/api/**"]
tags: [performance, database, caching]
---

## Summary

Performance reviewer. Checks for query inefficiency, N+1 patterns, missing indexes, and caching opportunities. Fires on new migrations or API path changes.

## Checklist

- [ ] No N+1 query patterns introduced
- [ ] New queries use available indexes
- [ ] GIN index choice is appropriate for JSONB query patterns in use
- [ ] No unbounded queries (missing LIMIT or pagination)
```

---

## Expected output properties (with-skill behavior)

An agent following the `review-fanout` skill must exhibit ALL of the following properties:

1. **Eager index load, lazy body load**: The agent reads `.substrate/reviewers/INDEX.md` first and does not open any reviewer body file before evaluating whether that reviewer matches. Bodies are opened only for reviewers whose predicates fire.

2. **Correct predicate evaluation**: The agent correctly evaluates all five reviewer predicates against the diff and slice DAG:

   - `security-sentinel` — fires: `paths: ["src/auth/**"]` matches `src/auth/login.ts` AND `diff_contains: ["process.env"]` matches; predicate is `any`, so true.
   - `db-migration-reviewer` — fires: `new_files_in: ["migrations/**"]` matches `migrations/0042_add_user_preferences.sql` (newly added file).
   - `code-simplicity-reviewer` — fires: `always: true`.
   - `architecture-strategist` — does NOT fire: `new_files_in: ["src/**"]` — no new files were added in `src/`; the auth file was modified, not created.
   - `performance-reviewer` — fires: `new_files_in: ["migrations/**"]` matches the new migration file.

   Matched: security-sentinel, db-migration-reviewer, code-simplicity-reviewer, performance-reviewer (4 reviewers — within the 3–5 cap).

3. **Correct cap enforcement**: Exactly 4 reviewers are run (all that match). The cap (≤5) is not exceeded. Architecture-strategist is excluded.

4. **Priority floor respected**: `security-sentinel` has `priority_floor: P2`, so it may only emit P1 or P2 findings. Any P3 finding from this reviewer must be dropped.

5. **Correct in_scope computation**: Findings with `location.path` matching `src/auth/**` or `migrations/**` are `in_scope: true`. Findings without a location path are `in_scope: false`.

6. **JSON output at docs/findings.json**: The file exists, is valid JSON, conforms to findings schema §2, and contains at least one finding with all required fields (`id`, `reviewer`, `priority`, `in_scope`, `title`, `description`).

7. **Sorted output**: Findings are sorted P1 first, then P2, then P3.

8. **Finding IDs follow the pattern**: All `id` fields match `^fnd-[a-z0-9]+(-[a-z0-9]+)*$`.

### Example of compliant output summary (with-skill)

> Predicate evaluation complete.
>
> Matched reviewers (4):
> - security-sentinel (paths match src/auth/login.ts; diff contains process.env)
> - db-migration-reviewer (new file migrations/0042_add_user_preferences.sql)
> - code-simplicity-reviewer (always: true)
> - performance-reviewer (new file migrations/0042_add_user_preferences.sql)
>
> Not matched: architecture-strategist (no new files in src/)
>
> Running 4 reviewers in parallel...
>
> docs/findings.json written: 1 P1, 2 P2, 0 P3.

---

## Sample bad output (without-skill behavior)

An agent **without** the `review-fanout` skill typically exhibits one or more of the following failure modes when given the same scenario:

### Bad output example A — runs every reviewer

> I'll run all five reviewers on this diff.
>
> **security-sentinel**: [findings]
> **db-migration-reviewer**: [findings]
> **code-simplicity-reviewer**: [findings]
> **architecture-strategist**: [findings — even though no new src/ files were added]
> **performance-reviewer**: [findings]

Failure modes present:
- Does not evaluate predicates — runs every reviewer regardless of match
- architecture-strategist fires when its predicate should not match
- Does not respect the 3–5 cap or selection priority
- Does not compute `in_scope` correctly

### Bad output example B — picks reviewers at random

> For this diff I'll pick security and code quality reviewers since this looks like a security fix.
>
> **security-sentinel**: [findings]
> **code-simplicity-reviewer**: [findings]

Failure modes present:
- Selection is based on the agent's intuition, not predicate evaluation
- db-migration-reviewer and performance-reviewer are skipped (their predicates would match)
- No evidence of predicate DSL evaluation
- Does not load INDEX.md before selecting

### Bad output example C — outputs Markdown instead of JSON

> ## Findings
>
> ### P1 — security-sentinel
> **SQL injection risk in login handler**
> ...

Failure modes present:
- Output is Markdown, not `docs/findings.json`
- No `in_scope` field
- Finding IDs not present
- Does not conform to findings schema §2

---

## Differential check criteria

Run a subagent with the `review-fanout` skill loaded against the scenario prompt above. Run the same subagent without the skill. Compare outputs using these binary criteria:

| Criterion | With-skill | Without-skill |
|---|---|---|
| Reads INDEX.md before opening any reviewer body | yes | no (typically opens all bodies or none) |
| Evaluates predicate DSL for each reviewer | yes | no (relies on index "Fires on" hint or agent intuition) |
| Excludes architecture-strategist (predicate does not match) | yes | no (typically runs it anyway) |
| Runs exactly 3–5 reviewers (4 in this scenario) | yes | no (typically runs all 5 or picks 1–2 intuitively) |
| Drops security-sentinel P3 findings (priority_floor: P2) | yes | no (emits all findings regardless of floor) |
| Writes docs/findings.json (not Markdown) | yes | no (typically writes Markdown prose) |
| in_scope computed from touched_paths globs | yes | no (field absent or hardcoded) |
| Finding IDs match fnd-* pattern | yes | no (missing or free-form ids) |

The skill passes the differential check when the with-skill run satisfies all eight criteria and the without-skill run fails at least five of them.

---

## Edge case: empty diff

**Prompt:**

> The diff is empty — no files changed.

**Expected behavior (with-skill):**

The agent outputs:

```
No diff present — review-fanout skipped.
```

No `docs/findings.json` is written. No reviewer bodies are opened. No substrate reads occur.

**Expected behavior (without-skill):**

The agent typically either errors, writes an empty findings file with incorrect structure, or still runs some reviewers.

---

## Edge case: reviewer with always: true on empty diff

**Prompt:**

> The diff is empty.

**Expected behavior (with-skill):**

The empty-diff guard (Step 1) fires before any predicate evaluation. Even `code-simplicity-reviewer` (which has `always: true`) does not fire on an empty diff. The guard is unconditional.
