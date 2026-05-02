---
name: clarify
description: >-
  Resolve a feature idea into a brainstorm doc through a relentless one-question-at-a-time
  grilling loop. Eagerly loads vocab and ADR indexes; explores the codebase before asking
  questions whose answers are derivable from code. Fires at workflow start.
inputs:
  feature_idea: "free-text user statement of intent (e.g. 'I want to build X')"
outputs:
  brainstorm_doc: "docs/brainstorms/<id>.md — workflow-doc frontmatter + ## Summary block (≤5 lines)"
substrate_access:
  pattern: eager
  reads:
    - .substrate/vocabulary/INDEX.md
    - .substrate/adr/INDEX.md
  on_demand: entry body files for vocabulary or ADR entries, fetched only when an index description is ambiguous relative to the current question
---

## Summary

Triggered by any feature-workflow start ("I want to build X"). Eagerly loads the vocabulary and ADR indexes at session start — index layer only. Asks exactly one question per turn, chosen to resolve the most important open uncertainty. Before asking a question whose answer may be in the codebase, explores the code and either answers it or sharpens the follow-up. Continues until a brainstorm doc can be written. Produces `docs/brainstorms/<id>.md` with valid workflow-doc frontmatter and a `## Summary` block of ≤5 lines.

## Procedure

### Step 1 — Load substrate indexes (eager, before first question)

Before saying anything else, read:

- `.substrate/vocabulary/INDEX.md`
- `.substrate/adr/INDEX.md`

Read the index layer only — do not open any entry body files. If an index description is ambiguous relative to the feature idea, open that entry's body (via `substrate-read`) to resolve the ambiguity. Record what the indexes reveal: known terms, accepted decisions, and any constraints directly relevant to the stated idea.

### Step 2 — Identify the most important open uncertainty

Before composing a question, enumerate the categories of uncertainty that typically gate a brainstorm:

1. **Recipients / scope** — Who is affected? Which users, roles, or external parties?
2. **Trigger / cause** — What event or action initiates the feature?
3. **Delivery / mechanism** — How does the outcome reach the recipient?
4. **Persistence / state** — What state must survive the interaction?
5. **Constraints / integration** — What existing decisions constrain the design?

Select the single uncertainty that, if left unresolved, would block all other reasoning. That is the topic of the next question.

**Substrate check before selecting:** If the indexes already resolve one of these categories (e.g., an ADR commits to a delivery mechanism), mark that category as resolved and skip it.

### Step 3 — Explore the codebase before asking (when applicable)

If the chosen uncertainty might be answered by existing code, explore the codebase first:

- Look for relevant modules, models, and interfaces related to the topic.
- Look for existing infrastructure (event buses, queues, delivery clients, auth middleware) that constrains the design.
- Look for data models that reveal implicit scope (e.g., `user.model.ts` with `email` and `phone` fields implies delivery channel options already exist).

If exploration resolves the uncertainty: do not ask the question. Instead, state what you found and select the next uncertainty.

If exploration narrows the uncertainty: incorporate the finding into a more targeted question. Do not ask "should we use X or Y?" when the codebase already uses X.

### Step 4 — Ask exactly one question

Compose a single question that resolves the chosen uncertainty. The question must be:

- **One question only.** Do not bundle sub-questions. Do not offer a numbered list of questions.
- **Targeted.** Reflect what you found in Steps 1–3. Do not ask about things already resolved by substrate or codebase.
- **Open-ended enough** to reveal unexpected constraints the user holds. Avoid yes/no questions unless the topic genuinely reduces to a binary.

Before the question, state briefly what you learned from the substrate indexes or codebase exploration that motivates asking this particular question. Keep this framing to 1–2 sentences.

### Step 5 — Process the answer and repeat

After the user answers:

1. Mark the resolved uncertainty as settled.
2. Return to Step 2 to identify the next most important open uncertainty.
3. Repeat Steps 2–4 until the brainstorm is ready to write (see Step 6).

Do not revisit a settled topic unless the user's later answer contradicts an earlier one.

### Step 6 — Decide when to stop grilling

Stop when you can answer all of the following from resolved uncertainties:

- Who is affected?
- What triggers the feature?
- What is the delivery or outcome mechanism?
- What constraints or prior decisions govern the design?
- What is explicitly out of scope for this workflow?

Typically requires 4–6 questions. Do not stop early just because you could write a plausible document — stop only when the above questions are genuinely settled. Do not continue beyond 8 questions; if uncertainty remains after 8 turns, write the brainstorm with explicit "open question" callouts in the body.

### Step 7 — Write the brainstorm doc

Create `docs/brainstorms/` if it does not exist. Choose a `workflow_id` for this brainstorm using the workflow-id convention: strip articles from the feature idea, take the first 4–6 content words in kebab-case (e.g. "add notification system workspace members" → `add-notification-system-workspace-members`). The `id` field uses the same value.

Write `docs/brainstorms/<workflow_id>.md` with this structure:

```markdown
---
id: <workflow_id>
type: brainstorm
description: <one-line summary of the feature, ≤200 chars>
created: <YYYY-MM-DD>
workflow_id: <workflow_id>
---

## Summary

<≤5 lines synthesizing the resolved answers: who is affected, what triggers it, how it works, key constraints>

## Scope

<paragraph: what this feature covers and who it serves>

## Trigger

<paragraph: what initiates the feature>

## Mechanism

<paragraph: how the outcome is delivered or achieved; reference any relevant ADRs or existing infrastructure>

## Constraints

<bullet list: prior decisions, existing patterns, or technical limits that govern the design>

## Out of scope

<bullet list: explicit exclusions established during the grilling session>

## Open questions

<bullet list: any uncertainties not resolved during the session; omit section if empty>
```

After writing the file, confirm the path to the user and state that the brainstorm is ready for the `research` phase.

## Constraints

- Never ask more than one question per turn.
- Never ask about a topic already resolved by a substrate index entry or by codebase exploration.
- Never write the brainstorm doc before all five categories in Step 6 are settled (or explicitly called out as open questions after 8 turns).
- The `description` field in the brainstorm frontmatter must be ≤200 characters.
- The `## Summary` block must be ≤5 non-blank lines.
- The `workflow_id` and `id` fields must match and conform to the workflow-id convention (kebab-case, `[a-z0-9-]`, max 50 chars).
