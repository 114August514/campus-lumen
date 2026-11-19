---
theme: touying
title: Campus Lumen 中期报告
author: August · jasonxu-cell
date: 数据截至 2026-10-31
touying:
  preset: simple
  footer: Campus Lumen · 中期报告
fonts:
  sans: Noto Sans CJK SC
  serif: Noto Sans CJK SC
  mono: Sarasa Mono SC
  provider: none
aspectRatio: 16/9
canvasWidth: 980
colorSchema: light
routerMode: hash
transition: none
duration: 5min
timer: countdown
download: false
exportFilename: campus-lumen-midterm
defaults:
  header: false
layout: cover
---

<img src="/logo.svg" class="w-14 mx-auto mb-4" alt="">

# Campus Lumen

帮大学生跨机构发现机会、看懂实际条件、自己决定下一步

<!--
≈15 秒。
我们做的是 Campus Lumen：帮大学生跨机构发现科研、实习、竞赛、交流这些机会，看懂实际要做什么、需要什么条件，再自己决定下一步。
接下来依次讲需求、可行性、设计，再演示原型。
-->

---
footer: 需求分析
---

# 信息并不缺，缺的是按个人目标把它串起来

<div class="grid grid-cols-3 gap-8 mt-2">
<div>
  <div class="stat">300+</div>
  <div class="label">个岗位：软件学院一份就业提醒，靠人工整理、群里转发 · S1</div>
</div>
<div>
  <div class="stat">41%</div>
  <div class="label">学生难判断信息是否相关；18% 难选信息源 · S3</div>
</div>
<div>
  <div class="stat">RSTAR</div>
  <div class="label">校内已有导师、项目和资源服务 · S2</div>
</div>
</div>

<div class="mt-8 text-[0.85em]">
提供者按 <b>院系 · 机构 · 项目</b> 发布 → 学生按 <b>兴趣 · 目的 · 时间 · 条件</b> 寻找
</div>

<div class="takeaway">
需求是三件事：<b>跨来源发现</b>、<b>看懂并比较</b>、<b>记下并接续自己的判断</b>
</div>

<div class="note mt-3">
S1 科大软件学院 2027 届就业提醒 · S2 RSTAR 上线通知 · S3 Head &amp; Eisenberg（2010，美国 25 校，n = 8,353）
</div>

<!--
≈40 秒。
机会信息很多：软件学院一份就业提醒就人工汇总了二十多家单位、三百多个岗位，校内也已经有 RSTAR。
难点在于，信息按院系、机构、项目发布，学生却是从自己的兴趣、目的和条件出发去找。
一项 8 千多份问卷的研究里，41% 的学生难判断信息是否相关，远高于难选信息源的 18%——找到之后怎么判断，才是更普遍的难点。
所以需求是三件事：跨来源发现、看懂并比较、记下并接续自己的判断。

备问：本校比例？——本校问卷还没做，下一步同学试用会补；现有结论来自文献和本校公开案例。
-->

---
footer: 需求分析
---

# 七类问题收敛为一条流程：探索 → 发现 → 处理

<div class="grid grid-cols-3 gap-4">
<div class="stage">
<b>① 探索</b><br>
写下问题就能开始；目标可以模糊，随时改
<span class="tag">P01：目标还说不清</span>
</div>
<div class="stage">
<b>② 发现</b><br>
先查已有资料，再实时读官网；每条标来源和取得时间
<span class="tag">P01：来源分散 · P06：找不到入口</span>
</div>
<div class="stage">
<b>③ 处理</b><br>
同类并排比较，缺资料处标“未提及”并可补查；按需给准备重点和资源；保留 / 待定 / 排除和理由按主题保存
<span class="tag">P02 难比较 · P03 不知怎么开始 · P04 资源不适配 · P05 难接续 · P07 介绍之外的实情</span>
</div>
</div>

<div class="note mt-5">
对象：科大学生个人，可从任一步进入 · 导师资料最深，实习、交流、竞赛等 8 类 26 条入口走同一流程<br>
原则：判断留给学生——系统整理依据，不打分、不代办、不推送
</div>

