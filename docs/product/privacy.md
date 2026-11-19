# Privacy And Data Boundaries

Last updated: 2026-10-29

The mid-term demo serves personal opportunity exploration across all types,
with public external discovery, browser-local sessions, and a choice between a
clearly labelled simulated organizer and the USTC 词元计划 platform. It has no
account, community publication, or server-side exploration/analysis storage.
The legacy community inventory and audit/deletion assumptions are not current policy.

## Current Implementation

### Data Inventory

| Data | Purpose | Storage | Access |
| --- | --- | --- | --- |
| Topic name, question, preferences, decisions, saved opportunities and candidate records (`campus-agora:explorations:v1`) | Resume separate personal explorations | This browser/site's localStorage | This browser's user and scripts operating under the same origin |
| Last opened topic pointer (`campus-agora:last-topic:v1`) | Resume the last session | Same localStorage | Same browser/origin |
| Color mode (`campus-agora.color-mode.v1`) | Restore light/dark choice | Same localStorage | Same browser/origin |
| Candidate snapshots, saved source text, collection/publication labels and matching evidence | Reopen comparison without repeating discovery | Same localStorage, after user saves | Same browser/origin |
| Planned session fields: `decision`, `lastComparison`, saved `analyses` | Resume processing decisions, the latest comparison and explicitly saved simulated results | Same localStorage; only written by explicit product actions | Same browser/origin |
| Reviewed collected batch: professional names, source-backed summaries and reading context | Display existing information without student-side collection | Repository JSON, included in the Web bundle; optional copy to localStorage on save | Anyone receiving the built demo; no collector login or private topic notes included |
| Private reasons and questions | Preserve the user's own judgments | Same localStorage | Same browser/origin; not sent to discovery and sent to analysis only when individually checked |
| Submitted public query | Run live discovery | API request; keywords also reach the search provider, while direct URLs go to the permitted source site; no project database persistence | API process; DuckDuckGo for keywords or the source site for direct URLs |
| Analysis request: question, public evidence and checked private fragments | Organize only the confirmed material | Processed transiently by `/api/v1/analyses`; no server persistence or body logging | Local API; additionally the USTC 词元计划 platform only when the user chooses `school` |
| Analysis provider configuration | Enable the server-side school transport | API key and model in server environment only | API process; the providers endpoint exposes availability, label, and model, never the key |
| Request metadata | Debug transport and failures | Current tracing output, under runtime log configuration | Operators; bodies/private exploration records are not logged |

### Collection Principles

- The discovery request contains only the query the user submits. Private
  reasons, saved questions and preferences are not automatically attached.
- The query field is for public interest terms, public academic URLs or supported recruitment/project URLs,
  not private identity, contact information or authenticated links. Direct URL
  requests skip DuckDuckGo; keyword requests retain the existing search path.
  The service needs no third-party credentials.
- LocalStorage is browser storage, not an encrypted private vault or an account
  backup. Changing browser, profile or site origin does not transfer records.
- Do not put secrets, tokens, passwords, or raw identity payloads in logs.
- Do not store real student data in seed data, mock data, tests, or AI LOG.

### Topic edits and transient discovery progress

Topic name, question and preferences can be edited with explicit saving. A failed
save keeps the editor open with its draft; closing unsaved edits offers save,
discard or continue. Editing conditions does not change stored candidates,
source snapshots, private reasons/questions or another topic. It does not
populate a public query or send topic conditions to any external service.

Progress snapshots remain in the current discovery view's memory until replaced
or unmounted; only an explicit source save copies evidence into localStorage.
Stopping discovery preserves received evidence, invalidates late callbacks and
cannot retract sent public requests. Analysis receives only public evidence and
private fragments selected in that confirmation and does not persist or log
request text. The simulated provider makes no external call; the school provider
forwards the confirmed payload to USTC 词元计划. Timeout still uses
delivery-unknown wording because the browser cannot prove whether a dispatched
request reached or completed at the selected service.

### Retention

Saved explorations remain in localStorage until removed by the user or cleared
by the browser. Reopening in the same browser/profile/origin can restore them;
there is no cross-device synchronization or project-managed backup. Storage
denial, quota exhaustion and damaged records are surfaced as failures, not
reported as a successful save.

The API processes queries and fetched public text for the response without
persisting them to a project database or substituting cached snapshots for a
live attempt. Saving a result is a separate browser-local action. Operational
log retention depends on the runtime environment; no exact retention period or
upstream-provider deletion guarantee is established by this demo.

### Deletion And Export

Removing a candidate deletes that candidate's private record only in the
selected topic. Deleting a topic removes that topic and its saved private
records from this browser's store. Other topics and the original public source
website are unaffected. These actions have no undo, recycle bin, server audit
or soft-delete stage. Export is not implemented. Clearing the site's browser
storage also removes saved explorations; the project has no server copy to
restore them from.

If accounts, synchronization or shared publication are later adopted, their
retention, permissions and deletion behavior must be documented separately.
Legacy community audit requirements do not apply to current private local
deletion.

### Third Parties

DuckDuckGo receives the submitted public query with the academic and explicitly supported recruitment/project host filters.
The backend fetches eligible pages, whose sites receive normal page requests;
they do not receive the browser's saved reasons or questions. Only when local
DNS returns synthetic `198.18.0.0/15` addresses does the backend send the
already-allowed hostname to the fixed `https://dns.google/resolve` endpoint for
public A records. When the user explicitly chooses the school analysis provider,
`api.llm.ustc.edu.cn` receives the question, listed public evidence and only the
checked private fragments. Its logging, retention and deletion rules are
unverified. Provider-side handling is outside the browser-local store.

