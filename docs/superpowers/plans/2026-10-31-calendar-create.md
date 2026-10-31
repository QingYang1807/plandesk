# Calendar Task Creation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持日历点击及拖选创建任务，发布到 GitHub main 和现有 VPS。

**Architecture:** CalendarView 管理指针选区和未保存表单；App.add 接收可选的名称及日期，复用既有 schema、保存队列及历史。所有交互通过真实浏览器与独立 SQLite 验证。

**Tech Stack:** React 19, TypeScript, Pointer Events, Playwright, Vitest, npm（本机无 Bun）。

**Spec:** docs/superpowers/specs/2026-10-31-calendar-create-design.md

## Global Constraints

- 从 origin/dev 开发；用户明确要求最终发布到 main。
- 不修改公共 API，不手改生成客户端，不新增依赖。
- 测试从各包运行，格式与全仓类型检查从根目录运行 npm run check。
- 不修改本地或线上真实项目数据以进行测试。

## Review Focus

- 单日点击只创建一个任务；已有任务点击只打开详情。
- 反向、跨行及跨月拖选保留准确的包含首尾日期。
- 取消、Escape、指针取消不写入；空白名称和无效日期不能提交。
- 键盘及触控可用；拖选中显示准确选区。
- 保存后保留日历，刷新后数据存在，撤销重做正确。

### Task 1: 日历交互及保存

Files: packages/client/src/Views.tsx, App.tsx, styles.css, packages/client/e2e/workflow.spec.ts

- [x] 添加真实浏览器回归测试，先运行单日点击测试，确认因缺少创建表单失败。
- [x] CalendarView 增加 create 回调、指针捕获、选区预览、日期按钮及本地创建表单。
- [x] App.add 接收可选任务草稿，日历保存保留视图；沿用历史、自动保存及错误提示。
- [x] 运行单日、正反向区间、取消、键盘、触控、已有详情、持久化及撤销重做验收。
- [x] 运行各包完整测试、npm run check、npm run build 和全部浏览器验收。

### Task 2: 发布与线上核验

- [ ] 审查 origin/dev 差异并提交 conventional commit。
- [ ] 快进 GitHub main/dev，读取远程 SHA 确认。
- [ ] 使用现有 VPS SSH 入口，调用远程 Codex，明确仓库地址、分支、预期 SHA、备份和回滚要求。
- [ ] 检查云端提交、服务、HTTPS、HTML 引用资源及实际日历功能，保存验收证据。

## 本地验收记录

2026-10-31：Core 29、Server 5、Client 6 单元测试通过；全仓 npm run check 和生产构建通过。PLANDESK_TEST_PORT=14320 npm test（packages/client）6 项真实浏览器验收全部通过，包含原项目生命周期、导出及服务重启。

实际先复现了点击日期无表单、键盘 Tab 被全局缩进拦截、对话框焦点落在关闭按钮三个问题，再修复验证。原生命周期脚本的任务名 Tab 并不触发失焦，日期 Tab 也可能只切换日期字段内部片段，因此改用显式 blur 提交后再操作；类型选择器改用实际标签的非精确匹配。默认测试端口被其他服务占用，新增可选 PLANDESK_TEST_PORT，默认仍为4320。未修改该服务或真实数据。

用户已明确要求完整开发并发布，采用现有干净工作目录的功能分支，不新增 worktree 或交互设计审批。
