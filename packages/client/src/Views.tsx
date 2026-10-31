import { useState } from "react";
import type { Plan, Task } from "@plandesk/schema";
import {
  metrics,
  rowsOf,
  statusNames,
  typeNames,
  day,
  today,
  phaseColors,
  date,
} from "./model";
import {
  CheckCircle2,
  Flag,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  X,
} from "lucide-react";
type Props = {
  plan: Plan;
  open: (id: string) => void;
  update: (id: string, patch: Partial<Task>) => void;
  critical: {
    id: string;
    es: number;
    ef: number;
    ls: number;
    lf: number;
    float: number;
    critical: boolean;
  }[];
  filter: string;
};
export function Overview(p: Props) {
  const m = metrics(p.plan);
  const phases = rowsOf(p.plan).filter((t) => !t.parentId);
  return (
    <div className="overview view-pad">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PROJECT INSIGHTS</span>
          <h2>每一次推进，都有据可循。</h2>
          <p>基于当前计划实时计算，掌握进度、交付与风险。</p>
        </div>
        <span className="badge">
          {m.overdue.length ? "存在延期风险" : "计划健康"}
        </span>
      </div>
      <div className="metric-grid">
        {[
          ["整体完成率", m.progress + "%", CheckCircle2],
          ["已完成任务", `${m.done} / ${m.leaves.length}`, Flag],
          [
            "剩余自然日",
            m.end ? Math.max(0, day(m.end) - day(today())) : "—",
            Clock,
          ],
          ["逾期未完成", m.overdue.length, AlertTriangle],
        ].map(([n, v, Icon]) => {
          const I = Icon as typeof Flag;
          return (
            <div className="metric" key={String(n)}>
              <span>
                {String(n)}
                <I size={16} />
              </span>
              <strong>{String(v)}</strong>
              <small>来自当前项目真实任务</small>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>
            阶段进度 <small>工期加权聚合</small>
          </h3>
          {phases.map((t, i) => (
            <div className="phase-progress" key={t.id}>
              <span>{t.name}</span>
              <div>
                <i
                  style={{
                    width: t.progress + "%",
                    background: phaseColors[i % 9],
                  }}
                />
              </div>
              <strong>{t.progress}%</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>任务状态分布</h3>
          <div className="distribution">
            {Object.entries(statusNames).map(([s, n]) => {
              const count = m.leaves.filter((t) => t.status === s).length;
              return (
                <div key={s}>
                  <span className={"status-dot " + s} />
                  <span>{n}</span>
                  <strong>{count}</strong>
                  <small>
                    {Math.round((count / Math.max(1, m.leaves.length)) * 100)}%
                  </small>
                </div>
              );
            })}
          </div>
          <h3 className="space-top">进度记录</h3>
          {p.plan.history.length < 2 ? (
            <div className="honest-empty">
              还没有跨日历史记录。
              <br />
              持续维护计划后展示真实进度趋势。
            </div>
          ) : (
            <svg viewBox="0 0 500 110" className="trend">
              <path
                d={
                  "M" +
                  p.plan.history
                    .map(
                      (h, i) =>
                        `${20 + (i * 460) / (p.plan.history.length - 1)},${100 - h.progress * 0.8}`,
                    )
                    .join(" L")
                }
                fill="none"
                stroke="#6672cc"
                strokeWidth="3"
              />
              {p.plan.history.map((h, i) => (
                <g key={h.date}>
                  <circle
                    cx={20 + (i * 460) / (p.plan.history.length - 1)}
                    cy={100 - h.progress * 0.8}
                    r="3"
                    fill="#6672cc"
                  />
                  <title>
                    {h.date}: {h.progress}%
                  </title>
                </g>
              ))}
            </svg>
          )}
        </section>
        <section className="panel">
          <h3>
            关键里程碑 <small>{m.milestones.length} 个交付检查点</small>
          </h3>
          {m.milestones.map((t) => (
            <button
              className="milestone-row"
              key={t.id}
              onClick={() => p.open(t.id)}
            >
              <span
                className={"diamond " + (t.status === "done" ? "done" : "")}
              >
                ◆
              </span>
              <div>
                <strong>{t.name}</strong>
                <small>
                  {t.owner} · {t.start ?? "尚未排期"}
                </small>
              </div>
              <span className={"badge " + t.status}>
                {statusNames[t.status]}
              </span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </section>
        <section className="panel">
          <h3>风险与关键路径</h3>
          <div className="risk-note">
            <AlertTriangle size={16} />
            {m.overdue.length
              ? `${m.overdue.length} 个任务超过计划截止日，请确认实际进度。`
              : "当前无逾期未完成任务。"}
          </div>
          {m.leaves
            .filter((t) => t.risk)
            .map((t) => (
              <button
                className="risk-item"
                key={t.id}
                onClick={() => p.open(t.id)}
              >
                {t.name}
                <small>{t.risk}</small>
              </button>
            ))}
          <p className="muted">
            CPM 覆盖已排期叶子任务，支持 FS / SS / FF / SF 与
            Lag，不含资源平衡和日期锁定约束。
          </p>
          <div className="critical-chain">
            {p.critical
              .filter((t) => t.critical)
              .map((c) => (
                <button key={c.id} onClick={() => p.open(c.id)}>
                  {p.plan.tasks.find((t) => t.id === c.id)?.name}
                </button>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
export function Kanban(p: Props) {
  const tasks = metrics(p.plan).leaves.filter(
    (t) => !p.filter || t.name.includes(p.filter) || t.owner.includes(p.filter),
  );
  return (
    <div className="kanban view-pad">
      {Object.entries(statusNames).map(([s, n]) => (
        <section
          className="kanban-column"
          key={s}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/task");
            if (id)
              p.update(id, {
                status: s as Task["status"],
                progress:
                  s === "done"
                    ? 100
                    : s === "todo"
                      ? 0
                      : (p.plan.tasks.find((t) => t.id === id)?.progress ?? 0),
              });
          }}
        >
          <h3>
            <span className={"status-dot " + s} />
            {n}
            <small>{tasks.filter((t) => t.status === s).length}</small>
          </h3>
          {tasks
            .filter((t) => t.status === s)
            .map((t) => (
              <button
                className="kanban-card"
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                onClick={() => p.open(t.id)}
              >
                <span className="card-phase">
                  {t.phase || typeNames[t.type]}
                </span>
                <strong>{t.name}</strong>
                <p>
                  {t.start
                    ? `${t.start.slice(5)} → ${t.end?.slice(5)}`
                    : "尚未排期"}
                </p>
                <div className="mini-progress">
                  <i style={{ width: t.progress + "%" }} />
                </div>
                <footer>
                  <span className="avatar">{t.owner.slice(-1) || "?"}</span>
                  <span>{t.owner || "未分配"}</span>
                  <span className="push">{t.progress}%</span>
                </footer>
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}
export function CalendarView(
  p: Props & { create: (task: Pick<Task, "name" | "start" | "end">) => void },
) {
  const [anchor, setAnchor] = useState(p.plan.project.start.slice(0, 7));
  const [mode, setMode] = useState("month");
  const [selection, setSelection] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    start: string;
    end: string;
  } | null>(null);
  function shift(n: number) {
    const d = new Date(anchor + "-01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setAnchor(d.toISOString().slice(0, 7));
  }
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5)) - 1;
  const first = day(`${year}-${String(month + 1).padStart(2, "0")}-01`);
  const start = first - ((new Date(first * 86400000).getUTCDay() + 6) % 7);
  const range = selection ? [selection.start, selection.end].sort() : null;
  return (
    <div className="view-pad">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PROJECT CALENDAR</span>
          <h2>
            {year} 年 {month + 1} 月
          </h2>
          <p>点击日期创建任务，按住并滑过多个日期可创建跨日任务。</p>
        </div>
        <div className="check-row">
          <button onClick={() => shift(-1)}>← 上月</button>
          <button onClick={() => setAnchor(today().slice(0, 7))}>本月</button>
          <button onClick={() => shift(1)}>下月 →</button>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="month">月视图</option>
            <option value="week">首周视图</option>
          </select>
        </div>
      </div>
      <div
        className="calendar-grid"
        onPointerDown={(e) => {
          if (
            e.button !== 0 ||
            !e.isPrimary ||
            (e.target as HTMLElement).closest("[data-calendar-task]")
          )
            return;
          const d = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-calendar-date]",
          )?.dataset.calendarDate;
          if (!d) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setSelection({ start: d, end: d });
        }}
        onPointerMove={(e) => {
          if (!selection || !e.currentTarget.hasPointerCapture(e.pointerId))
            return;
          const cell = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-calendar-date]");
          if (cell?.dataset.calendarDate && e.currentTarget.contains(cell)) {
            const end = cell.dataset.calendarDate;
            setSelection({ ...selection, end });
          }
        }}
        onPointerUp={(e) => {
          if (!selection || !e.currentTarget.hasPointerCapture(e.pointerId))
            return;
          const cell = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-calendar-date]");
          if (cell?.dataset.calendarDate && e.currentTarget.contains(cell)) {
            const range = [selection.start, cell.dataset.calendarDate].sort();
            setDraft({ name: "", start: range[0], end: range[1] });
          }
          setSelection(null);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => setSelection(null)}
        onLostPointerCapture={() => setSelection(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setSelection(null);
          if (["Enter", " ", "Escape", "Tab"].includes(e.key))
            e.stopPropagation();
        }}
      >
        {["一", "二", "三", "四", "五", "六", "日"].map((n) => (
          <div className="weekday" key={n}>
            周{n}
          </div>
        ))}
        {Array.from({ length: mode === "week" ? 7 : 42 }, (_, i) => {
          const d = date(start + i);
          return (
            <div
              className={[
                "calendar-day",
                d === today() ? "current" : "",
                range && d >= range[0] && d <= range[1] ? "selected" : "",
                d.slice(0, 7) !== anchor ? "outside-month" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-calendar-date={d}
              key={d}
            >
              <button
                className="calendar-date"
                aria-label={`${d} 创建任务`}
                onClick={(e) => {
                  if (e.detail === 0) setDraft({ name: "", start: d, end: d });
                }}
              >
                <span>{Number(d.slice(8))}</span>
                <span className="calendar-add" aria-hidden="true">
                  +
                </span>
              </button>
              {p.plan.tasks
                .filter(
                  (t) => t.type !== "phase" && (t.start === d || t.end === d),
                )
                .map((t) => (
                  <button
                    data-calendar-task
                    key={t.id}
                    onClick={() => p.open(t.id)}
                  >
                    {t.type === "milestone"
                      ? "◆ "
                      : t.end === d
                        ? "截止 · "
                        : ""}
                    {t.name}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {draft && (
        <dialog
          className="modal calendar-dialog"
          aria-labelledby="calendar-create-title"
          ref={(node) => {
            if (node && !node.open) {
              node.showModal();
              node.querySelector("input")?.focus();
            }
          }}
          onCancel={(e) => {
            e.preventDefault();
            setDraft(null);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <header>
            <div>
              <span className="eyebrow">PROJECT CALENDAR</span>
              <h2 id="calendar-create-title">创建日历任务</h2>
            </div>
            <button aria-label="关闭创建任务" onClick={() => setDraft(null)}>
              <X size={19} />
            </button>
          </header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !draft.name.trim() ||
                !draft.start ||
                !draft.end ||
                draft.end < draft.start
              )
                return;
              p.create({ ...draft, name: draft.name.trim() });
              setDraft(null);
            }}
          >
            <label>
              任务名称
              <input
                autoFocus
                required
                value={draft.name}
                placeholder="输入任务名称"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                开始日期
                <input
                  required
                  type="date"
                  value={draft.start}
                  onChange={(e) =>
                    setDraft({ ...draft, start: e.target.value })
                  }
                />
              </label>
              <label>
                结束日期
                <input
                  required
                  type="date"
                  min={draft.start}
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setDraft(null)}>
                取消
              </button>
              <button
                className="primary"
                type="submit"
                disabled={
                  !draft.name.trim() ||
                  !draft.start ||
                  !draft.end ||
                  draft.end < draft.start
                }
              >
                创建任务
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </div>
  );
}
export function Resources(p: Props) {
  const tasks = metrics(p.plan).leaves;
  const owners = [...new Set(tasks.map((t) => t.owner || "未分配"))];
  return (
    <div className="view-pad">
      <div className="section-heading">
        <div>
          <span className="eyebrow">RESOURCE PLANNING</span>
          <h2>让每一份投入，都清晰可见。</h2>
          <p>重叠识别按计划日期计算，未自动执行资源平衡。</p>
        </div>
      </div>
      {owners.map((owner) => {
        const list = tasks.filter((t) => (t.owner || "未分配") === owner);
        const conflicts = list.flatMap((a, i) =>
          list
            .slice(i + 1)
            .filter(
              (b) =>
                a.start &&
                a.end &&
                b.start &&
                b.end &&
                a.start <= b.end &&
                b.start <= a.end,
            )
            .map((b) => [a, b]),
        );
        return (
          <section className="panel resource-panel" key={owner}>
            <h3>
              <span className="avatar">{owner.slice(-1)}</span>
              {owner}
              <small>
                {list.length} 项任务 · 估算{" "}
                {list.reduce((n, t) => n + t.estimate, 0)}h · 实际{" "}
                {list.reduce((n, t) => n + t.actualHours, 0)}h
              </small>
              {conflicts.length > 0 && (
                <span className="badge blocked">{conflicts.length} 组重叠</span>
              )}
            </h3>
            <div className="resource-tasks">
              {list.map((t) => (
                <button key={t.id} onClick={() => p.open(t.id)}>
                  <strong>{t.name}</strong>
                  <small>
                    {t.start ?? "未排期"} → {t.end ?? "—"}
                  </small>
                  <span>
                    {t.estimate}h · {t.progress}%
                  </span>
                </button>
              ))}
            </div>
            {conflicts.map(([a, b], i) => (
              <p className="risk-note" key={i}>
                重叠：{a.name} / {b.name}
              </p>
            ))}
          </section>
        );
      })}
    </div>
  );
}
