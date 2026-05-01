# Groove: schemas and conventions

Formal shapes for every artifact the Groove framework produces or consumes, plus the small DSLs and naming conventions referenced from `groove.md`, `skills-prd.md`, and `feature.yml`.

This document closes the planning loop. With these schemas, anyone implementing the skill pack, the substrate seed kit, or the validator scripts has an unambiguous spec to work from.

## What Yoke covers vs. what we add

Yoke ships its own JSON Schema at `docs/design/schemas/yoke-config.schema.json`. It validates the template config itself — `feature.yml`'s `version`, `template`, `pipeline.stages[*]`, `phases.<name>`, `worktrees`, `github`, `runtime`, `rate_limit` — including the `items_from`, `items_list`, `items_id`, `items_depends_on` fields and the `pre:` / `post:` / `retry_ladder` shapes. We use Yoke's schema unmodified for `feature.yml`.

What Yoke's schema cannot validate (because it's outside the harness's concern):

- The structure of files referenced by `items_from`. Yoke evaluates the JSONPath; it doesn't know what shape the items should have.
- Anything in `docs/` — workflow-scoped artifacts.
- Anything in `.substrate/` — project knowledge.

These are the schemas this document defines.

---

## 1. Slice schema (`docs/plan.slices.yml`)

Produced by `plan-synth`. Extended in place by `decompose` (which adds `semantic_depends_on` edges with `reason` fields). Iterated by the `build` stage.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/slice.schema.json",
  "title": "Slice list",
  "type": "object",
  "required": ["slices"],
  "additionalProperties": false,
  "properties": {
    "slices": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/slice" }
    }
  },
  "$defs": {
    "slice": {
      "type": "object",
      "required": ["id", "title", "acceptance_criteria", "touched_paths", "semantic_depends_on", "out_of_scope"],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
          "description": "kebab-case stable id"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 120
        },
        "acceptance_criteria": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string",
            "minLength": 1,
            "description": "one observable behavior, phrased as test-in-prose"
          }
        },
        "touched_paths": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string",
            "description": "glob, relative to repo root"
          }
        },
        "semantic_depends_on": {
          "type": "array",
          "items": { "$ref": "#/$defs/dependency" },
          "description": "filled by decompose phase; file-overlap edges have no reason field, semantic edges must"
        },
        "out_of_scope": {
          "type": "array",
          "items": { "type": "string" },
          "description": "explicit YAGNI guards for the GREEN phase"
        }
      }
    },
    "dependency": {
      "type": "object",
      "required": ["id"],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "description": "id of slice this slice depends on"
        },
        "reason": {
          "type": "string",
          "description": "required for semantic edges (added by [4b]); absent for file-overlap edges (added by [4a])"
        }
      }
    }
  }
}
```

**Validator extras** (beyond JSON Schema):
- All `id`s within `slices` must be unique.
- Every `dependency.id` must reference a real slice id.
- The DAG must be acyclic.
- `[4b]` may only ADD edges to `semantic_depends_on`; it must not remove file-overlap edges. Validator preserves the pre-derived edges and rejects diffs that drop them.

---

## 2. Findings schema (`docs/findings.json`)

Produced by `review-fanout`. Iterated by `resolve` and `defer` stages (with different JSONPath filters).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/findings.schema.json",
  "title": "Review findings",
  "type": "object",
  "required": ["findings"],
  "additionalProperties": false,
  "properties": {
    "findings": {
      "type": "array",
      "items": { "$ref": "#/$defs/finding" }
    }
  },
  "$defs": {
    "finding": {
      "type": "object",
      "required": ["id", "reviewer", "priority", "in_scope", "title", "description"],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^fnd-[a-z0-9]+(-[a-z0-9]+)*$",
          "description": "stable id, e.g. fnd-security-sentinel-001"
        },
        "reviewer": {
          "type": "string",
          "description": "slug of the reviewer entry that produced this finding"
        },
        "priority": {
          "type": "string",
          "enum": ["P1", "P2", "P3"]
        },
        "in_scope": {
          "type": "boolean",
          "description": "true if location falls within any slice's touched_paths"
        },
        "location": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "path": { "type": "string" },
            "line_start": { "type": "integer", "minimum": 1 },
            "line_end": { "type": "integer", "minimum": 1 }
          },
          "description": "optional; absent for findings that aren't location-bound"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 120,
          "description": "actionable, imperative-verb phrasing"
        },
        "description": {
          "type": "string",
          "minLength": 1,
          "description": "1-3 paragraphs; include reproducer if available"
        },
        "reproducer": {
          "type": "string",
          "description": "optional: code or steps that reproduce the finding"
        },
        "suggested_fix": {
          "type": "string",
          "description": "optional: reviewer's suggestion, used as input to resolve-finding"
        }
      }
    }
  }
}
```

