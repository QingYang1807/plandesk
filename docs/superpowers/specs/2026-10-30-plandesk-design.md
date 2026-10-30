# PlanDesk design
用户已提供完整产品规格并授权自主选择和实施。优先 P0；只报告真实验证的能力。

## Decisions
React/TypeScript/Vite 客户端；Fastify loopback 服务；Node SQLite 本地数据库，事务写入项目文档和版本快照。Schema 独立，Core 仅依赖 Schema，Server 依赖两者，Client 不导入 Core/Server，通过 HTTP 请求排期与 WBS 变换。
Frappe Gantt (MIT, https://github.com/frappe/gantt) 可快速显示时间条，但双栏可编辑表、统一行虚拟化、独立汇报输出需要额外控制，因此选择专用 SVG 渲染。React/Vite/Fastify/Zod/Lucide/Playwright/Vitest 的许可证保留于 node_modules，交付生成依赖清单。

## Date and planning semantics
日期为严格 YYYY-MM-DD，UTC 整数日进行运算，区间为开始结束均包含。普通任务工期至少一个工作日，里程碑零工期；周一到周五默认工作日，节假日可配置。FS 后继在前序结束后的工作日开始；Lag 为工作日，负数表示 Lead。父任务只聚合子任务的最小开始、最大结束和工期加权叶子进度，不能直接编辑聚合值。依赖仅允许叶子任务，避免摘要排期歧义。自动排期只处理可自动排期的任务，锁定任务冲突明确拒绝整次排期。未排期任务保留空日期。

## Data safety
每项目单一真源；服务保存前完整 Schema 与引用/环验证；SQLite WAL、乐观版本号、防止并发覆盖，自动保存错误可见并保留本地草稿。导入先预览再写入；演示项目与新项目独立 ID。浏览器可缓存应用壳和只读项目副本；离线写入先保存草稿，恢复后重试，冲突显式提示。

## UI
深色窄侧栏，浅灰画布，白色内容板；靛蓝主色，阶段蓝/青/紫有限色板，状态色具有一致语义。统一滚动容器固定左表和表头，右侧时间轴。Professional/Compact/Executive 仅改变展示。详情面板处理复杂字段。所有入口必须有真实行为。

## Verification
Core 的日期/WBS/依赖/排期/CPM/导入 roundtrip 单测；Server 用临时 SQLite 验证持久化/非法更新/版本冲突；Playwright 真浏览器创建、编辑、拖拽、依赖、跨视图、导出、刷新和导入，截图 1440x900。测试从 package 目录执行。无 Bun 时使用 npm 等价脚本；本项目无上游 origin/dev，不能伪造分支基础。
