# Campus Lumen

Last updated: 2026-10-29

帮大学生跨机构发现科研、实习、竞赛、交流等机会，看懂实际任务与条件，自主决定下一步。

Campus Lumen（原 Campus Agora）是面向大学生个人的机会探索与决策支持工具。中期 demo 让所有机会类型共用“探索 → 发现 → 处理”流程；选导师是内容最深的示例，其他类型使用已有整理入口。AI 整理使用界面明确标注的本地模拟服务，不调用真实模型。

软件工程材料从[软件工程文档导航](docs/project/index.md)进入；产品范围见[需求分析](docs/product/requirements-handoff.md)，中期判定见[验收与测试计划](docs/project/acceptance.md)。

Repository: [114August514/campus-lumen](https://github.com/114August514/campus-lumen).

## Repository Layout

目录职责与历史／现行边界见[仓库布局](docs/engineering/repository-layout.md)。临时调查、草稿和输出放在 `work/`；仅 `work/README.md` 纳入版本管理。已接受的需求、架构和数据边界应写入正式文档。

## Requirements

- Bun
- Rust stable（含 `rustfmt`、`clippy`）
- PostgreSQL 16（当前只用于 readiness 与遗留 migration 检查）
- uv（MkDocs）

## Run The Demo

在两个终端中运行：

```bash
bun install
bun run dev:api
```

```bash
bun run dev:web
```

打开 `http://127.0.0.1:5173`。同一浏览器 profile 和同一 origin 才能恢复本地探索记录。完整说明见[用户手册](docs/project/user-guide.md)。

## API

当前 API 包括：

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/meta`
- `POST /api/v1/discoveries` — 有限公开搜索／官网直读，支持 NDJSON 进度
- `POST /api/v1/analyses` — 中期模拟整理；明确标注模拟，不持久化个人内容

接口字段以[API 契约](docs/architecture/api-contracts.md)和 `contracts/openapi.json` 为准。

## Checks

```bash
bun run ci:frontend
bun run ci:backend
bun run ci:desktop
bun run ci:contract
bun run ci:docs
bun run ci:container
```

API 变更运行 `bun run api:check`；详细质量门禁见[工程质量](docs/engineering/quality.md)。Tauri、旧社区 migration 和 PostgreSQL readiness 仍参与部分检查，但属于休眠／历史基础，不是中期产品运行路径。
