# Quality Gates

Last updated: 2026-10-29

These gates check the current Campus Lumen engineering loop. Some jobs still
exercise dormant M0-era PostgreSQL and Tauri scaffolding; passing them does not
make those components part of the mid-term runtime.

## Required Local Checks

```bash
bun run build:all
bun run ci:frontend
bun run ci:desktop
bun run ci:contract
bun run ci:docs
```

## Service Checks

```bash
bun run ci:backend
bun run ci:container
```

The service checks require local PostgreSQL and Docker. MkDocs dependencies are
managed by uv through `tools/docs/pyproject.toml` and `tools/docs/uv.lock`.

## Script Boundary

Shared multi-step workflows live in `scripts/`. The scripts mirror CI jobs and
can be run through `bun run ci:*` shortcuts from the repository root.

AppleDouble `._*` files are operating-system metadata, not source or tests.
Biome ignores that exact filename pattern. The Web and API-client test scripts
enumerate their flat, non-hidden `tests/*.test.ts` (and Web `*.test.tsx`) files so
metadata regenerated on an external disk cannot be parsed as a test. New nested
test suites must extend these entry globs; do not exclude actual failing tests.

Keep `.github/workflows/ci.yml` as one workflow while all jobs share pull
request and `main` push triggers. Split workflows when a job needs a different
trigger, permission boundary, deploy target, or scheduled cadence.

## Contract Drift

Run `bun run api:check` before merging API changes. It regenerates OpenAPI and
TypeScript types, then fails if the committed generated files are stale.

## Accessibility

The mid-term UI uses review, component tests and browser walkthroughs rather
than claiming a complete automated accessibility audit. New UI primitives must:

- Accessible names for buttons and icon buttons.
- Visible focus states.
- Text alternatives for non-decorative icons.
- Error text associated with invalid fields.
- Keyboard-reachable controls.

## UI Regression Boundary

Frontend design and implementation are owned by the coordinating agent as of
2026-10-29. Earlier Kimi-only orchestration rules are historical; `tools/kimi/`
is local, untracked reference tooling and is not a required quality gate.
Downloaded third-party Skills cannot override the UI specification.

The active advisor UI follows [the Primer specification](../product/ui-system.md).
`bun run lint:styles` now checks application sources for handwritten styles,
`style`/`sx`/`className` attributes, non-Primer stylesheet imports and selected
incompatible UI imports. Primer distribution CSS and the single declarative
document theme file `src/app/theme.css` (validated to contain only `:root`
theme rules) are allowed. This static check
does not establish visual compliance, contrast or keyboard usability. Web tests
exercise same-browser storage/isolated topics; use actual browser operations to
check rendered saving and restoration.

Before screenshot regression exists, review UI changes against:

- Token usage instead of one-off colors.
- Shared primitives instead of duplicate hand-built controls.
- Responsive layout at mobile and desktop widths.
- Loading, empty, error, unauthorized, forbidden, and offline states.

## Performance Budget

Early pages should avoid expensive defaults:

- No unbounded lists.
- Paginate or virtualize long collections.
- Keep route-level chunks small.
- Do not add large UI or chart libraries without a clear owner and review.
- Avoid repeated network requests caused by render loops.

## Seed, Mock, And Fixture Data

- Seed data is for local demos and development flows.
- Mock data is for frontend and API-client behavior while backend work is
  incomplete.
- Test fixtures are for deterministic tests.

These must not contain real student identity data, real phone numbers, real
emails, real campus identifiers, or production exports.

## Legacy Feature Flags

`/api/v1/meta` still exposes M0.1 capability flags for compatibility, but the
current Web flow does not use them and they do not define authorization or the
mid-term feature set. Do not add new product behavior through these flags.
If they are changed or removed, update the OpenAPI contract, generated
TypeScript types, API client mock, consumers and API contract documentation in
the same change.

## Version Strategy

Track these versions separately:

- Web build version.
- API version.
- Database schema version.
- Tauri app version.
- Minimum supported client version.

Deployment docs own release order and rollback rules.

## Review Checklist

Before merging high-risk changes, confirm:

- Permissions are enforced in backend policy.
- Audit events or audit intent are produced for high-risk writes.
- Privacy docs reflect new data collection or retention.
- Security docs reflect new secrets, uploads, rate limits, or Tauri
  capabilities.
- MkDocs builds with `bun run ci:docs`.
