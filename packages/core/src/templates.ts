import { planSchema, taskSchema } from "@plandesk/schema";
import { addWork, aggregate, schedule } from "./index";
export const templates = [
  "软件产品完整生命周期",
  "Web / SaaS 产品研发",
  "AI Agent 应用研发",
  "数据平台 / 数据工程项目",
  "系统架构升级与迁移",
  "空白项目",
];
const stages = [
  [
    "项目启动",
    [
      "项目背景与现状调研",
      "项目目标与范围定义",
      "干系人识别与治理机制",
      "立项评审",
    ],
  ],
  [
    "需求分析",
    [
      "业务流程与用户访谈",
      "核心场景与需求优先级",
      "PRD 与验收标准编写",
      "需求基线评审",
    ],
  ],
  [
    "架构与技术方案",
    [
      "系统上下文与架构设计",
      "模型选型与技术验证",
      "安全与权限架构",
      "架构方案评审",
    ],
  ],
  [
    "详细设计",
    [
      "领域模型与数据设计",
      "API 契约与集成设计",
      "交互原型与设计系统",
      "详细设计评审",
    ],
  ],
  [
    "研发实施",
    [
      "身份与租户基础能力",
      "知识库与检索增强",
      "Agent 编排与工具集成",
      "工作台前端开发",
      "系统集成联调",
    ],
  ],
  [
    "集成测试",
    [
      "功能与契约测试",
      "模型效果与数据质量评测",
      "性能与安全测试",
      "缺陷修复与回归",
    ],
  ],
  ["业务验收", ["试点数据准备", "用户验收测试 UAT", "上线准入评审"]],
  ["发布上线", ["生产部署与回滚演练", "灰度发布与监控", "正式上线"]],
  [
    "运营与持续迭代",
    ["运行指标与反馈分析", "迭代需求与优先级", "版本复盘与交付归档"],
  ],
] as const;
export function createPlan(
  name: string,
  start: string,
  template = templates[0],
  demo = false,
) {
  const p = planSchema.parse({
    schemaVersion: 1,
    project: {
      id: crypto.randomUUID(),
      name,
      start,
      code: demo ? "AI-2026-001" : "PRJ-" + Date.now().toString().slice(-6),
      owner: "青阳",
      description: demo
        ? "构建可信赖的企业 AI 应用底座，贯通知识、Agent 与业务系统。"
        : "",
      demo,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  });
  if (template === templates[5]) return p;
  const members = ["青阳", "林悦", "陈序", "周舟", "许宁"];
  let cursor = start;
  let previous = "";
  let index = 0;
  stages.forEach(([stage, names], s) => {
    const parent = taskSchema.parse({
      id: crypto.randomUUID(),
      name: stage,
      type: "phase",
      order: index++,
      owner: members[s % members.length],
      phase: stage,
    });
    p.tasks.push(parent);
    const group =
      s === 4
        ? taskSchema.parse({
            id: crypto.randomUUID(),
            name: template.includes("数据")
              ? "数据服务与研发工作包"
              : "平台核心能力",
            type: "phase",
            parentId: parent.id,
            order: index++,
            phase: stage,
          })
        : null;
    if (group) p.tasks.push(group);
    const variants: Record<string, Record<number, string[]>> = {
      软件产品完整生命周期: {
        2: [
          "系统上下文与架构设计",
          "关键技术选型与验证",
          "安全与权限架构",
          "架构方案评审",
        ],
        4: [
          "身份与权限基础能力",
          "核心业务服务开发",
          "API 与外部系统集成",
          "产品工作台前端开发",
          "系统集成联调",
        ],
        5: [
          "功能与契约测试",
          "兼容性与数据质量验证",
          "性能与安全测试",
          "缺陷修复与回归",
        ],
      },
      "Web / SaaS 产品研发": {
        2: [
          "多租户系统架构设计",
          "关键技术与容量验证",
          "安全与权限架构",
          "架构方案评审",
        ],
        4: [
          "账号与租户基础服务",
          "订阅与计费业务服务",
          "开放 API 与集成开发",
          "产品工作台前端开发",
          "系统集成联调",
        ],
      },
      "数据平台 / 数据工程项目": {
        1: [
          "数据源盘点与业务访谈",
          "数据契约与指标口径",
          "数据治理需求与验收标准",
          "需求基线评审",
        ],
        2: [
          "批流一体平台架构",
          "计算存储技术验证",
          "数据安全与权限设计",
          "架构方案评审",
        ],
        3: [
          "分层模型与主题域设计",
          "调度 DAG 与数据接口设计",
          "数据质量规则设计",
          "详细设计评审",
        ],
        4: [
          "数据采集与 CDC 管道",
          "数据清洗与转换任务",
          "数仓模型与质量校验",
          "自助分析与数据门户",
          "端到端链路联调",
        ],
        5: [
          "数据完整性与一致性测试",
          "质量规则与指标核对",
          "容量与故障恢复测试",
          "缺陷修复与回归",
        ],
      },
      系统架构升级与迁移: {
        0: [
          "现有系统与资产盘点",
          "升级目标与范围确认",
          "迁移治理与责任分工",
          "立项评审",
        ],
        1: [
          "业务依赖与接口盘点",
          "兼容性与停机窗口确认",
          "迁移验收与回滚标准",
          "需求基线评审",
        ],
        2: [
          "目标架构与迁移策略",
          "兼容性技术验证",
          "双运行与回滚架构",
          "架构方案评审",
        ],
        3: [
          "数据映射与转换设计",
          "流量切换与监控设计",
          "演练方案与检查清单",
          "详细设计评审",
        ],
        4: [
          "目标基础设施准备",
          "数据回填与一致性工具",
          "服务兼容与双写开发",
          "客户端适配与灰度能力",
          "迁移集成联调",
        ],
        5: [
          "数据对账与业务回归",
          "全量迁移演练",
          "容量与回滚演练",
          "缺陷修复与回归",
        ],
        7: ["生产变更与回滚演练", "灰度流量切换与观测", "正式迁移完成"],
        8: ["稳定性观察与反馈", "旧系统退役计划", "迁移复盘与交付归档"],
      },
    };
    const scenario = demo ? names : (variants[template]?.[s] ?? names);
    const gate = previous;
    const parallel: string[] = [];
    scenario.forEach((raw, j) => {
      const milestone = j === names.length - 1 && s !== 4 && s !== 8;
      const name = raw;
      const length = milestone ? 1 : s === 4 ? 8 + j * 2 : 2 + (j % 3);
      const end = addWork(cursor, length - 1, p.calendar);
      const task = taskSchema.parse({
        id: crypto.randomUUID(),
        name,
        parentId: group?.id ?? parent.id,
        order: index++,
        type: milestone
          ? "milestone"
          : name.includes("评审")
            ? "review"
            : "task",
        phase: stage,
        start: cursor,
        end,
        owner: members[(s + j) % members.length],
        estimate: milestone ? 0 : length * 6,
        progress: demo
          ? s < 2
            ? 100
            : s === 2
              ? j < 2
                ? 100
                : j === 2
                  ? 55
                  : 0
              : s === 3 && j === 0
                ? 30
                : 0
          : 0,
        status: demo
          ? s < 2
            ? "done"
            : s === 2
              ? j < 2
                ? "done"
                : j === 2
                  ? "doing"
                  : "todo"
              : s === 3 && j === 0
                ? "doing"
                : "todo"
          : "todo",
        priority: j === 0 ? "high" : "medium",
        deliverables: milestone
          ? "评审纪要、决策记录、待办闭环清单"
          : /PRD|需求|范围/.test(name)
            ? "需求文档、用户故事与可追溯验收清单"
            : /检索|知识库/.test(name)
              ? "知识入库流水线、检索 API、检索评测集与报告"
              : /回滚|演练|迁移/.test(name)
                ? "迁移与回滚手册、演练记录、数据对账报告"
                : /测试|评测|回归/.test(name)
                  ? "测试用例、执行记录、缺陷报告与回归证据"
                  : /开发|服务|集成/.test(name)
                    ? "可运行代码、接口文档、自动化测试与构建产物"
                    : name + "文档、设计决策与评审记录",
        acceptanceCriteria: milestone
          ? "必要干系人完成评审；阻断项关闭或经批准处置；决策与责任人归档。"
          : /检索|知识库/.test(name)
            ? "评审后的测试集可复现运行；召回质量和延迟有测量记录；权限过滤与溯源通过验收。"
            : /测试|评测|回归/.test(name)
              ? "关键场景覆盖并记录执行结果；阻断缺陷关闭；遗留风险与负责人明确。"
              : /回滚|迁移|演练/.test(name)
                ? "演练环境完成切换与回滚；数据一致性校验通过；失败处置手册可执行。"
                : "成果符合已评审范围；自动化或人工验证证据齐全；评审意见闭环并归档。",
        risk: s === 4 && j === 2 ? "外部系统接口需提前完成联调确认。" : "",
      });
      p.tasks.push(task);
      const predecessors =
        s === 4 ? (j === names.length - 1 ? parallel : [gate]) : [previous];
      predecessors.filter(Boolean).forEach((from) =>
        p.dependencies.push({
          id: crypto.randomUUID(),
          from,
          to: task.id,
          type: "FS",
          lag: 0,
        }),
      );
      if (s === 4 && j < names.length - 1) parallel.push(task.id);
      previous = task.id;
      cursor = addWork(end, milestone ? 0 : 1, p.calendar);
    });
  });
  const result = aggregate(schedule(p));
  result.project.target =
    result.tasks
      .map((t) => t.end)
      .filter((v): v is string => !!v)
      .sort()
      .at(-1) ?? null;
  return result;
}
