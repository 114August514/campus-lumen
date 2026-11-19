# Contributing

Last updated: 2026-10-29

Keep changes scoped to the active milestone and use a short-lived branch from the current integration base. Do not rewrite shared history, delete branches/worktrees, merge a PR, or push on another contributor's behalf without the user's decision.

## Workflow

1. Read `AGENTS.md`, the active requirement/design document, and nearby code before editing.
2. Keep one coherent concern per branch or PR. Describe user-visible behavior, privacy/data changes, source limitations, and migration impact.
3. Update OpenAPI/generated types for API changes and the owning formal docs for requirement, architecture, privacy, security, or operational changes.
4. Open a PR; preserve review findings and CI evidence. Merging, branch deletion, and worktree cleanup require the user's decision.
5. Use `docs/ai-log/` for concise task handoff facts. Never copy private student text, credentials, auth screens, or raw conversation logs into it.

The active frontend uses Primer and the rules in `docs/product/ui-system.md`. All opportunity types share the same 探索 → 发现 → 处理 flow. Simulated content and services must be visibly labelled; never invent facts about real people or opportunities.

Before submitting changes, run the checks that match the files touched:

```bash
bun run ci:frontend
bun run ci:backend
bun run ci:contract
bun run ci:docs
```

Desktop or container changes additionally require `bun run ci:desktop` or `bun run ci:container`. API changes require `bun run api:check`.

Do not commit local secrets, `.env` files, generated logs, database dumps, ignored work files, or local `tools/kimi/` content. Check this guide against the active milestone whenever repository workflow changes; freshness date: 2026-10-29.
