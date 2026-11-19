# Contributing

Last updated: 2026-11-19

待办统一记在 [GitHub Issues](https://github.com/114August514/campus-lumen/issues)。每张工单写清目标、可观察的验收标准和不做什么；模板在 `.github/ISSUE_TEMPLATE/`。

## 工单流程

1. **开单**：用对应模板（功能 / 缺陷 / 文档 / 调研）。调研单必须写明会改变哪个决定和停止条件。验收标准能用命令、测试或浏览器验证，且不需要人登录、试用或拍板的工单，加 `agent-ok`，表示可以交给 AI 代理。
2. **领取**：人在 Issue 上指派自己；代理开工时在 Issue 里留言写明分支名。从最新的 `main` 拉分支 `<类型>/<编号>-<简述>`，例如 `fix/27-keyboard-focus`。同时进行的工单各用一个 worktree：`.worktrees/<编号>-<简述>`（已被 Git 忽略）。
3. **先计划**：改动涉及存储结构、OpenAPI 契约、隐私边界、费用，或要删除代码时，先在 Issue 里贴计划，经 @114August514 确认后再实现。其他工单直接做。
4. **实现与验证**：按 `AGENTS.md` 和相关文档实现，运行与改动相关的检查（见下）；界面改动要在浏览器里实际操作一遍。PR 里贴出运行的命令和结果，不只写“已通过”。
5. **PR**：标题用 `<类型>: <说明>`，正文写 `Closes #编号`，按 PR 模板写验证和影响。一个 PR 只做一件事。
6. **审查**：AI 实现的 PR 由没有参与实现的审查者（另一模型或人）对照 Issue 的验收标准看改动，只报影响正确性、数据或隐私的问题，不报风格。结论写进 PR。
7. **合并**：CI 六项全部通过、审查没有阻塞问题后，squash 合并；Issue 自动关闭，分支自动删除。`agent-ok` 工单可以由代理合并，其他工单由负责人合并。
8. **收尾**：同一类错误出现第二次，就在同一个 PR 里给 `AGENTS.md` 加一条短规则。完成的事实写进 `docs/ai-log/done.md`；需要跨会话继续的工单，在 `docs/ai-log/todo.md` 留交接笔记并链接 Issue。

不改写共享历史，不替别人推送代码，不关闭别人的 PR。

## 检查命令

按改动的文件运行对应检查：

```bash
bun run ci:frontend
bun run ci:backend
bun run ci:contract
bun run ci:docs
```

桌面或容器改动另跑 `bun run ci:desktop` 或 `bun run ci:container`；API 改动跑 `bun run api:check`，并同步 OpenAPI 与生成的类型。需求、架构、隐私、安全或运维方面的变化，同步更新对应的正式文档。

## 不能违反的规则

- 前端只用 Primer，遵守 `docs/product/ui-system.md`；所有机会类型共用“探索 → 发现 → 处理”流程。
- 模拟内容和模拟服务必须有明显标注；不编造真实人物或机会的事实。
- 不提交密钥、`.env`、生成的日志、数据库转储、被忽略的 `work/` 内容或本地 `tools/kimi/`。
- `docs/ai-log/` 只写简短事实，不写学生私人内容、凭据、登录画面或原始对话记录。

## 参考

流程参考了 Claude Code 团队公开的做法：每个任务先写清“做完是什么样”，给代理一个能自己运行的检查，并行任务各用一个 worktree，由没写代码的会话审查，反复出现的错误写进说明文件。来源：[Claude Code best practices](https://code.claude.com/docs/en/best-practices)，Boris Cherny 的[个人用法](https://x.com/bcherny/status/2007179832300581177)与[团队用法](https://x.com/bcherny/status/2017742741636321619)。本项目的取舍见 `docs/engineering/development.md` 的“方法与 skill 参考”。
