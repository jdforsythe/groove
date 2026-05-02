---
name: consolidate
description: >-
  Run weekly substrate maintenance: promote recurring anti-patterns to reviewer
  entries, merge overlapping ADRs with supersession, mark stale solutions and
  superseded ADRs, and retag scope globs for moved files. All writes go through
  substrate-write (append-only). Invoke on cadence (weekly) or when substrate
  signal degrades.
inputs:
  harvest_history: "harvest counts per anti-pattern and solution for the last N workflows (default N=8); may be a summary table or a path to a JSON harvest log"
  git_log: "git history for the observation window (default: last 8 weeks); used to detect file moves for retag pass"
  promotion_threshold: "optional integer N (default 5); anti-patterns matched ≥N times in same scope in the observation window are promoted to reviewers"
outputs:
  promoted_reviewers: "0 or more new .substrate/reviewers/<id>.md entries created via substrate-write"
  merged_adrs: "0 or more new .substrate/adr/<id>.md entries (consolidated) created via substrate-write; superseded originals remain on disk"
  stale_markers: "0 or more new .substrate/solution/<id>-stale.md or .substrate/adr/<id>-stale.md entries marking zero-retrieval entries"
  retagged_entries: "0 or more new .substrate/<type>/<id>-v2.md (or versioned) entries with updated scope globs created via substrate-write"
substrate_access:
  pattern: eager
  reads:
    - .substrate/anti-pattern/INDEX.md
    - .substrate/adr/INDEX.md
    - .substrate/solution/INDEX.md
    - .substrate/reviewers/INDEX.md
    - ".substrate/anti-pattern/<id>.md  # all entries, for scope and rule extraction"
    - ".substrate/adr/<id>.md  # all entries, for decision overlap detection"
    - ".substrate/solution/<id>.md  # all entries, for retrieval-count staleness check"
  writes: "all via substrate-write — no direct file writes"
---

## Summary

Triggered weekly or when substrate quality degrades. Reads all four substrate indexes
and entry bodies eagerly. Runs four passes in order: promote (anti-patterns → reviewers),
merge (overlapping ADRs → consolidated entry), prune (stale solutions and superseded ADRs
→ stale markers), retag (scope globs for moved files → versioned entries). Every write
goes through `substrate-write`; no entry file is ever deleted or modified in place.

## Procedure

### Step 1 — Load all substrate indexes and entry bodies

Read the following indexes in full:
- `.substrate/anti-pattern/INDEX.md`
- `.substrate/adr/INDEX.md`
- `.substrate/solution/INDEX.md`
- `.substrate/reviewers/INDEX.md`

For each entry listed in every index, open and read the full entry file (frontmatter
+ body). This skill is eager — all four types are fully loaded before any pass runs.

Set the **promotion threshold N** from the `promotion_threshold` input if provided;
otherwise default to 5.

Set the **observation window** to the last 8 workflows (harvest history) and last 8
weeks (git log for retag).

Record:
- `anti_pattern_entries`: list of all anti-pattern entries (id, scope, rule, match counts from harvest history)
- `adr_entries`: list of all ADR entries (id, status, decision body, retrieval count)
- `solution_entries`: list of all solution entries (id, scope, tags, retrieval count)
- `reviewer_entries`: list of all reviewer entries (id, predicate, category)
- `file_moves`: list of (old_path_glob, new_path_glob) pairs from git history (Step 5)

After loading, proceed through Passes A–D in order. Do not interleave passes.

### Step 2 — Pass A: Promote recurring anti-patterns to reviewer entries

For each anti-pattern entry in `anti_pattern_entries`:

1. **Check threshold**: look up the entry's match count in the harvest history. If the
   count is less than N, skip this entry.

2. **Check scope**: if the entry's `scope` array is `["**"]` (universal scope — applies
   everywhere regardless of path), skip promotion. A universal-scope anti-pattern already
   applies on every workflow; promoting it would produce an `always: true` reviewer that
   fires on every diff, which is low-signal and crowds out targeted reviewers.

3. **Check for existing reviewer**: scan `reviewer_entries` for any reviewer whose
   predicate paths overlap the anti-pattern's scope. If a reviewer already covers this
   scope for this category, skip promotion to avoid duplicates.

