# Yoke prompt files for the Groove `consolidate.yml`

This file contains all 5 prompts referenced by the Groove consolidate pipeline. Each section is one file. Split at the `===== FILE: <name> =====` markers; the file should land at `.yoke/prompts/<name>` exactly as listed.

Each prompt invokes a named skill from the **Groove skill pack**. Wire that pack into your Claude Code session via plugin or local skill directory before running the workflow.

Conventions used in every prompt:
- The active skill name from the Groove skill pack is named explicitly.
- Eager-loaded substrate is listed first (read these BEFORE doing anything else).
- Lazy-loaded substrate is referenced by its index — fetch bodies only when needed.
- Stop conditions are explicit. Anti-patterns are explicit. No flattery, no role inflation.
- Workflow-scoped artifacts live in `docs/`. Project knowledge lives in `.substrate/`.
- **Consolidate never touches source code.** All writes target `.substrate/` only. No PR is opened.

---

===== FILE: consolidate-substrate-read.md =====

# Phase: consolidate-substrate-read

You are running the `substrate-read` skill from the Groove skill pack in full-eager mode. This is the substrate inventory phase for a consolidate workflow.

## What you must do

1. Read ALL five substrate indexes in full:
   - `.substrate/vocabulary/INDEX.md`
   - `.substrate/adr/INDEX.md`
   - `.substrate/anti-patterns/INDEX.md`
   - `.substrate/solutions/INDEX.md`
   - `.substrate/reviewers/INDEX.md`

2. For each entry listed in every index, open and read the full entry file (frontmatter + body). This phase is **fully eager** — no lazy loading. Every body must be in working memory before any subsequent phase runs.

3. Record the following inventory:
   - `anti_pattern_entries`: list of all anti-pattern entries (id, scope, rule, match counts from harvest history if available)
   - `adr_entries`: list of all ADR entries (id, status, decision body)
   - `solution_entries`: list of all solution entries (id, scope, tags, retrieval count if available)
   - `reviewer_entries`: list of all reviewer entries (id, predicate, category)
   - `vocabulary_entries`: list of all vocabulary entries (id, description)

4. Output a brief inventory report to the workflow log (not a file):
   - Count of entries per type
   - Any index rows that point to missing files (these are integrity gaps to note)
   - Any entries that lack required frontmatter fields

## Stop conditions

- All five indexes read.
- All entry bodies opened.
- Inventory report output.

## Anti-patterns

- Lazy loading in this phase (all bodies are needed before any pass runs).
- Skipping the integrity check (missing files are consolidation targets).
- Proceeding to subsequent phases with incomplete inventory.

---

===== FILE: promote-anti-patterns.md =====

# Phase: promote-anti-patterns

You are running the `consolidate` skill (Pass A) from the Groove skill pack.

This phase promotes recurring anti-patterns to reviewer entries. It assumes the full substrate inventory from the `consolidate-substrate-read` phase is in context.

## What you must do

1. For each anti-pattern entry in the inventory:

   a. **Check threshold**: how many times has this anti-pattern been matched in harvest history (default observation window: last 8 workflows)? If the count is below the threshold (default: 5), skip.

   b. **Check scope**: if the entry's `scope` is `["**"]` (universal scope), skip. Universal-scope anti-patterns already fire everywhere; promoting them produces always-on reviewers that crowd out targeted ones.

   c. **Check for existing reviewer**: does any reviewer in the inventory already cover this scope for this category? If yes, skip — no duplicates.

   d. **Derive the reviewer entry**:
      - `id`: `<anti-pattern-id>-reviewer`
      - `type`: reviewer
      - `description`: rephrased as "Checks that [anti-pattern rule negation] in [scope short description]."
      - `created`: today's date
      - `predicate.any.paths`: the anti-pattern's `scope` array
      - `category`: `code-quality` (or more specific if clearly implied)
      - `priority_floor`: `P2`
      - Body `## Summary` (≤5 lines): what the reviewer checks, which scope, promoted from harvest with match count.
      - Body `## Review checklist`: 2–4 items derived from the anti-pattern's rule and positive example.

   e. **Write via `substrate-write`**: call `substrate-write` with the derived entry. If rejected, log the rejection and skip (do not edit the anti-pattern to force it through).

2. Do NOT modify or delete source anti-pattern entries.

## Stop conditions

- All anti-patterns evaluated against the threshold.
- Reviewer index updated for each promoted entry.
- `validate-substrate` passes on `.substrate/reviewers/`.

## Anti-patterns

- Promoting universal-scope anti-patterns (produces noisy always-on reviewers).
- Creating reviewer duplicates for scopes already covered.
- Modifying the source anti-pattern instead of writing a new reviewer.
- Bypassing `substrate-write` for direct file creation.

---

===== FILE: merge-adrs.md =====

# Phase: merge-adrs

You are running the `consolidate` skill (Pass B) from the Groove skill pack.

This phase merges overlapping ADR pairs into consolidated ADR entries. It assumes the full substrate inventory from `consolidate-substrate-read` is in context.

## What you must do

