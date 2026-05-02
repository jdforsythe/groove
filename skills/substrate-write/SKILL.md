---
name: substrate-write
description: >-
  Append a validated substrate entry to .substrate/<type>/ and update the
  type's INDEX.md. Validates frontmatter and body convention before writing.
  Append-only: never removes or overwrites existing files. Invoke when harvest
  or consolidate needs to persist a new substrate entry.
inputs:
  type: "vocabulary | adr | anti-pattern | solution | reviewer"
  frontmatter: "YAML object; required: id (kebab-case), type, description (≤200 chars), created (YYYY-MM-DD); plus type-specific fields"
  body: "Markdown string; must open with a ## Summary block of ≤5 non-blank lines"
  supersedes: "optional array of existing entry ids that this entry supersedes"
outputs:
  written_path: ".substrate/<type>/<id>.md — the new entry file"
  updated_index: ".substrate/<type>/INDEX.md — one row appended; ADR superseded rows updated"
substrate_access:
  pattern: eager
  reads:
    - ".substrate/<type>/INDEX.md"
    - ".substrate/<type>/<superseded-id>.md  # existence check; one per supersedes entry"
  writes:
    - ".substrate/<type>/<id>.md"
    - ".substrate/<type>/INDEX.md"
---

## Summary

Accept a substrate type, frontmatter fields, body text, and an optional supersedes list. Validate the frontmatter against the base schema and the type-specific extension, then confirm the body opens with a `## Summary` block of ≤5 non-blank lines. On success, write the new entry file and append one row to the type's `INDEX.md`. Never delete or overwrite existing files. For supersession writes, record the superseded ids in the new entry's frontmatter and, for ADR entries only, update the old rows' Status column in the index.

## Procedure

### Step 1 — Validate base frontmatter

Check each required field. Stop at the first failure and report the field and constraint:

| Field | Constraint | Rejection message |
|---|---|---|
| `id` | matches `^[a-z0-9]+(-[a-z0-9]+)*$` | REJECT: `id` is missing or not kebab-case |
| `type` | one of: `vocabulary`, `adr`, `anti-pattern`, `solution`, `reviewer` | REJECT: `type` is missing or not a valid substrate type |
| `description` | non-empty string, 1–200 characters | REJECT: `description` is missing or exceeds 200 characters |
| `created` | string matching `YYYY-MM-DD` with valid calendar values | REJECT: `created` is missing or not a valid ISO date |

If any check fails, output the rejection message and stop.

### Step 2 — Validate type-specific frontmatter

Apply additional constraints based on `type`:

**`anti-pattern`**: `scope` must be a non-empty array of strings (≥1 item).
- REJECT: `anti-pattern` entries require a non-empty `scope` array — if `scope` is absent, null, or empty.

**`solution`**: `scope` must be a non-empty array of strings; `tags` must be a non-empty array of strings (≥1 item).
- REJECT: `solution` entries require a non-empty `scope` array — if `scope` is absent, null, or empty.
- REJECT: `solution` entries require a non-empty `tags` array — if `tags` is absent, null, or empty.

**`adr`**: `status` must be present and one of `accepted`, `superseded`, `deprecated`.
- REJECT: `adr` entries require a `status` field with value `accepted`, `superseded`, or `deprecated` — if absent or invalid.

**`reviewer`**: `predicate` must be present (any valid predicate DSL object); `category` must be a non-empty string.
- REJECT: `reviewer` entries require a `predicate` field — if absent.
- REJECT: `reviewer` entries require a non-empty `category` field — if absent or empty.

**`vocabulary`**: no additional required fields beyond the base.

### Step 3 — Validate body opening convention

Parse the `body` string. Strip any leading blank lines. The first non-blank line must be exactly `## Summary`. If it is not:
- REJECT: body must open with `## Summary` — found `<actual first line>` instead.

After the `## Summary` heading, collect all lines until the next `##`-level (or higher) heading or the end of the body. Count only non-blank lines. If that count exceeds 5:
- REJECT: `## Summary` block exceeds 5 non-blank lines — found `<N>` lines.

### Step 4 — Check for id collision

Read `.substrate/<type>/INDEX.md`. Scan all existing rows for an `ID` column value that matches the requested `id`. If a match exists:
- REJECT: entry with id `<id>` already exists in `.substrate/<type>/`; use a supersession write (provide `supersedes: [<id>]`) if replacing a prior entry.

### Step 5 — Validate and process supersession

Skip this step if `supersedes` is absent or empty.

For each `superseded_id` in the `supersedes` array:

1. Confirm that `.substrate/<type>/<superseded_id>.md` exists on disk.
   - REJECT: superseded id `<superseded_id>` not found in `.substrate/<type>/` — old entry must exist before it can be superseded.

2. **For `adr` type only**: update the superseded entry's row in `.substrate/adr/INDEX.md`:
   - Locate the row whose `ID` column equals `<superseded_id>`.
   - If the index header is still the 3-column format (`| ID | Description | Path |`), first upgrade it to `| ID | Description | Status | Path |` and insert an `accepted` status cell into every existing data row.
   - Change the `Status` cell of the located row from its current value to `superseded`.
   - Write the updated `INDEX.md` back to disk. No other rows may be altered.

### Step 6 — Write the new entry file

Construct the complete file content:

```
---
<frontmatter fields in YAML, including supersedes array if provided>
---

<body>
```

The `supersedes` array must appear in the frontmatter if it was supplied. All other provided frontmatter fields are written as-is.

Write to `.substrate/<type>/<id>.md`. If this path already exists on disk, abort with a hard error — the id-collision check in Step 4 must prevent reaching this point, but this is a non-negotiable safety gate.

### Step 7 — Append a row to INDEX.md

Read the current `.substrate/<type>/INDEX.md`. Append exactly one new row at the end of the table. Do not alter any existing rows (except the ADR header upgrade and superseded-row updates already applied in Step 5).

**Standard types** (`vocabulary`, `anti-pattern`, `solution`):
```
| <id> | <description> | ./<id>.md |
```

**ADR type** — uses a 4-column format to surface status at index scan time:
- If the index is still in 3-column format, upgrade the header to `| ID | Description | Status | Path |` and add `accepted` status cells to all existing rows (same upgrade as Step 5).
- Append:
```
| <id> | <description> | <status> | ./<id>.md |
```

**Reviewer type** — uses the 5-column format defined in `schemas-and-conventions.md` §6:
```
| <id> | <description> | <category> | <fires_on_summary> | ./<id>.md |
```

Generate `<fires_on_summary>` from the `predicate` field using these rules:
- `{always: true}` → `always`
- `{paths: [...globs...]}` → globs joined with `, ` (strip trailing `**`)
- `{new_files_in: [...globs...]}` → `new-files-in ` + globs joined with `, `
- `{diff_contains: [...strings...]}` → `diff-contains: ` + strings joined with `, `
- `{any: [...predicates...]}` → each leaf summarized, joined with ` | `
- `{all: [...predicates...]}` → each leaf summarized, joined with ` & `
- `{not: <predicate>}` → `not: ` + inner summary

Write the updated INDEX.md back to disk.

### Step 8 — Confirm and report

Output a short confirmation:

```
Written: .substrate/<type>/<id>.md
Index updated: .substrate/<type>/INDEX.md
```

If supersession was processed:
```
Superseded: <superseded_id_1>, <superseded_id_2>, ...
```

For ADR supersession: also report which index rows were updated to `superseded`.
