# 中期汇报幻灯片

5 分钟中期汇报：需求分析、可行性分析、现场演示与进度。用 [Slidev](https://sli.dev) 编写，主题为 `slidev-theme-touying` 的 `simple` 预设；`slide-top.vue` 的进度条改写自该主题 `university` 预设（MIT）。

- `slides.md`：正文 8 页 + 备用 8 页（`backup: true`，不计入进度条）。每页讲稿在 HTML 注释里，演讲者模式可见。
- `public/demo-*.png`：2026-10-31 在本地应用里截取，数据为合成示例主题和公开官网资料。

```bash
bun install          # 本目录独立安装，不在根 workspace 里
bun run dev          # http://localhost:3030 ，演讲者模式 /#/presenter/
bun run build        # 静态网页，输出到 dist/
bun run export -- --executable-path /path/to/chrome   # 导出 PDF
```

导出需要 Chromium：传 `--executable-path` 指向本机 Chrome，或先运行 `bunx playwright install chromium`。

现场演示前按第 6 页讲稿准备：启动 API（服务端配置词元计划 Key）和 Web，在 `#/demo` 载入合成示例主题，并提前保存一次词元计划整理结果。
