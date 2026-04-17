---
description: Report back to the team-lead with a structured summary
---

# Report back

Arguments: `$ARGUMENTS` — a one-line headline for what you're reporting. Write the full body of the report as your next Claude Code reply after invocation.

## Why this has two paths

Tentacles run in one of two backends, and the report path differs between them:

- **tmux-backed tentacles** (full Claude Code session in a tmux pane) have `SendMessage` available and can deliver reports into the team-lead's inbox.
- **Agent-backed subagents** (spawned via the `Agent` tool, e.g. the `tentacle` subagent type) do **not** have `SendMessage`. Their only channel back to the parent session is their final assistant message, which the `Agent` tool surfaces verbatim.

If `/report` blindly calls `SendMessage` without checking, an Agent-backed subagent silently drops the report. If it prints "Reported: ..." locally without having actually sent anything, the acknowledgement is a lie. Both are bugs. Follow the steps below.

## Steps

1. **Assemble the structured summary** (you'll need it either way):
   - What you did (1-3 bullets)
   - PR link (if any) — inline, not as a separate bullet
   - What's unresolved or blocked
   - Decision points that need the user's call
   - Anything you cut vs. what was briefed, and why

2. **Check whether `SendMessage` is available.** The cheapest way is to attempt the call and catch failure. You can also use `ToolSearch` with `select:SendMessage` to confirm the schema is loaded before calling. Treat "tool not found" / "unknown tool" / `InputValidationError` on an unloaded schema as "not available."

3. **Route based on availability:**

   - **If `SendMessage` is available (tmux-backed):**
     - Call `SendMessage` to recipient `team-lead` with the structured summary from step 1.
     - Only after the send succeeds, acknowledge locally with exactly: `Reported to team-lead: <headline>.`
     - If the send fails, do **not** print the "Reported" acknowledgement. Fall through to the Agent-backed path below and say the send failed.

   - **If `SendMessage` is not available (Agent-backed subagent):**
     - Emit the full structured summary from step 1 as your **final assistant message** for this turn. The `Agent` tool surfaces this message verbatim to the parent session — that *is* the report delivery.
     - In the same final message, include a short tail line: `No inbox available (Agent-backed subagent); full report returned above.`
     - Do **not** print `Reported to team-lead: ...` — nothing was sent to an inbox.

## Invariants

- Never print `Reported to team-lead: ...` unless a `SendMessage` call actually succeeded.
- Never silently drop a report. If you can't send, surface the report in your final assistant message so the parent session can see it.
- Failure is loud. Prefer an explicit "send failed, here is the report inline" over a misleading success acknowledgement.

## Report contract

Each tentacle's spawn brief can include a **Report contract** section that specifies:
- Expected report shape (fixed bullet list with known fields vs. free-form)
- Any additional reporting steps (e.g., persisting to an external system)

If the brief doesn't specify, default to: structured summary, routed by the rules above.
