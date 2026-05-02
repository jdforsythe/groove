---
name: defer-finding
description: >-
  Given a single out-of-scope or P3 finding id from docs/findings.json, file a
  GitHub issue for future resolution, dedup against existing open issues, append
  to docs/issues-filed.json, and label with deferred-from-loop. Refuses P1
  findings. Operates on exactly one finding per invocation.
inputs:
  finding_id: "the id of the finding to defer, e.g. fnd-security-sentinel-001"
  findings_file: "docs/findings.json — produced by review-fanout; skill reads a single entry by id"
  workflow_id: "the current workflow id; used to construct the deferral reason in the issue body"
outputs:
  issue_record: "docs/issues-filed.json — the finding's GitHub issue URL is appended to this array"
substrate_access:
  pattern: none
---

## Summary

Triggered after Gate B triage routes a finding to deferral: out-of-scope P2s and all P3s. Reads the single finding by id from `docs/findings.json` — does not iterate the array. Refuses P1 findings (which are merge blockers, not deferral candidates). Runs a dedup check against open `deferred-from-loop` issues before creating a new one. Files the issue with an actionable title, distilled body, and correct labels. Appends to `docs/issues-filed.json` whether the URL came from a new or pre-existing issue. Operates on exactly one finding per invocation; parallelism comes from running multiple instances against independent findings.

## Procedure

### Step 1 — Read and validate the finding

Read `docs/findings.json`. Locate the entry whose `id` matches the provided `finding_id`. Do not iterate every finding — read the file once and extract the single matching entry.

If no entry with the given `finding_id` exists, stop immediately and output:

```
Cannot defer: finding '<finding_id>' not found in docs/findings.json.
Verify the id and re-run, or check that review-fanout has been run for this workflow.
```

If the found entry has `priority: P1`, stop immediately and output:

```
Refused: finding '<finding_id>' is priority P1.
P1 findings are merge blockers and must be resolved, not deferred.
Route this finding to resolve-finding instead.
```

Do not modify any files. Do not proceed.

Record these fields from the finding for use in subsequent steps:

- `id`
- `priority`
- `in_scope`
- `reviewer`
- `title`
- `description`
- `location` (optional)
- `reproducer` (optional)
- `suggested_fix` (optional)

### Step 2 — Dedup check

Before creating an issue, search for an existing open GitHub issue that already covers this finding.

```bash
gh issue list --label "deferred-from-loop" --search "<short keyword from finding title>" --state open --json number,title,url,body
```

Scan the returned issues. A match is a finding whose title and description address the same root cause in the same location — not just surface keyword overlap. Use judgment: if the candidate issue clearly covers the same problem, it is a match. If uncertain, do not treat it as a match — create a new issue.

**If a clearly matching open issue exists:**

Append to `docs/issues-filed.json`:

```json
{ "finding_id": "<finding_id>", "url": "<existing-issue-url>", "filed_at": "<ISO-8601 datetime>", "dedup": true }
```

Output:

```
Deferred (dedup): <finding_id>
  Matched existing issue: <existing-issue-url>
  No new issue created.
  Recorded in docs/issues-filed.json.
```

Stop. Do not create a new issue.

**If no matching issue exists:** continue to Step 3.

### Step 3 — Create the GitHub issue

Create an issue with `gh issue create`. Do not leave blank labels or omit required fields.

**Title:** Rewrite the finding title to be actionable and reader-friendly. Drop reviewer jargon and internal ids. Format: imperative verb + concrete subject. Example: `finding: "Missing index on notification.user_id"` → issue: `"Add database index on notifications.user_id for read query performance"`.

**Body:** Include all five of the following sections in this order:

1. **Summary** (one paragraph): what the problem is, where it lives, and why it matters. Distill the finding description; do not copy it verbatim.
2. **Location**: the `location.path` (and line range if present). If no location, write "Location: not location-bound."
3. **Context**: reviewer that found it (`reviewer` field) and the workflow it came from (`workflow_id` input). Example: `Found by: security-sentinel | Workflow: add-email-notifications-mention`.
4. **Deferral reason**: one of "Out of scope for workflow `<workflow_id>`" (for out-of-scope P2s) or "P3 — lower-priority improvement" (for P3s). Do not embellish.
5. **Reproducer** (if available): paste or summarize `finding.reproducer`. If absent, omit the section entirely — do not write "Reproducer: N/A".

**Labels:** Apply all of the following:
- Map the reviewer's `category` to a matching label (`security`, `performance`, `architecture`, `quality`, or the closest match). Run `gh label list` if uncertain whether the label exists; do not invent labels.
- `deferred-from-loop` — required; this is how `harvest` finds deferred items later.
- `priority:P2` or `priority:P3` — matching the finding's priority.

**Assignees:** Assign to the repo's owner or team lead per project conventions. For this repo, assign to `jdforsythe`.

Capture the URL of the created issue.

### Step 4 — Record the URL

Append to `docs/issues-filed.json`. The file is a JSON array. Read it in full, append one new entry, and write it back:

```json
{ "finding_id": "<finding_id>", "url": "<gh-issue-url>", "filed_at": "<ISO-8601 datetime>", "dedup": false, "labels_applied": ["<label1>", "<label2>"] }
```

If `docs/issues-filed.json` does not exist, create it as an empty array `[]` before appending.

### Step 5 — Confirm to the user

Output a confirmation:

```
Deferred: <finding_id> (<priority>)
  Title:    <issue title>
  Issue:    <gh-issue-url>
  Labels:   <comma-separated list>
  Recorded in docs/issues-filed.json.
```

## Constraints

- **One finding per invocation.** Never iterate `docs/findings.json` to defer multiple findings. Each invocation targets exactly one `finding_id`.
- **Refuse P1 findings.** If `priority: P1`, stop at Step 1 without creating any issue.
- **Dedup before creating.** Always run the dedup check in Step 2. Creating a duplicate issue is the primary failure mode.
- **Actionable title.** The rewritten title must use an imperative verb and name a concrete subject. Do not copy the finding's raw title.
- **Distilled body.** Issue bodies are for triage — write to be scanned in seconds. Do not paraphrase the finding verbatim or pad with reviewer metadata.
- **Required label: `deferred-from-loop`.** This label is how `harvest` detects recurring deferral categories. It must be present on every issued filed by this skill.
- **Never modify `docs/findings.json`.** The findings file is the output of `review-fanout` and is read-only from the perspective of this skill.
- **`docs/issues-filed.json` is a JSON array.** Read-append-write atomically; never truncate or overwrite with only the new entry.
- **Never file P1 findings as issues.** P1 findings that reach this skill indicate a filter error upstream. Refuse and report; do not silently downgrade to P2.