<div class="takeaway">
现有办法各管一段；我们把<b>来源、候选和自己的理由</b>放在一处，下次接着做
</div>

<!--
≈40 秒。
需求分析归纳出七类问题，P01 到 P07，落到同一条流程上：
探索——写下问题就能开始；发现——先查已有资料，再实时读官网，每条标来源和取得时间；处理——同类并排比较，缺资料的格子可以补查，决定和私人理由按主题保存。
原则是判断留给学生：系统整理依据，不打分、不代办、不推送。
和官网、RSTAR、搜索加笔记相比，我们把来源、候选和自己的理由放在一处，下次能接着做。
-->

---
footer: 可行性分析
---

# 可行性：技术与成本可行，关键词发现需换数据源

<div class="feas">

| 方面 | 依据（10-29 / 10-31 实测） | 判断 |
| --- | --- | --- |
| 外部信息 | 官网直读 2 次成功（4,421 / 16,000 字）；关键词搜索遇验证页 | 直读可用；发现新对象改接搜索 API 或官方目录 |
| AI 整理 | 词元计划实测 35 s 返回，结论带依据编号 | 可用；推广前确认平台条款与团队 Key |
| 数据 | 7 位导师、3 个实习、26 条入口，均带来源和日期 | 足够演示 |
| 成本 | 一次整理约 5.5 万 tokens（配额 3,000 万 / 3 h）；校外约 0.116 元 | 可控 |
| 隐私合规 | 只读公开页；私人记录只在本机，逐条勾选才发送 | 已按此实现 |

</div>

<!--
≈45 秒。
可行性分五方面。外部信息：官网直读两次都成功，关键词搜索被验证页挡住，发现新对象要换成付费搜索 API 或官方目录。
AI：学校网络信息中心的“词元计划”已经真实调用过，35 秒返回，结论带依据编号；推广给更多同学前，要确认平台条款和团队 Key 的用法。
数据：现有资料够演示，都带来源和日期。成本：一次整理约 5.5 万 tokens，相对校内配额很小，换校外模型一次约一毛二。
隐私：只读公开页，私人记录只在本机，逐条勾选才发送。
-->

---
footer: 设计
---

# 设计：公开资料与私人判断分开存，每条陈述绑定来源

<div class="schema">
<div class="part">
<b>公开资料</b><span class="where">仓库 JSON + 实时读取</span>

- `CatalogItem` 导师 / 实习 / 入口，8 类机会
- `ParticipationRoute` 参与途径：有依据 · 历史 · 未知 · 未提及
- `RouteCondition` 条件：硬要求 · 优先 · 建议
- `BoundClaim { text, urls }` 每条陈述带来源
- `SourceSnapshot` 正文、采集时间、已有 / 本次取得

</div>
<div class="part">
<b>无状态 API</b><span class="where">Rust / Axum，OpenAPI 生成客户端</span>

- `POST /api/v1/discoveries` 联网查找与直读，流式返回、可中止、有上限
- `POST /api/v1/analyses` AI 整理，模拟或词元计划
- `GET /api/v1/analyses/providers` 可用的接收服务

</div>
<div class="part">
<b>私人记录</b><span class="where">浏览器 localStorage，按主题隔离</span>

- `ExplorationTopic` 问题、类型、当前阶段
- `TopicCandidate` 保留 / 待定 / 排除、理由、待问
- `SavedAnalysis` 接收服务、已发送的个人内容编号
- `AssociationNote` 误合并修正后的重新关联

</div>
</div>

<div class="takeaway">
公开内容可更正、可复用；私人判断只在本机，发给 AI 前逐条勾选
</div>

<!--
≈40 秒。
设计上最重要的决定，是把公开资料和私人判断分开。
左边是公开资料：放在仓库里，每条陈述都绑定来源网址；导师的参与途径单独记录，状态分有依据、历史、未知、未提及，条件分硬要求、优先和建议。
右边是私人记录：只在浏览器里，按主题隔离——保留、待定、排除、理由和待问都挂在主题下。
中间是无状态的 Rust API，负责联网查找和 AI 整理；前后端接口由 OpenAPI 契约生成客户端。
-->