1. For each pair of ADR entries whose status is `accepted`:

   a. **Detect overlap**: compare the `## Decision` sections. Entries overlap if they record the same architectural decision — same outcome, same affected components, same constraints — even if worded differently.

   Overlap indicators:
   - Both decisions name the same component/layer.
   - Both decisions prohibit or require the same thing.
   - One decision body explicitly references or restates the other.

   Non-overlap indicators:
   - The decisions differ in outcome.
   - The decisions affect different components.
   - The newer decision explicitly supersedes or extends the older one in a meaningful way.

   b. **If overlap detected**, construct a consolidated ADR entry:
      - `id`: new kebab-case id capturing the merged intent
      - `type`: adr
      - `status`: accepted
      - `description`: single-sentence canonical decision (≤200 chars)
      - `created`: today's date
      - `supersedes`: both overlapping entry ids
      - Body sections: `## Summary` (≤5 lines, state which entries are merged), `## Context` (combined), `## Decision` (authoritative statement), `## Alternatives considered` (union), `## Consequences` (union)

   c. **Write via `substrate-write`** with `supersedes` set. The skill updates the ADR index rows for both originals to `superseded`.

2. Do NOT modify or delete original ADR files.

## Stop conditions

- All accepted ADR pairs evaluated.
- Each merged ADR written via `substrate-write`.
- ADR index updated.
- `validate-substrate` passes on `.substrate/adr/`.

## Anti-patterns

- Merging ADRs that make distinct decisions (sequential is not the same as duplicate).
- Removing original ADR files (append-only; supersession makes them discoverable).
- Writing a merged entry without `supersedes` (breaks the supersession chain).
- Bypassing `substrate-write`.

---

===== FILE: prune-stale.md =====

# Phase: prune-stale

You are running the `consolidate` skill (Pass C) from the Groove skill pack.

This phase writes stale markers for entries with zero retrievals in the observation window. Nothing is deleted. It assumes the full substrate inventory from `consolidate-substrate-read` is in context, including retrieval counts from harvest history.

## What you must do

### Stale solutions

For each solution entry in the inventory:

1. Look up the retrieval count from harvest history (observation window: last 8 workflows).
2. If count is 0 (zero retrievals), write a stale-marker entry via `substrate-write`:
   - `id`: `<solution-id>-stale`
   - `type`: solution
   - `description`: `[STALE] ` + original description + ` — no retrievals in last N workflows. May be outdated.`
   - `created`: today's date
   - `supersedes`: `[<original-id>]`
   - `scope`: same as original
   - `tags`: original tags + `[stale]`
   - Body `## Summary` (≤5 lines): state it is a stale marker, give original id and zero-retrieval count, note original file is preserved.

### Stale ADRs

For ADR entries with status `superseded` in the original index load (superseded before this run, not by Pass B of this run):

1. Verify the ADR index row shows `superseded`. If the row was missed (still shows `accepted`), note this for manual review — do not attempt an in-place index edit.

2. No additional write is required for ADRs superseded in this run (Pass B already updated the index rows).

## Stop conditions

- All solutions checked against the zero-retrieval threshold.
- Stale markers written for each zero-retrieval solution.
- ADR status consistency verified.
- `validate-substrate` passes on `.substrate/`.

## Anti-patterns

- Deleting original entry files (append-only; stale markers make staleness visible).
- Marking entries stale based on low-but-nonzero retrievals (threshold is strictly zero).
- Writing stale markers for entries that were active in the observation window.

---

===== FILE: retag-scopes.md =====

# Phase: retag-scopes

You are running the `consolidate` skill (Pass D) from the Groove skill pack.

This phase writes versioned entries with updated scope globs for anti-patterns and solutions whose scope paths no longer match the codebase layout. It assumes the full substrate inventory from `consolidate-substrate-read` is in context.

## What you must do

1. **Detect file moves** from the `git_log` input (git history for the observation window). Extract pairs of (old_path, new_path) where files or directories were moved or renamed. Normalize into glob form:
   - Directory renamed → (`src/handlers/**`, `src/http/**`)
   - Single file moved → exact path pairs

2. **Scan anti-pattern and solution entries** for stale scope globs:
   - For each entry, check every glob in `scope` against the detected file-move pairs.
   - A glob is stale if it matches an old path and the new path is no longer covered.
   - **Broad glob exception**: if the glob covers both old and new paths (`src/**` covers both `src/handlers/**` and `src/http/**`), it is still valid — do not retag.

3. **For each entry with at least one stale scope glob**, construct a new versioned entry:
   - `id`: `<original-id>-v2` (append `-v3`, `-v4` etc. if `-v2` already exists)
   - All frontmatter carried over except `id`, `created` (today), `scope` (updated), and `supersedes: [<original-id>]`
   - Body: copy original, then append one-line note to `## Summary`: `Scope updated: <old-glob> renamed to <new-glob>.`

4. **Write via `substrate-write`**.

5. **Reviewer predicate exception**: if a reviewer was promoted in `promote-anti-patterns` (Pass A of this same run) AND the source anti-pattern is being retagged, write a corrected reviewer entry superseding the Pass A entry, using the updated scope globs.

6. Do NOT retag reviewers that predate this run.

## Stop conditions

- All anti-pattern and solution scope globs checked against file-move pairs.
- Versioned entries written for each stale-scope entry.
- `validate-substrate` passes on `.substrate/`.

## Anti-patterns

- Retagging entries with broad globs that already cover both old and new paths.
- Modifying original entry files in place (append-only; versioned entries carry the update).
- Retagging reviewers from prior runs (only retag reviewers promoted in Pass A of this run).
- Bypassing `substrate-write`.

---

End of file. 5 prompts above. Split at the `===== FILE: ... =====` markers and place each at `.yoke/prompts/<name>` to match `consolidate.yml`.