**Validator extras:**
- All `id`s unique.
- `reviewer` must reference a real reviewer entry in `.substrate/reviewers/INDEX.md`.
- `in_scope` must be computed correctly: `true` iff `location.path` matches a glob in some slice's `touched_paths`.

---

## 3. Issues-filed schema (`docs/issues-filed.json`)

Appended by `file-issue`. Read by `harvest` to detect recurring deferral categories.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/issues-filed.schema.json",
  "title": "Issues filed registry",
  "type": "array",
  "items": { "$ref": "#/$defs/issue" },
  "$defs": {
    "issue": {
      "type": "object",
      "required": ["finding_id", "url", "filed_at", "dedup"],
      "additionalProperties": false,
      "properties": {
        "finding_id": {
          "type": "string",
          "pattern": "^fnd-[a-z0-9]+(-[a-z0-9]+)*$"
        },
        "url": {
          "type": "string",
          "format": "uri",
          "description": "GitHub issue URL"
        },
        "filed_at": {
          "type": "string",
          "format": "date-time"
        },
        "dedup": {
          "type": "boolean",
          "description": "true if URL points to a pre-existing issue (no new issue was created)"
        },
        "labels_applied": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

The file starts as `[]` (created by the `file-issue` phase's `pre:` step) and is appended to per finding.

---

## 4. Substrate frontmatter schemas

Every substrate file has YAML frontmatter at the top, then a Markdown body that opens with a `## Summary` block. The frontmatter shape varies by `type`. Common fields are factored into a base.

### 4a. Common base

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/substrate-frontmatter-base.schema.json",
  "title": "Substrate frontmatter (base)",
  "type": "object",
  "required": ["id", "type", "description", "created"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
      "description": "kebab-case stable id, used in cross-references and the index"
    },
    "type": {
      "type": "string",
      "enum": ["vocabulary", "adr", "anti-pattern", "solution", "reviewer"]
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200,
      "description": "one-line summary; this is what the substrate index displays"
    },
    "created": {
      "type": "string",
      "format": "date"
    },
    "supersedes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "ids of entries this supersedes; absent for original entries"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 4b. Vocabulary entry (`type: vocabulary`)

Adds nothing structural beyond the base. The body is the term's definition. One term per file.

### 4c. ADR entry (`type: adr`)

```json
{
  "allOf": [
    { "$ref": "groove/substrate-frontmatter-base.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "adr" },
        "status": {
          "type": "string",
          "enum": ["accepted", "superseded", "deprecated"]
        }
      },
      "required": ["status"]
    }
  ]
}
```

Body sections (Markdown convention, not JSON-schema-enforceable but checked by `validate-substrate`):
1. `## Summary`
2. `## Context`
3. `## Decision`
4. `## Alternatives considered`
5. `## Consequences`

### 4d. Anti-pattern entry (`type: anti-pattern`)

```json
{
  "allOf": [
    { "$ref": "groove/substrate-frontmatter-base.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "anti-pattern" },
        "scope": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string" },
          "description": "globs; the rule applies when work touches these paths"
        }
      },
      "required": ["scope"]
    }
  ]
}
```

Body must include the rule (`never X`), the reason (`because Y`), and a positive example. Required by `validate-substrate`.

### 4e. Solution entry (`type: solution`)

```json
{
  "allOf": [
    { "$ref": "groove/substrate-frontmatter-base.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "solution" },
        "scope": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tags": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string" },
          "description": "required for solutions; retrieval is by tag-similarity"
        },
        "worked_example_url": {
          "type": "string",
          "format": "uri",
          "description": "link to the merged PR that established the solution"
        }
      },
      "required": ["tags"]
    }
  ]
}
```

Body sections: problem statement, approach, references to ADRs and anti-patterns, link to merged diff.

### 4f. Reviewer entry (`type: reviewer`)

The most novel of the substrate types. Frontmatter declares when the reviewer fires; body declares the brief identity and the checklist.

```json
{
  "allOf": [
    { "$ref": "groove/substrate-frontmatter-base.schema.json" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "reviewer" },
        "predicate": { "$ref": "groove/predicate.schema.json" },
        "priority_floor": {
          "type": "string",
          "enum": ["P1", "P2", "P3"],
          "description": "the lowest priority this reviewer is allowed to assign; e.g., security may only assign P1/P2"
        },
        "category": {
          "type": "string",
          "description": "label applied to issues filed from findings (security, performance, architecture, etc.)"
        }
      },
      "required": ["predicate", "category"]
    }
  ]
}
```

---

## 5. Reviewer predicate DSL (`predicate.schema.json`)

The "fires when" expression that `review-fanout` evaluates against the workflow's diff. Small DSL, JSON-Schema-validated.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/predicate.schema.json",
  "title": "Reviewer predicate",
  "oneOf": [
    { "$ref": "#/$defs/leaf" },
    { "$ref": "#/$defs/composite" }
  ],
  "$defs": {
    "leaf": {
      "type": "object",
      "oneOf": [
        {
          "required": ["paths"],
          "additionalProperties": false,
          "properties": {
            "paths": {
              "type": "array",
              "items": { "type": "string" },
              "description": "globs; fires if any path in the diff matches any glob"
            }
          }
        },
        {
          "required": ["new_files_in"],
          "additionalProperties": false,
          "properties": {
            "new_files_in": {
              "type": "array",
              "items": { "type": "string" },
              "description": "globs; fires if any newly-added file matches"
            }
          }
        },
        {
          "required": ["diff_contains"],
          "additionalProperties": false,
          "properties": {
            "diff_contains": {
              "type": "array",
              "items": { "type": "string" },
              "description": "literal substrings; fires if any appears in the diff text"
            }
          }
        },
        {
          "required": ["always"],
          "additionalProperties": false,
          "properties": {
            "always": {
              "type": "boolean",
              "const": true,
              "description": "fires on every workflow; use sparingly"
            }
          }
        }
      ]
    },
    "composite": {
      "type": "object",
      "oneOf": [
        {
          "required": ["any"],
          "additionalProperties": false,
          "properties": {
            "any": {
              "type": "array",
              "minItems": 1,
              "items": { "$ref": "groove/predicate.schema.json" }
            }
          }
        },
        {
          "required": ["all"],
          "additionalProperties": false,
          "properties": {
            "all": {
              "type": "array",
              "minItems": 1,
              "items": { "$ref": "groove/predicate.schema.json" }
            }
          }
        },
        {
          "required": ["not"],
          "additionalProperties": false,
          "properties": {
            "not": { "$ref": "groove/predicate.schema.json" }
          }
        }
      ]
    }
  }
}
```

Examples in YAML:

```yaml
# Fires only when auth or API code is touched
predicate:
  any:
    - paths: ["src/auth/**", "src/api/**"]

# Fires on any new migration OR if the diff mentions raw SQL
predicate:
  any:
    - new_files_in: ["migrations/**"]
    - diff_contains: ["execute(", "raw_sql"]

# Always fires (e.g., simplicity reviewer that checks every diff)
predicate:
  always: true

# Fires on auth changes UNLESS only tests changed
predicate:
  all:
    - any:
        - paths: ["src/auth/**"]
    - not:
        all:
          - paths: ["test/**"]
```

The DSL is intentionally limited to v1. Extensions (AST queries, semantic-version-aware checks, custom plugin predicates) are deferred until we've seen real reviewer rosters in production.

---

## 6. Substrate index format

Each substrate type has an `INDEX.md` at the type's root. Markdown table; required columns; one row per entry. Always-loaded layer per the progressive-disclosure invariant.

```markdown
# Vocabulary index

| ID | Description | Path |
|---|---|---|
| workspace | A user's isolated tenant boundary; see ADR-007 | ./workspace.md |
| materialization | The act of giving an abstract entity a filesystem location | ./materialization.md |
```

Reviewer index has additional columns for the predicate at-a-glance:

```markdown
# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | OWASP top 10, injection, auth flaws | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | YAGNI, complexity flags, readability | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | System design, component boundaries | architecture | new-files-in src/ | ./architecture-strategist.md |
```

The "Fires on" column is a human-readable summary; the formal predicate lives in the entry body's frontmatter.

`validate-substrate` checks that every entry under each type's directory has a row in `INDEX.md` and vice versa.

---

## 7. Workflow doc frontmatter shapes

The workflow-scoped artifacts in `docs/` follow the same frontmatter convention as substrate, with type values that mark them as workflow artifacts (not substrate).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "groove/workflow-doc-frontmatter.schema.json",
  "title": "Workflow doc frontmatter",
  "type": "object",
  "required": ["id", "type", "description", "created", "workflow_id"],
  "properties": {
    "id": { "type": "string" },
    "type": {
      "type": "string",
      "enum": ["brainstorm", "research", "plan", "verification", "harvest"]
    },
    "description": { "type": "string", "maxLength": 200 },
    "created": { "type": "string", "format": "date" },
    "workflow_id": {
      "type": "string",
      "description": "the parent workflow's id; same across all docs in one worktree"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

Body must open with a `## Summary` block (≤5 lines). Beyond that, each `type` has its own conventions per the prompts in `prompts.md`.

---

## 8. Workflow ID convention

Generated by Yoke's dashboard "new workflow" form, but the convention is enforced for downstream determinism.

- **Format:** kebab-case, lowercase, `[a-z0-9-]`, max 50 chars.
- **Suggestion algorithm:** derived from the user's first prompt or workflow name. Strip articles ("a", "the", "an"). Use the first 4–6 content words. Append a numeric suffix if the resulting id collides with an existing worktree.
- **Examples:**
  - "Add email notifications when comments are posted" → `add-email-notifications-comments`
  - "Fix the materialization cascade bug" → `fix-materialization-cascade-bug`
  - Collision: `add-email-notifications-comments-2`
- **Where it appears:** worktree directory name (`.worktrees/<workflow-id>/`), `workflow_id` frontmatter field on every `docs/*.md`, slice prefix when slice ids would otherwise collide across workflows, GitHub PR branch name (`yoke/<workflow-id>`).

The workflow id is immutable for the lifetime of a worktree. Renaming it requires killing and restarting the workflow.

---

## 9. What's still implementation, not spec

Out of scope for the planning session; lives in implementation:

- **Validator scripts.** `validate-slices`, `validate-slice-dag`, `validate-findings`, `validate-substrate`, `validate-substrate-coverage`, `derive-file-dag`. Each is a small node CLI that loads the relevant JSON Schema and an artifact, runs Ajv (or equivalent), exits 0/non-zero. The schemas above fully specify their behavior.
- **Skill pack code.** The 14 skills described in `skills-prd.md`. Each is a SKILL.md with the format conventions section's frontmatter + body shape.
- **Substrate seed kit content.** Empty index files (the README's bash one-liner produces these), plus the 3 seed reviewer bodies (security-sentinel, code-simplicity-reviewer, architecture-strategist) and the seed anti-pattern (`never-write-all-tests-first`). Each follows the frontmatter shapes above.
- **Test fixtures for skills.** Per the PRD's "pressure tests" methodology — small example workflows that demonstrate with-skill vs. without-skill differential behavior.

---

## Cross-reference summary

| Schema | Defines shape of | Produced by | Consumed by |
|---|---|---|---|
| Slice | `docs/plan.slices.yml` | `plan-synth`, extended by `decompose` | `build` stage iteration, `verify-vs-plan` |
| Findings | `docs/findings.json` | `review-fanout` | `resolve` stage filter, `defer` stage filter |
| Issues-filed | `docs/issues-filed.json` | `file-issue` | `harvest` (recurring-deferral detection) |
| Substrate frontmatter (×4) | `.substrate/<type>/*.md` headers | `harvest`, `consolidate` | every phase that does substrate-read |
| Reviewer frontmatter | `.substrate/reviewers/*.md` headers | manual + `consolidate` | `review-fanout` predicate eval |
| Predicate | `predicate:` field in reviewer entries | reviewer authors | `review-fanout` |
| Substrate index | `.substrate/<type>/INDEX.md` | `harvest`, `consolidate` | every phase that does substrate-read |
| Workflow doc frontmatter | `docs/*.md` headers | each workflow phase | downstream phases, `harvest` |

Every artifact in the system has a defined shape. Every shape is referenced from at least one phase prompt, one consumer, and one validator. The plan is closed.