4. **Derive the reviewer entry**:
   - `id`: `<anti-pattern-id>-reviewer` (kebab-case, truncated to keep under 50 chars if needed)
   - `type`: `reviewer`
   - `description`: derived from the anti-pattern's `description` field — rephrase as
     "Checks that [anti-pattern rule negation] in [scope short description]."
   - `created`: today's date (YYYY-MM-DD)
   - `predicate.any.paths`: the anti-pattern's `scope` array (verbatim)
   - `category`: `code-quality` (default for promoted reviewers; use a more specific
     category if the anti-pattern's description clearly implies one, e.g. `security` for
     SQL injection)
   - `priority_floor`: `P2` (default for promoted reviewers)
   - Body `## Summary`: ≤5 lines — state what the reviewer checks, which scope triggers
     it, and that it was promoted from harvest history with the match count.
   - Body `## Review checklist`: derive 2–4 checklist items from the anti-pattern's
     `## Rule` and `## Positive example` sections.

5. **Write via substrate-write**: call `substrate-write` with the derived entry. If
   `substrate-write` rejects the entry, log the rejection reason and skip this
   anti-pattern (do not retry with a modified entry — fix the derivation logic instead).

6. Do **not** modify or delete the source anti-pattern entry.

After all anti-patterns are evaluated, collect the list of promoted reviewer IDs.

### Step 3 — Pass B: Merge overlapping ADRs

For each pair of ADR entries in `adr_entries` whose status is `accepted`:

1. **Detect overlap**: compare the `## Decision` sections of both entries. Entries
   overlap if they record the same architectural decision — same outcome, same affected
   components, same constraints — even if worded differently. Do not merge ADRs that
   share a theme but make distinct decisions (e.g., "use Redis" vs. "use Redis Cluster"
   are sequential, not duplicate).

   Overlap indicators:
   - Both decisions name the same component/layer (e.g., repository, session store).
   - Both decisions prohibit or require the same thing (e.g., no direct ORM imports).
   - One decision body explicitly references or restates the other.

   Non-overlap indicators:
   - The decisions differ in outcome (one accepts A, the other accepts B).
   - The decisions affect different components.
   - The newer decision explicitly supersedes or extends the older one in a meaningful
     way (new constraint or changed implementation).

2. **Merge**: if overlap is detected, construct a consolidated ADR entry:
   - `id`: derive a new id that captures the merged intent in kebab-case.
   - `type`: `adr`
   - `status`: `accepted`
   - `description`: a single-sentence summary of the canonical decision, ≤200 chars.
   - `created`: today's date.
   - `supersedes`: array containing both overlapping entry ids.
   - Body: synthesize a single well-formed ADR body with:
     - `## Summary` (≤5 lines): state what the canonical decision is and which entries it merges.
     - `## Context`: combine the context from both entries; credit the original dates.
     - `## Decision`: the authoritative decision statement (union of both decisions).
     - `## Alternatives considered`: union of alternatives from both entries.
     - `## Consequences`: union of consequences from both entries.

3. **Write via substrate-write**: call `substrate-write` with `supersedes` set to both
   overlapping ids. The `substrate-write` skill will update the ADR index to mark both
   original rows as `superseded`.

4. Do **not** modify or delete the original ADR files. The `substrate-write` step
   handles the index row update.

5. **Skip non-overlapping ADRs**: if no overlap is detected with any other entry, leave
   the entry unchanged.

After all pairs are evaluated, mark the merged entries in `adr_entries` so the prune
pass (Step 4) can identify them as now-superseded.

### Step 4 — Pass C: Prune stale entries

**Stale solution detection:**

For each solution entry in `solution_entries`:

1. Look up the retrieval count from the harvest history observation window.
2. If the retrieval count is 0 (zero retrievals in the window), the entry is stale.
3. Write a stale-marker entry via `substrate-write`:
   - `id`: `<solution-id>-stale`
   - `type`: `solution`
   - `description`: `[STALE] ` + original description + ` — no retrievals in last N workflows. May be outdated.`
   - `created`: today's date
   - `supersedes`: `[<original-id>]`
   - `scope`: same as original
   - `tags`: original tags + `[stale]`
   - Body `## Summary` (≤5 lines): state that this is a stale marker, give the
     original id and zero-retrieval count, note the original file is preserved.
   - Body `## Original description`: copy the original entry's description line.
4. Do **not** delete the original solution file.

**Stale ADR detection:**

For each ADR entry in `adr_entries` that is now `superseded` (either from the initial
index load or as a result of Pass B merges in Step 3):

The `substrate-write` supersession step already updated the ADR index row to `superseded`.
No additional write is required by the prune pass for ADRs — the index row update from
Pass B is sufficient to make staleness visible at the index layer.

If an ADR's status was `superseded` in the original index load (i.e., it was superseded
before this consolidate run), verify it has a `superseded` status in the index row. If
the row was missed (status still shows `accepted`), write a corrective note but do not
attempt an in-place index edit — flag this for manual review.

