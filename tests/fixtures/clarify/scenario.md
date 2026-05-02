# clarify fixture

Pressure-test specification document. Defines the scenario, expected output properties, and sample bad output used to verify that an agent following the `clarify` procedure behaves measurably better than an agent without the skill.

The fixture is fixed. When a scenario fails the differential check, edit the SKILL.md procedure — not this document.

---

## Scenario — "I want to build a notification system"

**User prompt:**

> I want to build a notification system for our app.

**Substrate state (available at start):**

`.substrate/vocabulary/INDEX.md`:

```
# Vocabulary index

| ID | Description | Path |
|---|---|---|
| workspace | A user's isolated tenant boundary; each workspace has its own member list and settings. | ./workspace.md |
| groove-workflow | A single end-to-end feature cycle: clarify → research → plan → build → review → harvest. | ./groove-workflow.md |
```

`.substrate/adr/INDEX.md`:

```
# ADR index

| ID | Description | Status | Path |
|---|---|---|---|
| email-delivery-provider | Decision to use SendGrid as the transactional email provider. | accepted | ./email-delivery-provider.md |
| event-bus-pattern | Decision to use an internal event bus (not direct service calls) for cross-service side effects. | accepted | ./event-bus-pattern.md |
```

**Codebase state (hypothetical, explorable by the agent):**

- `src/users/` — user management module; contains `user.model.ts` with `email`, `phone`, `preferences` fields
- `src/events/` — event bus implementation; `EventBus` class with `publish()` and `subscribe()` methods
- `src/notifications/` — empty directory (not yet implemented)
- No existing notification preferences or delivery logic exists

---

## Expected output properties (with-skill behavior)

An agent following the `clarify` skill must exhibit ALL of the following properties:

1. **Eager index load**: Before asking the first question, reads both `.substrate/vocabulary/INDEX.md` and `.substrate/adr/INDEX.md`. Does not open any entry body files unless a description is ambiguous relative to a specific question.

2. **One question at a time**: Each agent turn contains exactly one question. The agent does not bundle two questions (e.g., "What types of notifications? And do you want email or push?") in a single response.

3. **Codebase exploration before asking**: For questions whose answers may be derivable from the codebase, the agent explores the codebase first and either answers the question itself or incorporates the finding into a more targeted question. Example: before asking "do you want to use email or push notifications?", the agent checks `src/users/user.model.ts` and finds the `email` field — this finding shapes the next question toward delivery channel coverage rather than existence.

4. **ADR awareness**: Questions reflect knowledge from the substrate indexes. Example: given the `event-bus-pattern` ADR, the agent does not ask "how should notifications be triggered?" as an open-ended question — instead it asks a more targeted question about whether the existing event bus should be used.

5. **Progressive resolution**: Each question resolves a distinct uncertainty. The agent does not repeat a topic already answered.

6. **Terminates with a brainstorm doc**: After enough questions are answered (typically 4–6 turns), the agent writes `docs/brainstorms/<id>.md` with valid workflow-doc frontmatter (`id`, `type: brainstorm`, `description` ≤200 chars, `created`, `workflow_id`) and opens the body with a `## Summary` block of ≤5 lines. The `## Summary` synthesizes the resolved answers.

### Example of compliant first-turn output (with-skill)

> After scanning the substrate indexes: the project uses SendGrid for email (`email-delivery-provider` ADR) and an internal event bus for cross-service effects (`event-bus-pattern` ADR). Let me start with scope.
>
> Who are the recipients of these notifications — workspace members only, or can external parties (e.g. invited guests, external collaborators) receive them?

This turn: loaded indexes, referenced ADR knowledge, asked exactly one targeted question.

---

## Sample bad output (without-skill behavior)

An agent **without** the `clarify` skill typically exhibits one or more of the following failure modes when given the same prompt:

### Bad output example A — jumps to recommendations

> Great! Here's how I'd approach a notification system:
>
> 1. **Email notifications** using SendGrid (you already have that set up)
> 2. **In-app notifications** using a websocket or polling approach
> 3. **Push notifications** for mobile clients if needed
>
> You'll want a `notifications` table to store delivery status, an event listener for triggers, and a worker queue for async delivery. Want me to start with the data model or the delivery service?

Failure modes present:
- No substrate index load before responding
- Jumps to architecture recommendations without resolving scope
- Bundles multiple options rather than asking one question to resolve the most important uncertainty
- Does not explore the codebase to see what already exists

### Bad output example B — asks multiple questions at once

> Before I start, I have a few questions:
>
> 1. What types of notifications do you need — email, in-app, push, or SMS?
> 2. Who are the recipients — just users, or also workspace owners and guests?
> 3. Should notifications be triggered by user actions, system events, or both?
> 4. Do you have a delivery provider in mind, or should we evaluate options?

Failure modes present:
- No substrate index load
- Asks four questions in one turn instead of one
- Does not explore the codebase before asking about delivery provider (SendGrid ADR already answers this)

---

## Differential check criteria

Run a subagent with the `clarify` skill loaded against the scenario prompt above. Run the same subagent without the skill. Compare outputs using these binary criteria:

| Criterion | With-skill | Without-skill |
|---|---|---|
| Reads substrate indexes before first question | yes | no |
| First turn contains exactly one question | yes | no (typically 3–5 questions, or no question at all) |
| First question reflects ADR or vocab knowledge | yes | no |
| Agent explores codebase before asking about existing infrastructure | yes | rarely |
| Final output is a `docs/brainstorms/<id>.md` with valid frontmatter | yes | no (typically an ad-hoc plan or bulleted list) |

The skill passes the differential check when the with-skill run satisfies all five criteria and the without-skill run fails at least three of them.