If the index fails, the backend performs live body matching only against
Stanford AI Laboratory and CMU Machine Learning faculty directories. Their
fixed page requests do not contain the user's query. The response states this
limited scope and any failures; matching uses explicit terms and a small
vocabulary map, not model inference. The application's public search sends no data to an AI
model and performs no automatic outreach. See [API Contracts](../architecture/api-contracts.md)
and [Security](../operations/security.md) for exact reading limits and network
boundaries.

Any later model, analytics, synchronization or other service integration must
update the documented data sent, purpose, storage and deletion behavior before
the corresponding feature is used.

## Development-Agent Browser Collection

The October 4 Xiaohongshu batch was collected outside the application by a
development agent using the available browser session. Xiaohongshu receives the
ordinary search and reading requests; rendered recruitment text was processed by
the development agent. The batch contains paraphrased professional information,
canonical source links, reading scope and dates. It excludes cookies, site access
tokens, private messages, reader account identifiers and private exploration
notes. The faculty directory corroborates name/institution/direction, not account
ownership or advising quality.

Students can read the included batch without logging into the source site or
transmitting their saved records. Opening an original source may require that
site's login or search context. This separate trial does not add an application
browser connector, a user-key input, or an unattended collection service. See
[the executed trial](advisor-task-design.md#82).

## 已采纳的数据边界与中期 AI

以下数据选择边界继续有效。当前中期演示默认使用明确标注的本地模拟整理服务；用户也可在发送前明确选择中国科大词元计划。外部平台的保留与删除条件尚未核实。

### 公共资料与私人主题

公共资料组织人物／团队、研究工作、参与途径、资源和可追溯来源。探索主题中的问题、偏好、候选关联、私人理由、笔记和待问事项默认私有；公共候选可以复用，私人记录按主题分别保存。修改或删除主题A不改变主题B和公共资料，公共事实更正也不静默改写私人理由或原引用依据。

### 仅发送用户明确选择的个人内容

2026-10-03用户确认：仅向外部AI发送用户明确选择的个人内容。发送前能查看本次选中的内容／片段、接收服务和用途，并取消选择或不发送；发送操作可完成本次确认，不要求重复确认。明确标注为发送给外部AI的操作中，用户主动提交当前问题可以构成对该问题的选择，不延伸为整个主题或其他主题的许可。

请求只包含这次选择的个人内容及任务所需公共依据。保存、浏览、切换主题、选中某个公共导师或过去的一次发送，都不构成其他私人内容的发送许可。关键词展开、摘要、比较、重试及历史上下文均遵守同一选择边界；不能把未选择的私人理由改写为关键词或摘要后发送。由个人内容生成的AI解释／摘要同样按私人内容处理，不自动公开或用于别的主题。

用户取消选择后，后续请求不再附带该内容，也不自动沿用含该内容的外部会话上下文。请求构建不得自动读取其他主题的个人内容，错误日志不记录私人原文。未选择个人内容时，公共资料发现、浏览、比较、保存和官方入口仍可使用。

### 发送状态与取消

内容选择不等于实际发送。能够确认请求未发出时显示“尚未发送”，已发出时显示“已发送，等待结果”，收到响应后显示结果或服务返回错误。超时、断连或取消导致无法确认送达时，显示“发送状态未确认，可能已发送”；不会把未收到结果当作没有传输，也不宣称中止已撤回内容。

取消选择或中止任务阻止后续请求，按工具能力尝试取消在途请求；已经发出的内容可能仍由外部服务处理。主动重试前能查看当前选中的内容／片段、接收服务和前次状态，不自动增加个人内容，也不因超时无限重发。具体状态证据和服务取消能力在接入时核对，不把本产品停止等待等同于外部服务停止处理。

### 保存、纠错与服务说明

当前保存、重开及删除范围见上文Current Implementation。多个主题和各自私人记录分别恢复；删除一主题不影响另一主题或公共来源。误合并的公共对象可拆分并修复关联，保留私人理由、待问项和原引用；原关联不明时交由用户确认，不自动复制到所有拆出对象。维护者修复公共关联不要求查看私人理由原文，也不因此取得额外访问权限。

当前词元计划仅接收本次确认的内容，且标注保留规则未核实；本地删除、取消选择不表示外部服务已删除先前收到的内容。采用其他AI、同步或服务前仍须明确实际发送内容、保留与删除条件。

### 验证要求

以下是相应能力的待执行要求，合成检查和开发者走查不等于学生效果验证。

使用合成的私人理由与笔记，检查实际发出的请求及后续请求：只选择A的一条理由时，不含A的其他笔记、B的内容或整份探索记录；取消后不再发送或续用该内容。检查AI输出保持在对应私人主题，主题A修改／删除及公共资料更新不改变B的私人记录。服务失败不丢失已有资料或已存私人记录。合成数据验证不能冒充真实学生使用或收益测量。

同时模拟未发送、等待、返回、超时／断连和中止，检查发送状态与可观察证据一致；送达不明时保留“可能已发送”，重试仍只发送当前明确选择内容。修正误合并的公共对象时，私人理由、待问项和原引用保留；原关联不明时交由用户确认，不复制到所有拆出的对象。
