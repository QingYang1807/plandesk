# PlanDesk 0.1 交付与验收报告

日期：2026-10-30。目录：`/Users/linqingyang/qingyang/AI/projects/plan-desk`。

## 结论

交付完整本地源代码、已安装依赖、可复现锁文件与离线缓存、生产构建、演示数据、Schema、导出样张和使用手册。**P0 源代码闭环已实现，但真实浏览器验收未完成，因此不声明 P0 全部验收通过，也不声明服务当前运行。**

当前环境的限制是实际阻断：

- 启动本机 HTTP 服务得到 `listen EPERM: operation not permitted 127.0.0.1:4318`。
- 独立 E2E 服务的 4320 端口同样被系统拒绝。`npm run test:e2e` 实际执行，结果1失败，失败发生于测试服务启动前置条件，尚未进入业务浏览器步骤。
- Chromium 探测在 `MachPortRendezvousServer` 处得到 `Permission denied (1100)`；WebKit 探测也中止。
- Computer Use 浏览器宿主不可用；原生终端启动动作被工具以 safety reasons 拒绝。没有降低隔离、伪造页面截图或把这些步骤写为通过。

用户在正常本机终端执行 `./start.sh` 即可尝试启动；然后执行 `npm run test:e2e` 复验。测试用临时 SQLite 和4320端口，真实数据位于4318服务对应数据库。

## 功能状态

“实现”表示源代码有实际数据链路，不表示交互已在浏览器通过。

| 范围 | 实现情况 | 已获得的证据 |
|---|---|---|
| 多项目管理 | 新建、六模板、搜索排序、复制、归档恢复、独立演示 | 真实 API 创建与 SQLite 持久化测试；UI待验收 |
| WBS | 自动编号、展开折叠、Tab层级、行拖放、复制分支、批量修改负责人/状态、父删除处理 | Core层级/环/聚合单测；键盘与拖放待验收 |
| 任务编辑 | 行内名称/负责人/日期/进度/状态，右侧复杂字段、工时与AC | Schema/API保存测试；表格焦点行为待验收 |
| Gantt | 固定左表/表头、统一行滚动、可见行渲染、条形移动/边缘缩放、今天定位、选择、右键详情 | 独立SVG渲染样张；DOM/SVG滚动对齐待浏览器验收 |
| 时间尺度 | 日/ISO周/月/季度/年，周历和节假日 | 跨年ISO刻度、严格日期、工作日单测；视觉缩放待验收 |
| 依赖 | 四种类型、工作日Lag/Lead、详情添加/删除、SVG连接、连接点交互 | DAG循环/引用/约束单测；连接点拖动待验收 |
| 自动排期 | 保持工作日工期、拓扑计算、锁定冲突拒绝、不发明空日期 | 确定性、跨年、假日、锁定、空日期测试 |
| 多视图 | WBS、Gantt、阶段路线图、看板、真实概览、基本日历与资源列表 | 共用同一Plan；跨视图浏览器流程待验收 |
| 导入导出 | JSON/CSV/TSV预览，新建或合并；SVG/PNG/分页PDF | JSON树与依赖API往返、CSV转义/空日期单测，生产SVG及PDF生成 |
| 保存与恢复 | SQLite WAL、修订号、串行队列、草稿、全项目JSON备份与原子恢复 | 文件DB重开、非法写入、冲突、离线连续写、跨项目队列和恢复事务测试 |
| 撤销/重做 | 当前窗口最多60次，键盘与按钮 | 实现；浏览器与输入焦点组合未验收 |
| CPM | ES/EF/LS/LF/Float，四类型，0工期里程碑一致 | 并行浮动、里程碑链、1000任务测试 |
| 基线 | 多个不可变快照，最新快照甘特对比，详情偏差 | 不可变性与API保存测试；UI待验收 |
| Resource | 按人任务、估算/实际工时、日期重叠 | 实现基础投影；无资源平衡或工时热力图 |

## 自动化与构建

最终以 `artifacts/tests.log` / `check.log` / `build.log` 为准。Vitest分别从包目录执行，未从仓库根直接运行测试工具。

