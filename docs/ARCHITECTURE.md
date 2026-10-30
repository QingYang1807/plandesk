# 技术架构与排期约定

Schema → Core → Server；Schema → Client。Client 不导入 Core/Server 的运行时代码。客户端统一项目文档，各视图只做投影；排期、验证、WBS 修改通过 HTTP 进入 Core。API handler 使用标准 Request/Response，方便不监听端口也测试真实 API。

| 模块 | 文件 | 职责 |
|---|---|---|
| Schema | packages/schema/src/index.ts | Zod v1 数据契约、严格日期与 JSON Schema |
| Core | packages/core/src/index.ts | 工作日、聚合、树、依赖图、自动排期、CPM、CSV |
| Templates | packages/core/src/templates.ts | 六类模板、演示计划、交付物、AC |
| Persistence | packages/server/src/store.ts | SQLite WAL、事务、修订号、最近100个历史文档、原子恢复 |
| API | packages/server/src/api.ts | 输入边界、项目 CRUD、排期、导入、备份 |
| Server | packages/server/src/index.ts | 127.0.0.1:4318、静态站点、开发 Vite 中间件 |
| Client writer | packages/client/src/persistence.ts | 按项目绑定、串行写入、离线草稿、版本冲突 |
| UI | packages/client/src/App.tsx / Gantt.tsx / Views.tsx | 工作台、可编辑 WBS、SVG 时间轴、统一视图 |
| Export | packages/client/src/export.ts | 独立整图 SVG、PNG、固定时间范围的分页 PDF |

## 库评估

检查了 [Frappe Gantt 官方源码](https://github.com/frappe/gantt)、[MIT 许可证](https://github.com/frappe/gantt/blob/master/license.txt)。它提供现成甘特图交互与视图选项，适合快速嵌入独立图表。未执行该库的性能或完整依赖行为基准，不能把设计判断写成它不具备某项能力。

| 维度 | 采用独立 SVG 的原因 |
|---|---|
| 交互与双栏 | 原生编辑单元格、共享选中、相同排版行高与一个滚动容器 |
| 依赖 | 与服务器叶子 DAG 共用业务约束，按任务端点路由 SVG |
| 时间尺度 | 日/ISO 周/月/季度/年，严格日坐标，可直接调整标签 |
| 自定义视觉 | 阶段、里程碑、基线与语义色均可直接控制 |
| 1000任务 | 任务表仅挂载可见行；SVG 的任务条也按可见范围渲染；浏览器帧率尚未测量 |
| 导出 | 使用完整项目数据和独立 SVG，不依赖 DOM 可视区 |
| 维护成本 | 自有渲染增加维护成本，换取布局可控；依赖清单见 THIRD_PARTY_NOTICES.md |

采用 Node 标准 HTTP 与 [内置 SQLite](https://nodejs.org/api/sqlite.html)，减少独立数据库与原生 SQLite 包部署步骤。实际测试 Node 26.10.0。Node API 的具体稳定性随版本变化，交付以本机实测为准。

## 排期与 CPM

- 日期为 YYYY-MM-DD，内部 UTC 整数日，跨 DST 不使用本地毫秒差。展示区间包含首尾。
- 默认周一至周五为工作日；支持自定义周历与节假日。Lag/Lead 以工作日计。
- 普通任务工期 = 区间工作日数（排期至少1天）。里程碑工期0，日期相同，不能包含子任务。
- 计算网络使用左闭右开的工作日边界。普通任务完成边界为展示结束日期后的一个工作日；里程碑完成边界等于开始边界。
- FS: 后继开始不早于前序完成边界+Lag。因此一个普通任务结束于周五时，其 FS 里程碑在周一；里程碑的 FS 后继可在同一周一开始。
- SS/FF/SF 使用相同边界语义，SF 后继普通任务的展示结束可能在前序开始的前一个工作日。与 CPM 保持一致。
- 自动排期使用拓扑序和各入边约束的最大值，保持工期。没有前置依赖的日期保留。未排期任务不自动发明日期；后继已排期但前序未排期会报错。
- autoSchedule=false 表示锁定；依赖要求晚于锁定开始时整次排期拒绝，原文档不变。
- 父日期=min(child.start)/max(child.end)；父进度为所有叶子的工作日工期加权；未排期或零工期叶子使用权重1。项目完成率排除已取消叶子，采用相同权重。
- 只有叶子参与依赖。层级操作若使现有依赖指向摘要，操作会明确失败，需先移除相关依赖。
- CPM 包括所有已排期未取消叶子，支持四种类型及 Lag。显示 ES/EF/LS/LF/Total Float（从网络起点计工作日），不含资源约束、锁定日期和项目目标日期的约束分析。

## 导入、保存与并发

JSON 的顶层 dependencies 是依赖关系真源；任务内 dependencies 为前置任务 ID 投影。CSV 是表格交换格式，不承载基线或完整依赖属性；完整往返请使用 JSON。

服务验证原始和聚合后文档，非法日期、ID重复、无效父引用、依赖环被拒绝。SQLite 修订号防止多窗口静默覆盖；冲突需要导出草稿并刷新。写队列在调用时捕获项目 ID，切换视图和项目不会改变写入目标。网络错误保留项目内工作稿，下次保存包含之前未保存的修改。浏览器 localStorage 也保留草稿，恢复操作是显式的。

应用静态壳与读请求由 Service Worker 缓存；本机服务运行时无需互联网。服务停止时可以查看已缓存数据，部分结构化操作依赖 Core 服务，不能承诺完整离线编辑。新版本 Service Worker 会更新应用壳。
