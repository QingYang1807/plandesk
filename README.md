# PlanDesk

本地项目计划工作台。React + TypeScript、独立 SVG 甘特图、Node HTTP 服务、SQLite。无需登录、互联网或远程数据库。

> 当前状态：核心代码、领域/保存队列/API 测试和生产构建已经完成；真实浏览器验收尚未完成，不能视为 P0 全部验收通过。首次研发验收中的环境限制与已知问题见 [交付报告](docs/DELIVERY_REPORT.md)。

## 启动

需要 Node.js 24+，实际验证环境为 macOS ARM64 / Node 26.10.0 / npm 11.19.1。当前目录已有离线安装好的依赖。

```sh
cd ~/qingyang/AI/projects/plan-desk
./start.sh
```

打开 **http://127.0.0.1:4318**。也可在 Finder 双击 `Start.command`。启动脚本构建前端后运行本机服务，终端 `Ctrl+C` 停止。端口可用 `PORT=4321 ./start.sh` 指定。请使用 127.0.0.1 地址。

开发：`npm run dev`。生产构建：`npm run build`；已有构建直接启动：`npm start`。本机未安装 Bun，脚本使用 npm 和官方 TypeScript native 编译器；未修改全局环境。

首次克隆安装：

```sh
git clone --branch dev https://github.com/QingYang1807/plandesk.git
cd plandesk
npm ci --cache .npm-cache
./start.sh
```

仓库不包含 `node_modules`、本地数据库、依赖缓存或运行日志。首次安装需要网络；安装后的本地应用不需要互联网。原开发目录保留了依赖缓存，可使用 `npm ci --offline --cache .npm-cache` 重装。开发分支为 `dev`，`main` 同步首版代码；后续 PR 以 `dev` 为目标。

## 使用流程

1. 首页新建项目，选择空白或六种专业模板之一。模板工期为建议值，需要自行评估。演示项目单独标记，不会作为新项目任务副本自动混入。
2. 在甘特任务表录入名称。`Enter` 创建同级，`Tab` 缩进，`Shift+Tab` 提升。单元格失焦后保存；开始/结束日期可直接输入或选择。第一次填写会初始化另一端；清空日期将移除整段排期。
3. 选择任务后新增子任务、复制分支、批量修改或删除。`Cmd/Ctrl+点击` 多选。拖动行排序；`Alt+拖动行` 将任务放到目标任务下面。里程碑不能作为父任务。
4. 双击任务条或点任务旁的 `↗`，右侧编辑状态、进度、交付物、AC、实际日期、工时和风险。父任务日期及进度仅由子任务聚合。
5. 手动拖动条形移动日期，拖动边缘改变工期。条形末端连接点支持拖动连接，或点击起点后点击目标任务条。也可以在详情选择前置任务、类型和 Lag；删除依赖后可重新添加修改后的依赖。
6. “视图设置”切换自动排期，或点“执行自动排期”。FS/SS/FF/SF 均支持；锁定冲突、未排期前序和循环会明确失败。默认手动模式。
7. 切换日、周、月、季度、年尺度，使用今天和定位选中。视图设置可调整左表宽度、隐藏表格、显示列与列顺序，切换关键路径/基线/依赖和工作日历。
8. 路线图仅保留阶段与里程碑。看板拖动卡片改变状态，项目概览显示真实统计；没有跨日历史时显示空状态。资源视图列出估算与实际工时、日期重叠。
9. 保存基线后，原日期与进度不会随任务变化；最新基线可显示在甘特条下方。任务详情显示结束偏差；所有基线保留在 JSON 中。
10. 导入支持 JSON/CSV/TSV，先验证、预览，再创建独立项目或合并到当前项目。合并重新分配任务 ID。缺失日期保留未排期。完整备份 JSON 数组会预览全部项目，再原子恢复为独立副本。
11. 导出报告可选择完整项目或当前筛选、标题与副标题、图例、依赖、倍率、A4/A3 横向和页边距。JSON 完整往返；CSV 表格交换；SVG/PNG/PDF 独立整图渲染。管理层模式切换 Executive 路线图，导出时选择当前筛选。

## 自动保存、撤销与离线

