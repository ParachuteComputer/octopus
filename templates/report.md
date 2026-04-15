---
description: Report back to the team-lead with a structured summary, optionally persisting to vault
---

# Report back

Arguments: `$ARGUMENTS` — a one-line headline for what you're reporting. Write the full body of the report as your next Claude Code reply after invocation.

When this runs:

1. **SendMessage to `team-lead`** with a structured summary containing:
   - What you did (1-3 bullets)
   - PR link (if any) — inline, not as a separate bullet
   - What's unresolved or blocked
   - Decision points that need Aaron's call
   - Anything you cut vs. what was briefed, and why

2. **If your spawn brief specified "persist to vault on report"**, either update a recent handoff note or create a new one — aim for one ongoing handoff per tentacle per day/session, not a fresh note every report:

   - First, `query-notes` for recent notes tagged `uni/handoff` (or the brief's override tag) whose title or content references your tentacle name. Sort desc, limit a handful, use `include_metadata: ["summary"]` with `include_content: false` to scan cheaply.
   - **If a matching recent note exists** (same day, or the most recent one for your tentacle): `update-note` to append today's report as a new `## <HH:MM> — <headline>` section at the bottom. Refresh `metadata.summary` if the through-line shifted.
   - **Otherwise**: `create-note` at `Uni/Handoffs/<YYYY-MM-DD>-<your-name>-<slug>` with tag `uni/handoff` (or the override), the structured summary as the body, and a `metadata.summary` of 1-2 sentences.

   Skip this step entirely if your brief didn't ask for it.

3. **If your spawn brief specified "ping Aaron via Telegram"**, also send a short reply via the `parachute-channel` reply tool. Use `reply_to` if the brief references a specific Telegram message.

4. Acknowledge briefly to the local pane: `Reported: <headline>.`

## Report contract

Each tentacle's spawn brief should include a **Report contract** section that specifies:
- Expected report shape (fixed bullet list with known fields vs. free-form)
- Whether to persist to vault (yes/no + tag override if not `uni/handoff`)
- Whether to ping Aaron via Telegram in addition to team-lead message

If the brief doesn't specify, default to: SendMessage-only, structured summary, no vault, no Telegram.
