# 研究记录（本轮实际查阅）

Last updated: 2026-10-25

作者：Kimi · 2026-10-25

## 1. 需求基线（仓库文档，已通读）

- `docs/product/requirements-handoff.md`（需求分析 v1.0，全文）：问题证据表、P01–P07、范围与优先级、N 编号摘要、demo 验收、异常与质量要求。
- `docs/product/requirements.md`（需求基线 v1.0，全文）：八部分分析契约、N01–N13 追溯表、使用/信息/质量约束。
- `docs/product/overview.md`（全文）：产品定位、当前交付边界、侧重点、供给方式、UI 与工程边界。
- `docs/product/privacy.md`（全文）：数据清单、收集原则、删除导出、第三方、已采纳的 AI 集成要求（仅发送明确选择的个人内容、发送状态与送达不明）。
- `docs/product/advisor-task-design.md`（任务设计 v0.4，全文）：T1–T6 任务、信息关系、合并/纠错规则、页面组织建议、异常表、8.1–8.7 实现切片记录（含 10-24 双对象并排与 session 式主题组织的已确认交互方向）。
- `docs/constraints/frontend-reference.md`（全文）：Primer/Octicons/PR15 锁定与禁止项。
- `apps/web/src/app/App.tsx`（全文）：仅用于理解兼容边界——现行导航（首页/找导师/机会与入口/比较/我的探索）、localStorage 键（`campus-agora:explorations:v1`、`campus-agora:last-topic:v1`）、比较与主题状态结构。未修改任何源码。

## 2. 外部开源产品（实际 HTTP 阅读）

**HKUDS/DeepTutor**（https://github.com/HKUDS/DeepTutor ，2026-10-25 读取 main 分支 README 正文开头与 Key Features 节）：

- 实际读到：定位为 "agent-native learning workspace"，把 Chat/Quiz/Research/Visualize/Solve/Mastery Path 等多种模式放在同一 runtime 与 session context 上；有 Task Board（To do/In progress/Done，可归档恢复）；Knowledge bases/books/notebooks/personas/Memory 可跨 workflow 复用；Memory 分 L1 traces / L2 surface summaries / L3 synthesis，且"可检查、可编辑"（Memory Graph 把 L2 事实链接回 L1 证据）；支持子代理与 MCP/skill 扩展。
- 采纳与理由：
  - 采纳"**多种任务模式共享一个上下文、但各自保留专用流程**"的组织思想 → 对应本设计的"两个空间＋发现过程作为一等对象"：公共资料被探索、比较、主题复用，私人主题各自独立。
  - 采纳"**记忆/依据可检查、可回溯**"的呈现思想 → 对应本设计的来源、取得时间、核对状态逐条可见，以及发现过程的范围/失败/中止状态如实展示。
  - 明确不采纳：其教学模式（Quiz/Mastery/练习测评）与需求基线"不扩展为知识教学或练习测评"冲突；其"im 伙伴/子代理市场"等社区与代理生态超出本产品范围。
- 阅读边界：仅读 README，未运行、未试用其 UI；不作其产品体验断言。

## 3. 仓库内既有调研记录（二手，未重复查证原文）

需求与任务设计文档中已记录的 SOLO、Handshake、Arno、Research Application Toolkit、Entscheidungsnavi、Google Notebook、Argdown 等对照（见 requirements-handoff 第 3 节、advisor-task-design 8.3），本轮只读取了仓库中的记录文本，未重新访问原站；在引用其结论时保持"既有记录"的定性，不冒充本轮实读。

用户先前给出的参考线索（DeepTutor、Qwen 双输出对照、agent session 比喻）中：DeepTutor 本轮实际查阅（见上）；Qwen 双输出对照与 session 式组织已由用户 10-24 明确为交互方向并被任务设计 8.7 采纳，本稿沿用其方向但不把它当作架构模板。