- 输入失焦或操作完成后写入 SQLite；右上角显示保存状态。`Cmd/Ctrl+S` 提交当前输入；只有“已保存到本地”才表示服务保存成功。
- `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`，或顶部按钮撤销/重做，当前窗口最多60次；文本输入框保留浏览器原生文本撤销。
- 冲突或断连会显示错误，并保留浏览器本地草稿。项目页提供恢复并重试、导出草稿，不会静默覆盖其他窗口。
- 本机服务运行时完全不需要互联网。应用壳与最近读到的数据会缓存。服务停止后可查看缓存，结构变更、排期与可靠保存需要启动本机服务；不是完整的离线协同编辑器。

## 数据与备份

| 数据 | 位置 |
|---|---|
| SQLite 主文件 | `data/plandesk.sqlite` |
| SQLite WAL/SHM | 同目录，运行时由 SQLite 管理 |
| 全项目 JSON 备份 | `data/backups/backup-*.json`，首页“备份全部项目” |
| 最近100个内部文档快照/项目 | SQLite `snapshot` 表，暂不提供历史浏览 UI |
| 显式计划基线 | 各项目文档 `baseline` 数组 |
| 未保存草稿 | 当前浏览器 localStorage `plandesk-draft-<project-id>` |
| 导出文件 | 浏览器下载目录 |

首页备份后，用“导入项目”选择备份文件、验证与预览，再确认恢复。恢复创建独立项目，不覆盖原项目。要复制 SQLite 文件，请先停止服务，或者连同 WAL 一起保留；优先使用 JSON 备份。`PLANDESK_DB=/absolute/file.sqlite npm start` 可指定独立数据文件。

## 导入示例与 AI

- [完整演示 JSON](examples/ai-enterprise-platform.json)：9阶段、44工作项、7里程碑、36依赖、5成员、3层 WBS，研发工作包并行汇入联调。
- [版本化 JSON Schema](examples/plandesk-v1.schema.json)。`schemaVersion` 当前必须为1，未知版本明确拒绝。
- [AI 生成提示词](examples/ai-prompt.txt)。界面也可下载 Schema 与复制提示词。

CSV/TSV 表头示例：

```csv
id,parentId,order,name,type,start,end,owner,progress,status
phase,,0,需求阶段,phase,,,,0,todo
a,phase,1,用户访谈,task,2026-11-02,2026-11-04,青阳,0,todo
b,phase,2,需求评审,milestone,,,林悦,0,todo
```

CSV 不包含基线或完整依赖属性；用 JSON 保持完整任务树、依赖、工时、AC 和基线。直接粘贴 Excel 数据时需要保留表头；原生 `.xlsx` 和 Markdown 表格尚未实现。

## 验证

```sh
npm test             # 分别进入 Core / Server / Client 包执行 Vitest
npm run check        # 格式与所有包的官方 TypeScript 检查
npm run build
npm run test:e2e     # 真实 Playwright，专用 4320 端口和临时 SQLite，不修改真实项目
```

Playwright 浏览器未安装时：`cd packages/client && npx playwright install chromium`。首次研发验收环境已有 Chromium，但当时系统沙箱拒绝启动；原始失败日志保存在开发目录的 `artifacts/e2e.log` / `browser-probe.log`，不上传仓库。

E2E 脚本包含创建模板、行内编辑与 Tab、条形拖拽、依赖、自动排期、进度、多视图、整图导出、服务重启和 JSON 往返，并计划输出 1440×900 截图到 `artifacts/screenshots/`。**脚本存在不代表已经通过**。

`node --import tsx scripts/export-samples.ts` 直接调用生产导出渲染器，生成 [SVG](artifacts/demo-gantt.svg)、[PNG](artifacts/demo-gantt.png)、[分页 PDF](artifacts/demo-gantt.pdf) 与 [路线图](artifacts/demo-roadmap.png)。样张的 PNG 光栅化使用 Sharp；浏览器下载路径还需 E2E 验证。

## 目录

```text
packages/schema/       领域契约和 JSON Schema
packages/core/         排期、CPM、WBS、模板与单元测试
packages/server/       SQLite、Request/Response API、本地 HTTP、集成测试
packages/client/       React、SVG Gantt、多视图、导入导出、保存队列、浏览器测试
examples/              完整演示计划、Schema、AI 提示词
scripts/               导出样张生成
artifacts/             实测日志与导出样张；浏览器截图待验收
 data/                 本地用户数据（不纳入版本控制）
docs/                  架构、许可证、交付报告和实施记录
```

[架构与算法约定](docs/ARCHITECTURE.md) · [第三方依赖许可证清单](docs/THIRD_PARTY_NOTICES.md) · [完整交付报告与已知限制](docs/DELIVERY_REPORT.md)