- Core：29项测试。
- Server：5项测试（真实SQLite和真实Request/Response API，不使用网络监听或假数据库）。
- Client：6项测试（保存队列、草稿、导出转义/完整范围、跨年时间刻度）。
- 共40项通过。
- `npm run check`：Prettier与所有包的官方TypeScript native检查。
- `npm run build`：Vite生产构建。第三方Zod中的注释有Rollup annotation警告，未影响构建。
- `npm ci --offline --cache .npm-cache`：实测通过，139个包安装；缓存已从复制时3.7GB裁减至约51MB，没有修改其他项目或全局缓存。
- `npm run test:e2e`：1项失败（环境端口权限），不是业务验收通过。

## 计算性能

[benchmark.json](../artifacts/benchmark.json)：本机Node 26.10.0，1000任务、999条FS链，排期38.46ms，CPM32.92ms，关键任务1000个。单次运行，仅说明该网络和本机计算层耗时；未测浏览器FPS、内存压力、触摸设备或交互长尾。

## 实际导出与视觉检查

样张通过生产 `renderChart` / `createPdf` 生成，使用Sharp执行Node侧PNG光栅化。PDF由同一分页算法和jsPDF生成，PDFKit渲染供审查。**这些是导出样张，不是界面截图，也不证明浏览器Canvas/下载路径已通过。**

- [完整SVG](../artifacts/demo-gantt.svg)
- [完整PNG](../artifacts/demo-gantt.png)
- [A3横向分页PDF](../artifacts/demo-gantt.pdf)
- [路线图PNG](../artifacts/demo-roadmap.png)
- PDF页面渲染：`artifacts/pdf-page-1.png`、`pdf-page-2.png`。

已修复导出首月标签重叠、编号XML转义、分页时间范围不一致、整图Canvas先于PDF分页导致超长项目风险。任务按固定行高输出；PDF每页复用完整项目时间轴，并均衡分配行数。标题、图例和页码真实生成。

真实界面1440×900截图未取得，`artifacts/screenshots/`不放占位图片。

## 评审后修复

独立只读评审发现并修复：里程碑不能有子任务，聚合后再次验证；排期和CPM零工期边界一致；项目编号正确转义；写队列按项目绑定并保留失败工作稿；日历复选值同步捕获；成对日期清除；连接起点避免提交自环。数据与保存问题有对应自动化回归；指针/焦点细节仍需浏览器验证。

## 已知限制与后续

1. 首要后续是解除执行环境限制后的真实浏览器全流程、1440×900界面审查和修复。当前不能承诺成熟产品级交互质量。
2. 原生Excel `.xlsx`、Markdown表格解析、无表头多行粘贴尚未实现。CSV不包含完整依赖/基线，完整往返用JSON。
3. 批量编辑目前是负责人/状态；日期批量、单列宽度拖动、列配置持久化、完整快捷键范围选择需后续增强。
4. 路线图保留阶段/里程碑；无独立交付物轨道。三种密度/显示模板不改项目数据，但尚未做每种模板的浏览器视觉验收。
5. 日历可切月份与首周；不是完整任意周导航。资源视图有重叠检查，无按日热力图或容量平衡；不称为P1完整资源视图。
6. 可保存多个基线；画布比较最新基线，尚无任意历史基线选择器。计划/实际字段已保存，全面偏差报表未完成。
7. PDF为高分辨率图片分页，SVG是矢量；跨页的依赖端点不会连接到另一页。超长PNG受浏览器Canvas上限限制，应改用SVG/PDF。
8. 无跨窗口实时订阅；并发编辑用修订号拒绝覆盖。Service Worker缓存不等于停服务后的完整编辑能力。浏览器本地草稿不替代SQLite备份。
9. 多项目统计尚无完整Portfolio、S曲线、风险登记、变更审批和AI建议，P2未实施。
10. 目录开始时为空，未发现Git仓库和origin/dev，未伪造上游分支、提交或PR，也未发布到公网。

## 交付入口

启动：[start.sh](../start.sh)。手册：[README.md](../README.md)。演示：[ai-enterprise-platform.json](../examples/ai-enterprise-platform.json)。数据契约：[plandesk-v1.schema.json](../examples/plandesk-v1.schema.json)。架构：[ARCHITECTURE.md](ARCHITECTURE.md)。
