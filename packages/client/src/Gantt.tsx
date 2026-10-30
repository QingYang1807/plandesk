import { useRef, useState } from "react";
import type { Plan, Task } from "@plandesk/schema";
import type { Row } from "./model";
import {
  day,
  date,
  plus,
  statusNames,
  phaseColors,
  today,
  workDuration,
  axisBands,
} from "./model";
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Diamond,
  Flag,
} from "lucide-react";
type Props = {
  plan: Plan;
  rows: Row[];
  selected: string[];
  select: (id: string, multi?: boolean) => void;
  update: (id: string, patch: Partial<Task>) => void;
  open: (id: string) => void;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  scale: string;
  density: string;
  critical: Set<string>;
  showCritical: boolean;
  showBaseline: boolean;
  showDeps: boolean;
  tableWidth: number;
  hidden: boolean;
  onIndent: (ids: string[], n: number) => void;
  onAdd: (parent?: string | null, after?: string) => void;
  onMove: (id: string, target: string, child: boolean) => void;
  onDependency: (from: string, to: string) => void;
  focus: number;
  search: string;
  columns: string[];
};
export function Gantt(p: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    days: number;
    mode: string;
  } | null>(null);
  const [connect, setConnect] = useState<string | null>(null);
  const rowH =
    p.density === "Compact" ? 34 : p.density === "Executive" ? 54 : 44;
  const unit = (
    { 日: 30, 周: 15, 月: 6, 季度: 2.7, 年: 1.2 } as Record<string, number>
  )[p.scale];
  const starts = p.rows.flatMap((t) => (t.start ? [day(t.start)] : []));
  const ends = p.rows.flatMap((t) => (t.end ? [day(t.end)] : []));
  const start = Math.min(day(p.plan.project.start), ...starts) - 3;
  const end = Math.max(start + 30, ...ends) + 10;
  const width = Math.max(800, (end - start + 1) * unit);
  const height = p.rows.length * rowH;
  const left = p.hidden
    ? 0
    : Math.max(p.tableWidth, 238 + p.columns.length * 88);
  const indexStart = Math.max(0, Math.floor((scrollY - 64) / rowH) - 5);
  const visible = p.rows.slice(
    indexStart,
    indexStart + Math.ceil(900 / rowH) + 10,
  );
  const ancestors = new Map(p.rows.map((t) => [t.id, t]));
  const phase = (t: Row) => {
    let v = t;
    while (v.parentId && ancestors.has(v.parentId))
      v = ancestors.get(v.parentId)!;
    return p.rows.filter((t) => !t.parentId).findIndex((r) => r.id === v.id);
  };
  const color = (t: Row) =>
    p.showCritical && p.critical.has(t.id)
      ? "#cf6c6c"
      : t.status === "done"
        ? "#7da596"
        : phaseColors[Math.max(0, phase(t)) % phaseColors.length];
  const x = (s: string) => Math.round((day(s) - start) * unit);
  const positions = new Map(
    p.rows.map((t, i) => [
      t.id,
      { i, x: t.start ? x(t.start) : 0, end: t.end ? x(t.end) + unit : 0 },
    ]),
  );
  const bands = axisBands(start, end, p.scale);
  function pointer(e: React.PointerEvent, id: string, mode: string) {
    e.stopPropagation();
    if (mode === "connect") {
      setConnect(id);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, x: e.clientX, days: 0, mode });
    p.select(id);
  }
  function finish(e: React.PointerEvent) {
    if (!drag) return;
    const t = p.rows.find((t) => t.id === drag.id)!;
    if (drag.days && t.start && t.end) {
      const patch =
        drag.mode === "end"
          ? { end: plus(t.end, drag.days) }
          : drag.mode === "start"
            ? { start: plus(t.start, drag.days) }
            : { start: plus(t.start, drag.days), end: plus(t.end, drag.days) };
      p.update(t.id, patch);
    }
    setDrag(null);
    e.stopPropagation();
  }
  function locate(target: string) {
    const t =
      target === "today"
        ? today()
        : p.rows.find((t) => t.id === p.selected[0])?.start;
    if (!t || !scroll.current) return;
    scroll.current.scrollTo({
      left: Math.max(0, x(t) - 150),
      behavior: "smooth",
    });
  }
  return (
    <div className="gantt-wrap">
      <div className="chart-meta">
        <span>
          <i className="dot" /> 工作日历 ·{" "}
          {p.plan.calendar.weekdays.map((d) => "日一二三四五六"[d]).join("、")}{" "}
          <small>日期包含首尾 · 摘要自动聚合</small>
        </span>
        <div>
          <button onClick={() => locate("today")}>今天</button>
          <button onClick={() => locate("selected")}>定位选中</button>
          <span>{p.rows.length} 项</span>
        </div>
      </div>
      <div
        className="gantt-scroll"
        ref={scroll}
        onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}
        key={p.focus}
      >
        <div className="sheet" style={{ width: left + width }}>
          <div
            className="task-table"
            style={{ width: left, display: p.hidden ? "none" : undefined }}
          >
            <div
              className="table-head"
              style={{
                gridTemplateColumns: `58px minmax(180px,1fr) ${p.columns.map(() => "88px").join(" ")}`,
              }}
            >
              <span>WBS</span>
              <span>任务名称</span>
              {p.columns.map((c) => (
                <span key={c}>
                  {
                    (
                      {
                        owner: "负责人",
                        start: "开始日期",
                        end: "结束日期",
                        progress: "进度",
                        status: "状态",
                        duration: "工期",
                      } as Record<string, string>
                    )[c]
                  }
                </span>
              ))}
            </div>
            <div style={{ height, position: "relative" }}>
              {visible.map((t, vi) => {
                const idx = indexStart + vi;
                const parent = p.plan.tasks.some((a) => a.parentId === t.id);
                return (
                  <div
                    role="row"
                    data-task={t.id}
                    className={`task-row ${p.selected.includes(t.id) ? "selected" : ""} ${parent ? "summary" : ""}`}
                    key={t.id}
                    style={{
                      height: rowH,
                      top: idx * rowH,
                      gridTemplateColumns: `58px minmax(180px,1fr) ${p.columns.map(() => "88px").join(" ")}`,
                    }}
                    onClick={(e) =>
                      p.select(t.id, e.metaKey || e.ctrlKey || e.shiftKey)
                    }
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/task", t.id)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/task");
                      if (id && id !== t.id) p.onMove(id, t.id, e.altKey);
                    }}
                  >
                    <span className="wbs-num">{t.wbs}</span>
                    <div
                      className="task-name"
                      style={{ paddingLeft: 8 + t.depth * 17 }}
                    >
                      {parent ? (
                        <button
                          className="collapse"
                          aria-label={"折叠 " + t.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            p.toggle(t.id);
                          }}
                        >
                          {p.collapsed.has(t.id) ? (
                            <ChevronRight size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )}
                        </button>
                      ) : (
                        <span className="node-icon">
                          {t.type === "milestone" ? (
                            <Diamond size={11} />
                          ) : t.type === "review" ? (
                            <Flag size={11} />
                          ) : (
                            <GripVertical size={10} />
                          )}
                        </span>
                      )}
                      <input
                        aria-label={"任务名称 " + t.name}
                        key={t.name}
                        defaultValue={t.name}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== t.name)
                            p.update(t.id, { name: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                            p.onAdd(t.parentId, t.id);
                          }
                          if (e.key === "Tab") {
                            e.preventDefault();
                            p.onIndent(
                              p.selected.includes(t.id) ? p.selected : [t.id],
                              e.shiftKey ? -1 : 1,
                            );
                          }
                        }}
                        onDoubleClick={() => p.open(t.id)}
                        title={t.name}
                      />
                      <button
                        className="detail-trigger"
                        aria-label={"详情 " + t.name}
                        onClick={() => p.open(t.id)}
                      >
                        ↗
                      </button>
                    </div>
                    {p.columns.map((c) => (
                      <div className="cell" key={c}>
                        {c === "start" || c === "end" ? (
                          <input
                            aria-label={c + " " + t.name}
                            type="date"
                            defaultValue={t[c] ?? ""}
                            key={t[c]}
                            disabled={parent}
                            onBlur={(e) => {
                              if (e.target.value !== t[c])
                                p.update(t.id, {
                                  [c]: e.target.value || null,
                                  ...(!e.target.value ||
                                  !t.start ||
                                  !t.end ||
                                  t.type === "milestone"
                                    ? {
                                        start: e.target.value || null,
                                        end: e.target.value || null,
                                      }
                                    : {}),
                                });
                            }}
                          />
                        ) : c === "owner" ? (
                          <input
                            aria-label={"负责人 " + t.name}
                            defaultValue={t.owner}
                            key={t.owner}
                            placeholder="未分配"
                            onBlur={(e) =>
                              e.target.value !== t.owner &&
                              p.update(t.id, { owner: e.target.value })
                            }
                          />
                        ) : c === "progress" ? (
                          <label className="progress-cell">
                            <span
                              style={{
                                width: t.progress * 0.35,
                                background: color(t),
                              }}
                            />
                            <input
                              aria-label={"进度 " + t.name}
                              type="number"
                              min="0"
                              max="100"
                              defaultValue={t.progress}
                              key={t.progress}
                              disabled={parent}
                              onBlur={(e) =>
                                Number(e.target.value) !== t.progress &&
                                p.update(t.id, {
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
                            %
                          </label>
                        ) : c === "status" ? (
                          <select
                            aria-label={"状态 " + t.name}
                            value={t.status}
                            disabled={parent}
                            onChange={(e) =>
                              p.update(t.id, {
                                status: e.target.value as Task["status"],
                                ...(e.target.value === "done"
                                  ? { progress: 100 }
                                  : {}),
                              })
                            }
                          >
                            {Object.entries(statusNames).map(([v, n]) => (
                              <option key={v} value={v}>
                                {n}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{workDuration(p.plan, t) ?? "—"} 工作日</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="timeline" style={{ width }}>
            <div className="timeline-head" style={{ width }}>
              <div className="month-header">
                {bands.top.map((b) => (
                  <span
                    key={b.key}
                    style={{
                      left: (b.start - start) * unit,
                      width: (b.end - b.start + 1) * unit,
                    }}
                  >
                    {(b.end - b.start + 1) * unit > 35 ? b.label : ""}
                  </span>
                ))}
              </div>
              <div className="tick-header">
                {bands.bottom.map((b) => (
                  <span
                    key={b.key}
                    style={{
                      left: (b.start - start) * unit,
                      width: (b.end - b.start + 1) * unit,
                    }}
                  >
                    {(b.end - b.start + 1) * unit > 20 ? b.label : ""}
                  </span>
                ))}
              </div>
            </div>
            <svg
              className="timeline-svg"
              width={width}
              height={height}
              onPointerMove={(e) => {
                if (drag)
                  setDrag({
                    ...drag,
                    days: Math.round((e.clientX - drag.x) / unit),
                  });
              }}
              onPointerUp={finish}
            >
              <defs>
                <pattern
                  id="grid"
                  width={unit * 7}
                  height={rowH}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M 0 ${rowH} H ${unit * 7} M 0 0 V ${rowH}`}
                    stroke="#e9edf3"
                    strokeWidth=".65"
                    fill="none"
                  />
                </pattern>
                <marker
                  id="dep-arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                >
                  <path
                    d="M0 0L5 2.5L0 5"
                    fill="none"
                    stroke="#9ca9bd"
                    strokeWidth="1"
                  />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {unit >= 6 &&
                Array.from({ length: end - start + 1 }, (_, i) =>
                  new Date(date(start + i)).getUTCDay() % 6 === 0 ? (
                    <rect
                      key={i}
                      x={i * unit}
                      width={unit}
                      height={height}
                      fill="#a9b7d4"
                      opacity=".06"
                    />
                  ) : null,
                )}
              {visible.map((t, vi) => {
                const i = vi + indexStart;
                const pos = positions.get(t.id)!;
                const active = drag?.id === t.id ? drag : null;
                const bx =
                  pos.x +
                  (active && active.mode !== "end" ? active.days * unit : 0);
                const bw = Math.max(
                  5,
                  pos.end -
                    pos.x +
                    (active?.mode === "end"
                      ? active.days * unit
                      : active?.mode === "start"
                        ? -active.days * unit
                        : 0),
                );
                const y = i * rowH + (rowH - 22) / 2;
                const parent = p.plan.tasks.some((a) => a.parentId === t.id);
                const baseline = p.plan.baseline
                  .at(-1)
                  ?.tasks.find((b) => b.id === t.id);
                return (
                  <g
                    key={t.id}
                    onClick={(e) => {
                      if (connect && connect !== t.id) {
                        p.onDependency(connect, t.id);
                        setConnect(null);
                        return;
                      }
                      p.select(t.id, e.metaKey);
                    }}
                    onDoubleClick={() => p.open(t.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      p.open(t.id);
                    }}
                  >
                    <rect
                      y={i * rowH}
                      width={width}
                      height={rowH}
                      fill={
                        p.selected.includes(t.id)
                          ? "#eef0ff"
                          : parent
                            ? "#f4f6fb"
                            : "transparent"
                      }
                    />
                    {!t.start ? (
                      <text x="20" y={y + 15} className="unscheduled">
                        尚未排期
                      </text>
                    ) : (
                      <>
                        <title>
                          {t.name} · {t.start} → {t.end} · {t.progress}% ·{" "}
                          {t.owner}
                        </title>
                        {p.showBaseline && baseline?.start && baseline.end && (
                          <rect
                            x={x(baseline.start)}
                            y={y + 26}
                            width={Math.max(
                              4,
                              x(baseline.end) - x(baseline.start) + unit,
                            )}
                            height="3"
                            rx="1"
                            fill="#b4bccb"
                          />
                        )}
                        {t.type === "milestone" ? (
                          <>
                            <path
                              d={`M${bx + unit / 2} ${y + 2}l9 9 -9 9 -9 -9z`}
                              fill={color(t)}
                              onPointerDown={(e) => pointer(e, t.id, "move")}
                            />
                            <text
                              x={bx + unit / 2 + 16}
                              y={y + 15}
                              className="milestone-label"
                            >
                              {t.name}
                            </text>
                          </>
                        ) : (
                          <>
                            <rect
                              data-bar={t.id}
                              x={bx}
                              y={parent ? y + 5 : y}
                              width={bw}
                              height={parent ? 12 : 22}
                              rx={parent ? 2 : 5}
                              fill={color(t)}
                              opacity={parent ? ".85" : ".19"}
                              stroke={
                                p.showCritical && p.critical.has(t.id)
                                  ? color(t)
                                  : "none"
                              }
                              onPointerDown={(e) =>
                                !parent && pointer(e, t.id, "move")
                              }
                            />
                            <rect
                              x={bx}
                              y={y}
                              width={(bw * t.progress) / 100}
                              height={parent ? 12 : 22}
                              rx="4"
                              fill={color(t)}
                              opacity=".63"
                              pointerEvents="none"
                            />
                            {parent ? (
                              <path
                                d={`M${bx} ${y + 8}v11l5 -6M${bx + bw} ${y + 8}v11l-5 -6`}
                                stroke={color(t)}
                                fill="none"
                              />
                            ) : (
                              <>
                                <rect
                                  data-resize={t.id}
                                  x={bx + bw - 6}
                                  y={y}
                                  width="7"
                                  height="22"
                                  fill="transparent"
                                  cursor="ew-resize"
                                  onPointerDown={(e) => pointer(e, t.id, "end")}
                                />
                                <rect
                                  x={bx - 1}
                                  y={y}
                                  width="6"
                                  height="22"
                                  fill="transparent"
                                  cursor="ew-resize"
                                  onPointerDown={(e) =>
                                    pointer(e, t.id, "start")
                                  }
                                />
                              </>
                            )}
                            {bw > 60 && (
                              <text
                                x={bx + 9}
                                y={y + 15}
                                className="bar-label"
                                pointerEvents="none"
                              >
                                {t.progress}%
                              </text>
                            )}
                            {!parent && (
                              <circle
                                data-connect={t.id}
                                cx={bx + bw + 5}
                                cy={y + 11}
                                r="4"
                                className="connector"
                                onPointerDown={(e) =>
                                  pointer(e, t.id, "connect")
                                }
                                onPointerUp={(e) => {
                                  e.stopPropagation();
                                  if (connect && connect !== t.id) {
                                    p.onDependency(connect, t.id);
                                    setConnect(null);
                                  }
                                }}
                              />
                            )}
                          </>
                        )}
                        {active && (
                          <g>
                            <rect
                              x={bx}
                              y={y - 26}
                              width="210"
                              height="21"
                              rx="4"
                              fill="#26314d"
                            />
                            <text
                              x={bx + 7}
                              y={y - 12}
                              fill="white"
                              fontSize="10"
                            >
                              {plus(
                                t.start,
                                active.mode === "end" ? 0 : active.days,
                              )}{" "}
                              →{" "}
                              {plus(
                                t.end!,
                                active.mode === "start" ? 0 : active.days,
                              )}{" "}
                              ({active.days > 0 ? "+" : ""}
                              {active.days}天)
                            </text>
                            <line
                              x1={bx}
                              x2={bx}
                              y1="0"
                              y2={height}
                              stroke="#5e6ad2"
                              strokeDasharray="3 3"
                            />
                          </g>
                        )}
                      </>
                    )}
                  </g>
                );
              })}
              {p.showDeps &&
                p.plan.dependencies.map((d) => {
                  const a = positions.get(d.from),
                    b = positions.get(d.to);
                  if (
                    !a ||
                    !b ||
                    !a.end ||
                    !b.end ||
                    Math.max(a.i, b.i) < indexStart ||
                    Math.min(a.i, b.i) > indexStart + visible.length
                  )
                    return null;
                  const sx = d.type[0] === "F" ? a.end : a.x;
                  const tx = d.type[1] === "F" ? b.end : b.x;
                  const sy = a.i * rowH + rowH / 2;
                  const ty = b.i * rowH + rowH / 2;
                  return (
                    <path
                      key={d.id}
                      d={`M${sx + 2} ${sy}H${sx + 10}V${ty - rowH / 2 + 4}H${tx - 9}V${ty}H${tx - 2}`}
                      fill="none"
                      stroke={
                        p.showCritical &&
                        p.critical.has(d.from) &&
                        p.critical.has(d.to)
                          ? "#c98888"
                          : "#9ca9bd"
                      }
                      strokeWidth="1"
                      opacity=".65"
                      markerEnd="url(#dep-arrow)"
                      pointerEvents="none"
                    />
                  );
                })}
              {day(today()) >= start && day(today()) <= end && (
                <g pointerEvents="none">
                  <line
                    x1={x(today()) + unit / 2}
                    x2={x(today()) + unit / 2}
                    y1="0"
                    y2={height}
                    stroke="#6874d9"
                    strokeDasharray="4 4"
                    opacity=".7"
                  />
                  <rect
                    x={x(today()) - 10}
                    y="0"
                    width="25"
                    height="15"
                    rx="3"
                    fill="#6874d9"
                  />
                  <text x={x(today()) - 7} y="11" fill="white" fontSize="9">
                    今天
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
      {connect && (
        <div className="connection-hint">
          点击目标任务或拖至其连接点以建立 FS 依赖{" "}
          <button onClick={() => setConnect(null)}>取消</button>
        </div>
      )}
      <div className="chart-legend">
        <span>
          <i style={{ background: "#6977cd" }} /> 阶段 / 任务
        </span>
        <span>◆ 里程碑</span>
        <span>
          <i style={{ background: "#7da596" }} /> 已完成
        </span>
        {p.showCritical && (
          <span>
            <i style={{ background: "#cf6c6c" }} /> 关键路径
          </span>
        )}
        <span className="push">
          拖动任务条调整日期 · 拖边缘调整工期 · Alt + 拖行改变层级
        </span>
      </div>
    </div>
  );
}