---
footer: 原型演示
---

# 原型演示：同一个问题，从发现走到处理

<div class="grid grid-cols-[5fr_7fr] gap-6 items-start">
<ol class="steps">
<li><b>发现</b>：已有资料 22 条，标采集日期和途径状态</li>
<li><b>直读官网</b>：运行记录逐步出现，4,421 字标“本次取得”</li>
<li><b>比较</b>：同一问题并排，缺资料处标“未提及”，从“仍需确认”一行补查</li>
<li><b>整理</b>：词元计划生成，每条带依据编号，只发了 1 条个人内容</li>
</ol>
<figure class="shot m-0">
  <img src="/demo-ai-crop.png" alt="词元计划整理结果：平台与模型标签、差异要点和依据编号">
  <figcaption><b>④</b> 已保存的词元计划整理结果</figcaption>
</figure>
</div>

<div class="note mt-4">数据：合成示例主题 + 公开官网资料 · 截图版见备用页 9–12</div>

<!--
≈85 秒，切到浏览器现场演示。网络出问题时按 G 输入 9，用备用页 9–12 的截图讲。
演示前：启动 API（带词元计划 Key）和 Web；在 #/demo 载入两个合成示例主题；提前在“暑期研究（合成示例）”里跑好一次词元计划并保存。
1. 打开 #/explore?stage=discover&q=想找本科阶段能参与的 AI 系统方向短期科研：22 条已有资料，每条标“已有资料”和采集日期。（15 秒）
2. 打开 #/item/zuming-jiang →“联网补查”→ 选“江祖铭个人主页”→“读取当前正文”：运行记录逐步出现，取得 4,421 字，标“本次取得”和时间。（25 秒）
3. 打开 #/compare?ids=zuming-jiang,zhuoran-song&p=short-term：同一行比较同一个问题；宋卓然“怎样参与”一格标“未提及”，在“仍需确认”一行可以发起补查；点“依据”看原文。（20 秒）
4. 我的探索 → 暑期研究 → ③ 处理：保留 / 待定 / 排除；展开“整理记录”：标明词元计划和模型、每条带依据编号、发送个人内容 1 条。真实调用要 35 秒，现场直接看保存的结果。（25 秒）
-->

---
footer: 原型进度
---

# 原型进度：六项核心功能已可操作

<div class="grid grid-cols-[3fr_2fr] gap-8">
<div class="features">

1. **统一流程**：探索 → 发现 → 处理，8 类机会共用页面
2. **发现**：已有资料匹配 + 联网查找 / 官网直读，可中止
3. **理解**：详情分开研究、参与途径、条件层级和准备重点
4. **比较**：2–4 个同类对象按问题并排，未知项可补查
5. **接续**：多主题保存决定、理由和待问；误合并可修正
6. **AI 整理**：模拟或词元计划，发送前逐条确认

</div>
<div class="features">

**下一步**

1. 关键词发现：接付费搜索 API 或官方目录
2. 7 份导师档案：团队逐条人工核对
3. 同学试用：队友独立走查 + 3–5 名同学

</div>
</div>

<div class="note mt-4">
验证：中期最低验收 4 / 4 通过，自动测试与 6 项 CI 全部通过（见备用页 14）<br>
09-22 重置产品 → 10-03 需求 v1.0 → 10-29 集成 → 10-31 接入词元计划
</div>

<!--
≈30 秒。
原型目前六项核心功能都能操作：统一流程、发现、理解、比较、接续和 AI 整理。
这些功能按中期验收标准走查过，最低验收全部通过，自动测试和 CI 都是绿的，细节在备用页。
下一步补三处：关键词发现换数据源、导师档案人工核对、找同学试用。
-->

---
layout: focus
---

把分散的机会信息，变成看得懂、比得了、接得上的个人判断依据

<div class="text-[0.5em] mt-8">谢谢，欢迎提问</div>

<!--
≈5 秒。一句话收尾，然后进入提问；备用页在后面。
-->

