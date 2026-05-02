# Contributing to Groove substrate

Guidelines for authoring and maintaining substrate entries.

---

## The progressive-disclosure invariant

Every substrate file has two read sites: the **index scan** and the **body fetch**. Both sites must be populated independently.

**Index scan** (`INDEX.md` table row): the always-loaded layer. Skills load only the index at startup — never the full entry bodies. The `description` frontmatter field is what appears in the index table. It must be self-contained: a reader who sees only the index row should know whether this entry is relevant to their current task, without opening the file.

**Body fetch** (the entry file itself): loaded on demand when a skill or agent decides the entry is relevant. The file opens with a `## Summary` block (≤5 lines) that provides a slightly fuller picture — scope, when to consult, key terms. The body below the summary is the full detail: checklists, rules, examples, references.

**Why both?** Because the `description` frontmatter lives in the index row and the `## Summary` block lives in the file body. These two read sites serve different consumers at different moments. Populating only one breaks the invariant: an index-only entry has no usable body; a body-only entry is invisible to index scans and never surfaced by skills that load the always-loaded layer.

When you author a substrate entry:

1. Write the `description` frontmatter field as a single line, ≤200 characters, that stands alone in a table row.
2. Open the file body with a `## Summary` block of ≤5 lines that expands on the description with scope and context.
3. Write the full detail below the summary.

---

## Format conventions

| Need | Format |
|---|---|
| Prose content | Markdown |
| File metadata | YAML frontmatter (between `---` delimiters at the top of the file) |
| Nested structured data inside a file | YAML in a fenced code block (` ```yaml `) |
| Machine-readable inter-phase artifacts (`findings.json`, `plan.slices.yml`) | JSON (workflow artifacts only) |
| Substrate storage | **JSON is forbidden** |

**Why JSON is forbidden for substrate:** substrate files are read by agents, diffed by humans, and edited by hand. YAML frontmatter with a Markdown body is the format that serves all three consumers. JSON for substrate would require escaping, loses comments, and is harder to read in a diff. The schemas in `docs/schemas-and-conventions.md` define the allowed frontmatter shapes; the format for all substrate files is Markdown with YAML frontmatter.

---

## Substrate types and required frontmatter

Every substrate file requires these base fields:

```yaml
id: kebab-case-stable-id
type: vocabulary | adr | anti-pattern | solution | reviewer
description: One-line summary; ≤200 characters; appears in INDEX.md
created: YYYY-MM-DD
```

Additional required fields by type:

| Type | Extra required fields |
|---|---|
| `adr` | `status: accepted \| superseded \| deprecated` |
| `anti-pattern` | `scope: [glob, ...]` (minItems: 1) |
| `solution` | `tags: [tag, ...]` (minItems: 1) |
| `reviewer` | `predicate: <DSL expression>`, `category: string` |

See `docs/schemas-and-conventions.md` for the full schemas and the predicate DSL.

---

## Substrate is append-only

Never silently edit a substrate entry's meaning. If an entry is wrong or stale:

- Add a new entry that supersedes it, with `supersedes: [old-id]` in the frontmatter.
- Mark the old entry's `status` as `superseded` (for ADRs) or add a `supersedes` back-reference.

Silent edits poison context: agents that loaded the old entry in a prior context window will have seen different content than agents that load the new version. Explicit supersession makes staleness visible and the history debuggable.

---

## Keeping indexes current

Every entry under a substrate type directory must have a row in that type's `INDEX.md`. When you add an entry, add its row. When you supersede an entry, update the index row to reflect the new state. The `validate-substrate` script (when it exists) checks this bidirectionally.
