---
description: Report back to the team-lead with a structured summary
---

# Report back

Arguments: `$ARGUMENTS` — a one-line headline for what you're reporting. Write the full body of the report as your next Claude Code reply after invocation.

When this runs:

1. **SendMessage to `team-lead`** with a structured summary containing:
   - What you did (1-3 bullets)
   - PR link (if any) — inline, not as a separate bullet
   - What's unresolved or blocked
   - Decision points that need the user's call
   - Anything you cut vs. what was briefed, and why

2. Acknowledge briefly to the local pane: `Reported: <headline>.`

## Report contract

Each tentacle's spawn brief can include a **Report contract** section that specifies:
- Expected report shape (fixed bullet list with known fields vs. free-form)
- Any additional reporting steps (e.g., persisting to an external system)

If the brief doesn't specify, default to: SendMessage-only, structured summary.
