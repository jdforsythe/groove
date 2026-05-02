---
name: substrate-read
description: >-
  Read substrate indexes to answer a topic, path glob, or tag query. Fetches
  progressively deeper (index → summary → body) only as needed. Returns hits
  ordered by relevance with stop-depth annotation. Invoke whenever a skill
  needs prior project decisions, vocabulary, anti-patterns, solutions, or
  reviewers before acting.
inputs:
  query: "topic string | path glob (contains / or *) | tag string (prefix: tag:<value>)"
  type_filter: "optional: vocabulary | adr | anti-pattern | solution | reviewer"
outputs:
  hits: "ordered list; each hit: {type, id, description, stop_depth: index|summary|body}"
substrate_access:
  pattern: lazy
  reads:
    - .substrate/vocabulary/INDEX.md
    - .substrate/adr/INDEX.md
    - .substrate/anti-pattern/INDEX.md
    - .substrate/solution/INDEX.md
    - .substrate/reviewers/INDEX.md
  on_demand: entry body files under .substrate/, fetched only when index description is ambiguous relative to the query
---

## Summary

Accept a query (topic, path glob, or `tag:<value>`) and an optional substrate type filter. Scan the relevant `INDEX.md` files first — always. Fetch an entry's `## Summary` block only when its index description is ambiguous relative to the query. Fetch the full entry body only when `## Summary` is still insufficient. Return hits ordered by relevance, each annotated with the stop-depth actually used (`index`, `summary`, or `body`).

## Procedure

### Step 1 — Parse the query

Classify the query into one of three forms:

- **Topic**: natural language with no `/`, `*`, or `tag:` prefix. Matches against the `description` column in the index. For the reviewer index, also matches against the `Category` column.
- **Path glob**: contains `/` or `*` (e.g. `src/auth/**`). For reviewers, matches against the `Fires on` index column. For all other types, `scope` is in entry frontmatter — not in the index — so a summary fetch is required.
- **Tag**: begins with `tag:` followed by a tag value (e.g. `tag:security`). Tags live in entry frontmatter, not index columns, so a summary fetch is required for all types.

If `type_filter` is given, limit all subsequent steps to that substrate type. Otherwise, query all five types.

### Step 2 — Load the index layer

For each applicable substrate type, read its `INDEX.md`. Do not open any entry body files yet.

**Standard index columns** (vocabulary, adr, anti-pattern, solution):
```
| ID | Description | Path |
```

**Reviewer index columns** (adds at-a-glance predicate fields):
```
| ID | Description | Category | Fires on | Path |
```

### Step 3 — Score candidates at the index layer

For each row, compute an initial relevance classification:

**Topic query** — compare query terms against the `description` column (all types) and additionally against `Category` for reviewers:
- **Clear match**: description directly addresses the query topic → high relevance; STOP at index; include as a hit.
- **Clear non-match**: description is about something unrelated → relevance zero; STOP at index; exclude.
- **Ambiguous**: description could plausibly apply or not → mark for summary fetch (Step 4).

**Path glob query**:
- *Reviewer index*: compare the glob against the `Fires on` column heuristically. A match → high-relevance hit at stop-depth `index`. A non-match → exclude at index.
- *Other types*: `scope` is not in the standard index columns. Mark all non-reviewer candidates for summary fetch (Step 4), where `scope` frontmatter will be checked.

**Tag query**: Tags are not in any index column. Mark all candidates for summary fetch (Step 4).

### Step 4 — Fetch `## Summary` for marked candidates

For each candidate marked in Step 3, open its entry file (path from the `Path` column). Read the YAML frontmatter and the `## Summary` block. Stop reading at the first heading after `## Summary`.

Apply the following rules based on query form:

**Path glob / non-reviewer types**: check the `scope` frontmatter array against the query glob. If any scope glob overlaps the query → include as a hit at stop-depth `summary`. If no scope matches → exclude.

**Tag query**: check the `tags` frontmatter array for the queried tag value. Exact match → include at stop-depth `summary`. No match → exclude.

**Topic query (ambiguous candidates)**: re-evaluate relevance using the `## Summary` block content.
- Ambiguity resolved as relevant → include at stop-depth `summary`.
- Ambiguity resolved as irrelevant → exclude.
- Still ambiguous after reading `## Summary` → mark for full body fetch (Step 5).

### Step 5 — Fetch full body for remaining ambiguous candidates

For each candidate still marked as ambiguous after Step 4, read the complete entry body. Re-evaluate relevance.
- Ambiguity resolved as relevant → include at stop-depth `body`.
- Ambiguity resolved as irrelevant, or body provides no additional signal → exclude.

Do not escalate beyond the full body. If the body cannot resolve ambiguity, exclude the candidate.

### Step 6 — Rank hits by relevance

Collect all included hits across all stop-depths and rank them:

1. **Index hits with direct description match** — highest tier; description unambiguously addresses the query.
2. **Summary hits with strong match** — middle tier; `## Summary` confirmed clear relevance.
3. **Body hits** — lower tier; required deep reading to confirm relevance.
4. Within each tier, partial matches rank below full matches.
5. Within the same relevance tier and match strength, order by substrate type: `anti-pattern` → `adr` → `solution` → `vocabulary` → `reviewer`. This surfaces constraints first, then decisions, then solutions, then definitions, then reviewers.

### Step 7 — Return hits

Return the ranked hit list. Each hit carries exactly:

```yaml
hits:
  - type: <substrate type>
    id: <entry id>
    description: <the description value from the index row>
    stop_depth: index | summary | body
```

Do not include excluded candidates. Do not fetch entry bodies beyond what the stop-depth decision required — never pre-fetch for convenience.

## Column shape reference

Standard index (vocabulary, adr, anti-pattern, solution):
```markdown
| ID | Description | Path |
|---|---|---|
| entry-id | One-line summary | ./entry-file.md |
```

Reviewer index (adds Category and Fires on columns):
```markdown
| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| reviewer-id | One-line reviewer brief | concern-domain | path-summary | ./reviewer-file.md |
```

The `Fires on` column is a human-readable summary of the reviewer's predicate. Use it for heuristic path glob matching at the index layer. For formal predicate evaluation (outside the scope of this skill), read the entry body's `predicate:` frontmatter field.
