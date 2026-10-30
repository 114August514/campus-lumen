# API Contracts

Last updated: 2026-10-28

Campus Lumen uses `contracts/openapi.json` as the committed API contract
snapshot. The Rust API crate is the source of this contract.

After the 2026-10-22 project rename, metadata `appName` is `Campus Lumen` and
the OpenAPI title is `Campus Lumen API`. Regenerate both contract snapshots
from the Rust source. Endpoint paths, internal crate/package names and browser
storage identifiers retain compatibility.

## Generate

```bash
bun run api:types
```

This command exports OpenAPI from `crates/api` and regenerates
`packages/api-client/src/generated.ts`.

## Check

```bash
bun run api:check
```

CI runs this command to ensure generated files were committed. If it fails,
regenerate the contract and review the diff before committing.

## Rules

- Public endpoints must explicitly use `security: []` in the OpenAPI document.
- Business endpoints live under `/api/v1`.
- `/healthz`, `/readyz`, and OpenAPI tooling stay outside `/api/v1`.
- Errors use flat `ApiErrorResponse` fields:

  ```json
  {
    "code": "validation_failed",
    "message": "The request is invalid.",
    "requestId": "req_abc123",
    "details": {}
  }
  ```

  `details` is optional and must stay structured when present.

- Error codes use stable `snake_case` names.
- Frontend code imports API types through `@campus-agora/api-client`, not by
  reaching into generated internals.

## Live Discovery

`POST /api/v1/discoveries` is public (`security: []`). Its JSON body contains
only `query`, a nonempty public query of at most 200 characters. It accepts
either keywords or a single public HTTP(S) academic/supported recruitment URL, subject to the same
host-and-path restrictions as search results. Exact opportunity destinations are
listed in [Security](../operations/security.md#public-discovery-boundary); redirects,
private-address checks and run bounds apply to every new host as well. There is no separate URL field and no
browser-private reasons/preferences in the request.

```json
{"query": "机器学习"}
```

The generated `DiscoveryResponse` contains `query`, `provider`, `scope`,
`status`, `collectedAt`, `sources`, and `warnings`:

- `provider` is `duckduckgo_html`, `official_directory`, or `direct_url`.
  `official_directory` means
  search failed and the service performed live body matching against only
  Stanford AI Laboratory faculty and CMU Machine Learning core faculty.
  `direct_url` reads only the submitted page without sending the URL to
  DuckDuckGo or falling back to another source when reading fails.
  `scope` describes the actual range in Chinese.
- HTTP 200 represents a completed attempt; `status` is `complete`, `partial`,
  or `failed`, so HTTP success alone does not establish successful discovery.
  A readable directory with no matching passage returns an explicit
  `directory_no_matches` warning and no sources.
- Each `DiscoverySource` keeps `url`, `title`, source-hostname `institution`,
  fetched `content`, separate `searchSnippet`, `relevanceEvidence`, ISO
  `collectedAt`, optional original `publishedAt` metadata, and `unknowns`.
  The hostname is not verified affiliation; the passages are body matches,
  not model judgments or automatic identification of an advisor. Direct URL
  reading has no search snippet or keyword-matching passages; the body is
  available for the user to examine before associating it with a candidate.
- Each `DiscoveryWarning` keeps a stable `code`, readable `message`, and
  optional failed-source `url`. Search failure remains visible after a
  successful directory fallback. Unsupported pages are not substituted with
  snippets or demonstration snapshots.

Invalid input returns HTTP 422 `validation_failed`; a third concurrent
discovery request returns 429 `discovery_busy`; the existing request-body
limit returns 413 `request_body_too_large`. These use `ApiErrorResponse` and
the request ID. Reading limits and allowed destinations are documented in
[Backend](backend.md) and [Security](../operations/security.md).

## Bounded progress and cancellation (2026-10-22)

The same public `POST /api/v1/discoveries` accepts `Accept: application/x-ndjson`
for progressive reading. Each newline contains a cumulative `DiscoveryResponse`,
with `finished: false` until the final snapshot has `finished: true`. JSON clients
retain the existing single-response path. Both paths return `limits`,
`startedReads`, `completedReads` and `stopReason` (`""`, `time_limit`, or
`source_limit`). While running, `status: partial` is provisional; only a final
snapshot establishes the completed attempt's status. EOF without a final snapshot
is an interrupted run, not successful completion.

The current fixed bounds are 30 server seconds, five source pages and six logical
reads including the search index. A read retains the existing 14-second / 1 MB
cap and at most four HTTP attempts including redirects. Including one possible
HTTP DNS fallback per attempt, the whole run is bounded by 48 outbound HTTP
requests. These are upper bounds, not a promise to use every allowance. No paid
model or search API is integrated. The browser adds a 35-second total waiting
limit and never retries automatically.

Dropping a streamed response aborts its server worker and pending read tasks,
releasing its concurrency permit. Completed snapshots already received by the
browser remain usable. Cancellation cannot recall a public request already sent;
proxies may delay disconnect propagation, so the browser also invalidates the run
before aborting and ignores late data. Changing topic/candidate/scenario or leaving
the discovery view cancels its mounted controller; results cannot save themselves
into another topic. Editing query text alone performs no request.

The request remains exactly `{query}`. Topic conditions/private records are not
added to it, and neither streaming nor progress creates server exploration storage.

## One-shot AI Completion (2026-10-28)

`GET /api/v1/ai/providers` is public (`security: []`) and returns school display
metadata plus `configured`, never a credential. `POST /api/v1/ai/completions`
is also public and accepts `provider` (`school` or `custom`), a nonempty `task`
of at most 2,000 characters, optional `publicContext` of at most 24,000
characters, and optional `personalContext` of at most 8,000 characters. The
browser constructs the latter only from one explicitly selected saved reason;
the API does not load a topic or conversation history.

School requests use only server environment configuration. Custom requests
additionally require `baseUrl`, `model` and `apiKey`; these are one-shot
OpenAI-compatible connection inputs and are not returned or persisted. Success
returns `provider`, `content` and the upstream-reported `model`. Relevant errors
include `school_ai_not_configured` (503), `ai_busy` (429),
`validation_failed`/`invalid_ai_provider` (422), and
`ai_provider_rejected`/`ai_upstream_failed`/`ai_invalid_response` (502).
Transport failures, cancellation and upstream errors can leave delivery
uncertain; a 502 is not evidence that nothing was sent. There is no streaming,
automatic retry, server conversation, output persistence or upstream deletion
contract in this slice. Network limits are documented in
[Security](../operations/security.md#ai-provider-boundary).
