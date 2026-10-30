import { useState } from "react";
import type { Plan, Task } from "@plandesk/schema";
import { X, Trash2 } from "lucide-react";
import { rowsOf, statusNames, typeNames, day } from "./model";
type Critical = {
  id: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  critical: boolean;
};
export function TaskPanel({
  task,
  plan,
  critical,
  close,
  update,
  dependency,
  removeDependency,
  remove,
}: {
  task: Task;
  plan: Plan;
  critical?: Critical;
  close: () => void;
  update: (patch: Partial<Task>) => void;
  dependency: (from: string, to: string, type?: string, lag?: number) => void;
  removeDependency: (id: string) => void;
  remove: () => void;
}) {
  const [pred, setPred] = useState("");
  const [depType, setDepType] = useState("FS");
  const [lag, setLag] = useState(0);
  const parent = plan.tasks.some((t) => t.parentId === task.id);
  const base = plan.baseline.at(-1)?.tasks.find((t) => t.id === task.id);
  return (
    <aside className="detail-panel" key={task.id}>
      <header>
        <span className="eyebrow">TASK DETAILS</span>
        <button aria-label="关闭详情" onClick={close}>
          <X size={18} />
        </button>
      </header>
      <div className="detail-content">
        <span className="badge">
          {typeNames[task.type]} ·{" "}
          {rowsOf(plan).find((t) => t.id === task.id)?.wbs}
        </span>
        <input
          className="detail-title"
          aria-label="详情任务名称"
          defaultValue={task.name}
          key={task.name}
          onBlur={(e) =>
            e.target.value !== task.name && update({ name: e.target.value })
          }
        />
        <div className="form-grid">
          <label>
            任务类型
            <select
              value={task.type}
              disabled={parent}
              onChange={(e) =>
                update({
                  type: e.target.value as Task["type"],
                  ...(e.target.value === "milestone"
                    ? { end: task.start }
                    : {}),
                })
              }
            >
              {Object.entries(typeNames).map(([s, n]) => (
                <option value={s} key={s}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            负责人
            <input
              defaultValue={task.owner}
              key={task.owner}
              onBlur={(e) =>
                e.target.value !== task.owner &&
                update({ owner: e.target.value })
              }
            />
          </label>
          <label>
            状态
            <select
              value={task.status}
              disabled={parent}
              onChange={(e) =>
                update({
                  status: e.target.value as Task["status"],
                  ...(e.target.value === "done" ? { progress: 100 } : {}),
                })
              }
            >
              {Object.entries(statusNames).map(([s, n]) => (
                <option value={s} key={s}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            优先级
            <select
              value={task.priority}
              onChange={(e) =>
                update({ priority: e.target.value as Task["priority"] })
              }
            >
              {["low", "medium", "high", "urgent"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            计划开始
            <input
              aria-label="详情计划开始"
              type="date"
              defaultValue={task.start ?? ""}
              disabled={parent}
              key={task.start}
              onBlur={(e) => {
                if (e.target.value !== task.start)
                  update({
                    start: e.target.value || null,
                    ...(!e.target.value ||
                    !task.end ||
                    task.type === "milestone"
                      ? { end: e.target.value || null }
                      : {}),
                  });
              }}
            />
          </label>
          <label>
            计划结束
            <input
              aria-label="详情计划结束"
              type="date"
              defaultValue={task.end ?? ""}
              disabled={parent}
              key={task.end}
              onBlur={(e) => {
                if (e.target.value !== task.end)
                  update({
                    end: e.target.value || null,
                    ...(!e.target.value || task.type === "milestone"
                      ? { start: e.target.value || null }
                      : {}),
                  });
              }}
            />
          </label>
          <label>
            完成进度 %
            <input
              type="number"
              min="0"
              max="100"
              defaultValue={task.progress}
              key={task.progress}
              disabled={parent}
              onBlur={(e) =>
                Number(e.target.value) !== task.progress &&
                update({
                  progress: Number(e.target.value),
                  status:
                    Number(e.target.value) === 100
                      ? "done"
                      : Number(e.target.value) > 0
                        ? "doing"
                        : "todo",
                })
              }
            />
          </label>
          <label>
            估算工时 h
            <input
              type="number"
              min="0"
              defaultValue={task.estimate}
              onBlur={(e) => update({ estimate: Number(e.target.value) })}
            />
          </label>
          <label>
            实际开始
            <input
              type="date"
              defaultValue={task.actualStart ?? ""}
              onBlur={(e) => update({ actualStart: e.target.value || null })}
            />
          </label>
          <label>
            实际结束
            <input
              type="date"
              defaultValue={task.actualEnd ?? ""}
              onBlur={(e) => update({ actualEnd: e.target.value || null })}
            />
          </label>
          <label>
            实际工时 h
            <input
              type="number"
              min="0"
              defaultValue={task.actualHours}
              onBlur={(e) => update({ actualHours: Number(e.target.value) })}
            />
          </label>
        </div>
        {parent ? (
          <p className="info-box">
            摘要日期取子任务最早开始和最晚结束；进度按叶子任务工作日工期加权。
          </p>
        ) : (
          <label className="check-label">
            <input
              type="checkbox"
              checked={task.autoSchedule}
              onChange={(e) => update({ autoSchedule: e.target.checked })}
            />
            允许自动排期（取消将锁定日期）
          </label>
        )}
        {(
          [
            "description",
            "deliverables",
            "acceptanceCriteria",
            "risk",
            "notes",
          ] as const
        ).map((f) => (
          <label key={f}>
            {
              {
                description: "任务描述",
                deliverables: "交付物",
                acceptanceCriteria: "验收标准 AC",
                risk: "风险说明",
                notes: "备注",
              }[f]
            }
            <textarea
              defaultValue={task[f]}
              key={task.id + f + task[f]}
              onBlur={(e) =>
                e.target.value !== task[f] && update({ [f]: e.target.value })
              }
            />
          </label>
        ))}
        <div className="form-grid">
          <label>
            所属阶段
            <input
              defaultValue={task.phase}
              onBlur={(e) =>
                e.target.value !== task.phase &&
                update({ phase: e.target.value })
              }
            />
          </label>
          <label>
            标签（逗号分隔）
            <input
              defaultValue={task.tags.join(",")}
              onBlur={(e) =>
                update({
                  tags: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>
        <h3>前置依赖</h3>
        {plan.dependencies
          .filter((d) => d.to === task.id)
          .map((d) => (
            <div className="dependency-row" key={d.id}>
              <span>
                {plan.tasks.find((t) => t.id === d.from)?.name}
                <small>
                  {d.type} · Lag {d.lag} 工作日
                </small>
              </span>
              <button title="删除依赖" onClick={() => removeDependency(d.id)}>
                <X size={13} />
              </button>
            </div>
          ))}
        {!parent && (
          <>
            <select
              aria-label="前置任务"
              value={pred}
              onChange={(e) => setPred(e.target.value)}
            >
              <option value="">选择前置任务</option>
              {plan.tasks
                .filter(
                  (t) =>
                    t.id !== task.id &&
                    !plan.tasks.some((x) => x.parentId === t.id),
                )
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <div className="dependency-form">
              <select
                aria-label="依赖类型"
                value={depType}
                onChange={(e) => setDepType(e.target.value)}
              >
                {["FS", "SS", "FF", "SF"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <input
                aria-label="延迟工作日"
                type="number"
                value={lag}
                onChange={(e) => setLag(Number(e.target.value))}
              />
              <button
                disabled={!pred}
                onClick={() => {
                  dependency(pred, task.id, depType, lag);
                  setPred("");
                }}
              >
                添加依赖
              </button>
            </div>
          </>
        )}
        {critical && (
          <>
            <h3>CPM 排期分析</h3>
            <div className="cpm-grid">
              {Object.entries(critical)
                .filter(([k]) => ["es", "ef", "ls", "lf", "float"].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <small>{k.toUpperCase()}</small>
                    <strong>{String(v)}</strong>
                  </div>
                ))}
            </div>
            <small className="muted">
              从项目网络起点计工作日；
              {critical.critical
                ? "关键路径任务"
                : "浮动时间 " + critical.float + " 工作日"}
            </small>
          </>
        )}
        {base && (
          <div className="info-box">
            最新基线：{base.start ?? "未排期"} → {base.end ?? "—"}
            <br />
            完工偏差：
            {base.end && task.end ? day(task.end) - day(base.end) : "—"} 自然日
          </div>
        )}
        <button className="danger full" onClick={remove}>
          <Trash2 size={14} />
          删除任务
        </button>
      </div>
    </aside>
  );
}