---
footer: 备用 · 演示截图
backup: true
---

# 截图 1：已有资料 22 条，标采集日期和途径状态

<img class="full-shot" src="/demo-discover.png" alt="发现阶段：已有资料匹配列表">

---
footer: 备用 · 演示截图
backup: true
---

# 截图 2：直读官网取得 4,421 字，标“本次取得”

<img class="full-shot" src="/demo-direct-read.png" alt="官网直读运行记录与结果">

---
footer: 备用 · 演示截图
backup: true
---

# 截图 3：按“短期参与”并排比较两位导师

<img class="full-shot" src="/demo-compare.png" alt="江祖铭与宋卓然按短期参与并排比较">

---
footer: 备用 · 演示截图
backup: true
---

# 截图 4：词元计划整理结果，每条带依据编号

<img class="full-shot" src="/demo-ai.png" alt="词元计划整理结果与依据编号">

---
footer: 备用
backup: true
---

# 备用：需求追踪 P → N → FR → 验收

| 问题 | 需求 | 功能需求 | 验收结果 |
| --- | --- | --- | --- |
| P01 难发现相关选项 | N01–N03、N08 | FR-01–04、FR-10、FR-16 | 通过；F02、F18 部分通过 |
| P02 难理解比较 | N03–N05 | FR-04–07、FR-17 | 通过 |
| P03 不知道如何开始 | N06 | FR-08 | 通过 |
| P04 资源不适配 | N07–N08 | FR-09–10 | 通过 |
| P05 难接续不同探索 | N09 | FR-11、FR-17 | 通过 |
| P06 不清楚要求及入口 | N08 | FR-09–10 | 通过 |
| P07 自述不足以了解实情 | N11 | FR-12 | 通过（展示缺口与待问） |

<div class="note mt-3">完整矩阵见 docs/project/requirements-spec.md；N10 通知、N13 自动进度放在中期之后。</div>

---
footer: 备用
backup: true
---

# 备用：验收与测试

| 验收项 | 结果 |
| --- | --- |
| M 最低验收 | 4 / 4 通过 |
| F 功能 | 16 通过 · 3 部分（F02 关键词发现、F13 误合并浏览器专项、F18 非导师类资料深度） |
| Q 前端质量 | 7 通过 · 1 部分（完整键盘与读屏） |
| E 工程 · D 文档 | 10 / 10 通过 |
| 自动测试 | Web 126 · 客户端 22 · Rust 42 |
| GitHub CI | 6 / 6 项通过 |

<div class="note mt-3">标准见 docs/project/acceptance.md，结果见 docs/project/test-report.md。</div>

---
footer: 备用
backup: true
---

# 备用：分工与 AI 工具使用

| 成员 / 工具 | 工作 |
| --- | --- |
| August（88 次提交） | 需求分析与产品决策；发现、保存、比较等功能切片（PR #12–#14、#17、#18）；10-29 集成与软件工程文档；10-31 接入词元计划 |
| jasonxu-cell（12 次提交） | 发现 / 隔离 / AI 边界（PR #11）；多类型入口（PR #16）；10-26 完整性审计；10-27 修复与误合并修正（PR #20）；词元计划传输层（`14b0ba6`） |
| Claude、Codex、Kimi | 编码与审查辅助工具；审查记录见 docs/project/reviews.md |

<div class="note mt-3">提交数按 Git 作者名统计。</div>

---
footer: 备用
backup: true
---

# 备用：成本参数（按接口上限估算）

| 项目 | 单次 | 2,000 次 / 月 |
| --- | ---: | ---: |
| 词元计划 | 校内配额 | 额度归属待确认 |
| DeepSeek Flash（校外备选） | 0.116 元 | 232 元 |
| DeepSeek V4 Pro（校外备选） | 0.513 元 | 1,026 元 |
| Brave 搜索 API | 0.005 美元 | 10 美元 |

<div class="note mt-3">一次整理按 60 条依据 × 800 字 + 问题 + 10 条私人片段，估 54,000 输入 tokens、1,000 输出 tokens；价格读取于 2026-10-29。</div>
