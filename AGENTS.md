# Agent Notes

Last updated: 2026-11-20

Instructions for AI agents and collaborators on this repository. It holds the
current rules only; how they came about is in `docs/ai-log/done.md` and Git history.

## Project

**Campus Lumen** (renamed from Campus Agora on 2026-10-22) helps university
students discover research, internship, competition, exchange and other
opportunities across institutions, understand the actual tasks and conditions,
and decide their own next step. It is a personal-use web tool, first for USTC
students; community features are not in scope.

- Requirements baseline: `docs/product/requirements-handoff.md`; product decisions:
  `docs/product/overview.md`; software-engineering docs: `docs/project/index.md`.
- Pending work: [GitHub Issues](https://github.com/114August514/campus-lumen/issues).
- Status: the mid-term demo (PR #21) is merged; the next phase is chosen from the
  issues. No student trial has run yet (#32), so student benefit is unmeasured.

## Product Decisions

Confirmed by the user; follow them unless the user changes them.

- Every opportunity type uses one flow: 探索 → 发现 → 处理. Advisor selection has
  the deepest content; other types use curated entry data (whether to deepen them: #37).
- Users keep several exploration topics; browsing does not require creating one.
  Public information is shared across topics; private reasons, questions and
  decisions stay in their own topic (browser `localStorage`, same origin only).
- Every fact shows its source and when it was collected, and labels say whether
  it was read just now, prepared earlier or simulated. Unknown stays unknown and
  is never read as negative; conflicting sources stay side by side; historical
  recruitment is shown as historical, not as currently open.
- Private topic records stay in the browser. Discovery sends only the query text;
  no model or tool receives private content except fragments the user ticks for
  AI organization.
- Discovery runs can be stopped and have declared limits; results that arrived
  are kept and late ones are dropped. A mistaken merge can be split; each private
  record follows its own saved sources or waits for the user's choice.
- No scores, rankings or verdicts on people. Knowledgeable-participant contacts
  appear only when published for that purpose or shared with consent, with
  relationship and period. The product never contacts anyone on the user's behalf.
- Help is optional: browsing or saving is not a commitment, pausing or declining
  needs no reason, and there is no grade pressure, deficit checklist, social
  comparison or unsolicited reminder. Official obligations are kept apart from
  suggestions. Success means clearer decisions and resolved tasks, not activity
  volume. Motives (fun, recognition, learning, career) can coexist and are not
  ranked, inferred or asked for; prizes, 综测 and credits/GPA follow their own rules.
- Depth: discovery, understanding and comparison are the core; preparation
  guidance and resource entry points appear on demand, and a simple lookup can
  end at the entry link. Teaching concepts, grading exercises or testing learning
  are out of scope.
- AI organization: the labelled simulated service is the default; USTC 词元计划 is
  chosen per send through a server-held key. Only content the user ticked in the
  confirm dialog is sent, and delivery state is shown truthfully (after a
  timeout: "may have been sent").
- Collection (2026-11-19): the team may sign in to 小红书, BOSS 直聘, LinkedIn,
  B站 and similar platforms to collect material. Collection is read-only: no
  posting, commenting, following, messaging or outreach. Login state stays in the
  collecting tool and never enters the repository, batches, logs or screenshots.
  Items keep source, collection time and reading scope and pass batch review
  (`bun run discovery:validate`) before entering app data. The student-facing
  service reads only public pages and never uses students' platform accounts.
  Supply is automated collection with team review of key claims, exceptions and
  corrections. Tool and account: #40; workflow: `tools/skills/opportunity-discovery/SKILL.md`.
- Research: reuse existing evidence; open a research issue only when its result
  would change a concrete decision.

## UI Rules

Details in `docs/product/ui-system.md`.

- Only Primer React, Primer Primitives and Octicons. No Tailwind, handwritten
  component CSS or CSS Modules, inline `style`, `sx` or CSS-in-JS. The only CSS
  file is the theme mapping `apps/web/src/app/theme.css`; `bun run lint:styles`
  enforces this.
- PR #15 is the visual baseline: open-compass brand mark, Primer light/dark
  toggle (light by default), Primer blue interaction, system sans-serif, normal
  letter spacing.
- No emoji icons, eyebrows, subtitles or taglines, gradients, bordered content
  cards, display monospace or tracking. Keep field borders and visible keyboard focus.
- Other products can inform interaction patterns; they don't override these rules.

## Commands

```bash
bun install
bun run dev:api                    # Rust API on 127.0.0.1:8080
bun run dev:web                    # http://127.0.0.1:5173 (always this origin: topics live in its localStorage)
cd apps/web && bun test ./tests/compare.test.ts   # one test file
bun run ci:frontend                # typecheck, lint, lint:styles, tests, build
bun run api:types                  # after API changes; `bun run api:check` must show no drift
UV_PROJECT_ENVIRONMENT=/tmp/campus-lumen-docs-venv UV_CACHE_DIR=/tmp/campus-lumen-uv-cache bun run ci:docs   # strict MkDocs
bun run ci:backend                 # fmt, check, clippy, test, then sqlx migrations (needs DATABASE_URL and Postgres);
                                   # without a database run `cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
```

词元计划 is enabled when `USTC_LLM_API_KEY` is set in the shell that starts the API
(optional `USTC_LLM_MODEL`, default `deepseek-v4-flash-ascend`; student keys get
403 for `deepseek-v4-pro`).

## Gotchas

- The old name survives on purpose: crates are `campus_agora_*`, the topic store
  key is `campus-agora:explorations:v1`. Renaming them breaks builds or saved data.
- The community-era code (`crates/db` migrations, `crates/domain`, the
  `apps/desktop` Tauri shell) is dormant but still built in CI. Don't extend it; #34
  decides what to delete.
- Keyword discovery through DuckDuckGo often hits a verification page; direct
  reads of known official pages work (#24).
- `main` requires a PR and allows only squash or rebase; merged branches are
  deleted automatically. `gh pr merge --match-head-commit` needs the full SHA.
  `gh` calls sometimes fail with a GraphQL EOF: retry, then re-read the state.
- CI runs six jobs on every PR: frontend, backend, desktop, contract, docs, container.

## Workflow

- Tickets (user decision 2026-11-19): pending work lives in GitHub Issues; follow
  `CONTRIBUTING.md`. Agents may take `agent-ok` issues, work on
  `<type>/<number>-<slug>` branches (one worktree each when parallel), and merge
  their own PR once all six CI jobs pass, a reviewer that did not implement the
  change reports no blocking problem, and every human step in the issue's
  acceptance criteria is recorded as done. Changes to stored data shape, the
  OpenAPI contract, privacy boundaries, costs, or code deletion need the user's
  confirmation of a plan in the issue first.
- Pace (user preference 2026-10-03): small, clear changes go straight to
  implementation and checks; research or design comes first only when an unknown
  blocks the result. Stay within the issue: no dependencies, runtime behavior or
  doc structure it doesn't need. Decide routine reversible details yourself; run,
  observe and fix until the result is verified. Review and extra tests follow the
  risk, not every change. Report the checks you actually ran.
- Before changing a product, frontend, backend, API, operations, desktop or
  monorepo boundary, read the matching reference in `docs/constraints/index.md`.
- When docs and code disagree, code, scripts, contracts and CI win; fix the doc.
  Update the docs that describe changed behavior, commands or decisions in the
  same PR, and bump their `Last updated:` line (not for typo fixes).
- Scratch notes, drafts and screenshots go to `work/YYYY-MM-DD-task/`
  (git-ignored except `work/README.md`; source never depends on it). Durable
  reference notes go to `docs/constraints/` and its `index.md`, not the
  repository root; a note that becomes a rule moves into the formal doc.
- AI log: completed facts go to `docs/ai-log/done.md` (what changed, files or
  commits, checks run, decisions). `docs/ai-log/todo.md` only holds handoff notes
  for issues in progress (issue, branch, state, next step, blockers).
- Never put secrets, keys, cookies, login state, private callback URLs, student
  identity data, database dumps or raw unredacted logs in the repository, `work/`
  or the AI log.
- When the same mistake happens twice, add a short rule here in the same PR.