### Step 5 — Pass D: Retag scope globs for moved files

**Detect file moves:**

From the `git_log` input (git history for the observation window), extract pairs of
(old_path, new_path) where files or directories were moved or renamed. Normalize each
pair into glob form:

- If a directory was renamed (`src/handlers/` → `src/http/`), produce
  (`src/handlers/**`, `src/http/**`).
- If a single file was moved, produce exact path pairs.

**Scan entries for stale globs:**

For each anti-pattern entry in `anti_pattern_entries` and each solution entry in
`solution_entries`:

1. Check every glob in the entry's `scope` array against the detected file-move pairs.
2. A scope glob is stale if it matches an old path and the new path is distinct and
   no longer covered by the same glob.
3. **Broad glob exception**: if a scope glob is broad enough to cover both the old
   and new paths (e.g., `src/**` covers both `src/handlers/**` and `src/http/**`),
   the glob is still valid — do not retag.

**Write retagged entries:**

For each entry with at least one stale scope glob:

1. Construct a new entry:
   - `id`: `<original-id>-v2` (append `-v3`, `-v4` etc. if `-v2` already exists)
   - All frontmatter fields carried over from the original, except:
     - `id`: the new versioned id
     - `created`: today's date
     - `scope`: the updated scope array (old glob replaced by new glob; other globs unchanged)
     - `supersedes`: `[<original-id>]`
   - Body: copy the original body, then append a one-line note at the end of the
     `## Summary` block: `Scope updated: <old-glob> renamed to <new-glob>.`

2. Write via `substrate-write`.

3. Do **not** modify or delete the original entry file.

**Do not retag reviewers in this pass** unless the reviewer was created in Pass A of
this same consolidate run (the promoted reviewer's predicate paths came directly from
the anti-pattern's scope, so if the anti-pattern is retagged, the promoted reviewer's
predicate should reflect the new paths). In that case, write a corrected reviewer entry
superseding the one created in Pass A, using the updated scope globs.

### Step 6 — Report

After all four passes complete, output a consolidate report:

```
Consolidate complete — <date>

Pass A (Promote):   <N> reviewer(s) promoted
  + <reviewer-id> ← <anti-pattern-id> (match count: <M>)

Pass B (Merge):     <N> ADR(s) merged
  + <merged-adr-id> ← [<adr-id-1>, <adr-id-2>]

Pass C (Prune):     <N> stale marker(s) written
  + <stale-id> ← <original-id> (0 retrievals)

Pass D (Retag):     <N> retagged entry/entries written
  + <new-id> ← <original-id> (src/handlers/** → src/http/**)

Nothing deleted. All writes append-only via substrate-write.
```

If a pass produced zero changes, report `0` for that pass.

If any `substrate-write` call was rejected during the run, list each rejection at the
end of the report under `Skipped (substrate-write rejected):`.

## Constraints

- **Never delete any substrate entry file.** Prune and merge operations mark entries
  stale or superseded — they do not remove files from disk.
- **Never modify any existing substrate entry file in place.** All changes are expressed
  as new entries via `substrate-write` with `supersedes` links.
- **All writes go through `substrate-write`.** Direct file creation bypassing the skill
  is forbidden; frontmatter validation and index updates are `substrate-write`'s
  responsibility.
- **Passes run in order A → B → C → D.** Pass B uses the output of Pass A (newly
  promoted reviewers are visible before the prune pass). Pass C uses the output of Pass B
  (merged ADRs are marked superseded before the prune pass checks ADR status). Pass D
  uses the output of Passes A and B (retag updates reviewer predicates if they were
  promoted in Pass A).
- **Universal-scope anti-patterns (`["**"]`) are not promoted in Pass A.** They produce
  always-firing reviewers that crowd out targeted ones.
- **Non-overlapping ADRs are not merged in Pass B.** Sequential decisions (A supersedes B)
  are not the same as duplicate decisions (A and B say the same thing). Do not merge
  decisions that differ in outcome, component, or constraint.
- **Stale threshold is zero retrievals** in the observation window (default 8 workflows).
  An entry retrieved even once is not pruned.
- **Broad scope globs are not retagged in Pass D** unless the glob specifically names
  the old path in a way that no longer matches the new location.
- **Do not mention any specific harness** in entry bodies or the report. Skills compose
  via shared artifact paths and substrate, not direct calls.
- **One consolidate run at a time.** If a previous consolidate run left partial state
  (e.g., a stale-marker entry exists for an entry that is also a retag candidate), process
  the retag against the current state and do not double-prune.
