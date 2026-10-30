import { TaskPanel } from "./TaskPanel";
import { createWriter, WriteError } from "./persistence";
import { useEffect, useRef, useState } from "react";
import type { Plan, Task } from "@plandesk/schema";
import { taskSchema } from "@plandesk/schema";
import {
  LayoutDashboard,
  ChartNoAxesGantt,
  Layers,
  Route,
  Columns3,
  CalendarDays,
  Users,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowUpRight,
  Upload,
  Download,
  Settings2,
  Undo2,
  Redo2,
  Maximize2,
  PanelLeftClose,
  HelpCircle,
  Check,
  Copy,
  Archive,
  Trash2,
  X,
  Flag,
  GitBranch,
  Clock,
  FolderOpen,
  Command,
  MoreHorizontal,
} from "lucide-react";
import {
  api,
  download,
  rowsOf,
  metrics,
  statusNames,
  typeNames,
  today,
  plus,
  day,
} from "./model";
import { Gantt } from "./Gantt";
import { Overview, Kanban, CalendarView, Resources } from "./Views";
import { exportChart } from "./export";
import type { ExportOptions } from "./export";
const views = [
  ["gantt", "甘特图", ChartNoAxesGantt],
  ["wbs", "工作分解", Layers],
  ["roadmap", "路线图", Route],
  ["kanban", "看板", Columns3],
  ["calendar", "日历", CalendarDays],
  ["overview", "项目概览", LayoutDashboard],
  ["resource", "资源", Users],
] as const;
type Critical = {
  id: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  critical: boolean;
};
export function App() {
  const [projects, setProjects] = useState<Plan[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const current = useRef<Plan | null>(null);
  const records = useRef(new Map<string, Plan>());
  const [view, setView] = useState("gantt");
  const [selected, setSelected] = useState<string[]>([]);
  const pendingFocus = useRef<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [scale, setScale] = useState("周");
  const [density, setDensity] = useState("Professional");
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [critical, setCritical] = useState<Critical[]>([]);
  const [showCritical, setShowCritical] = useState(false);
  const [showDeps, setShowDeps] = useState(true);
  const [showBaseline, setShowBaseline] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [focus, setFocus] = useState(false);
  const [width, setWidth] = useState(800);
  const [columns, setColumns] = useState([
    "owner",
    "start",
    "end",
    "duration",
    "progress",
    "status",
  ]);
  const [auto, setAuto] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState(today());
  const [template, setTemplate] = useState("Web / SaaS 产品研发");
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [preview, setPreview] = useState<Plan | null>(null);
  const [backupPreview, setBackupPreview] = useState<Plan[]>([]);
  const [importMode, setImportMode] = useState("new");
  const [exportOpt, setExportOpt] = useState<ExportOptions>({
    title: "项目计划",
    subtitle: "项目计划与交付路线图",
    legend: true,
    dependencies: true,
    scale: 2,
    paper: "a3",
    margin: 12,
    background: "#ffffff",
  });
  const [exportScope, setExportScope] = useState("all");
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState("updated");
  const [writer] = useState(() =>
    createWriter(
      records.current,
      (p) => api<Plan>("projects/" + p.project.id, p, "PUT"),
      {
        put: (p) =>
          localStorage.setItem(
            "plandesk-draft-" + p.project.id,
            JSON.stringify(p),
          ),
        remove: (id) => localStorage.removeItem("plandesk-draft-" + id),
      },
    ),
  );
  const pendingWrites = useRef(0);
  const [unsaved, setUnsaved] = useState(new Set<string>());
  const undo = useRef<Plan[]>([]);
  const redo = useRef<Plan[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const refresh = () =>
    api<Plan[]>("projects").then((list) => {
      list.forEach((p) => records.current.set(p.project.id, p));
      setProjects(list);
      setConnected(true);
    });
  useEffect(() => {
    Promise.all([refresh(), api<string[]>("templates").then(setTemplates)])
      .then(() => setReady(true))
      .catch((e) => {
        setError(String(e));
        setConnected(false);
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const adopt = (p: Plan) => {
    records.current.set(p.project.id, p);
    current.current = p;
    setPlan(p);
    setProjects((list) =>
      list.some((x) => x.project.id === p.project.id)
        ? list.map((x) => (x.project.id === p.project.id ? p : x))
        : [p, ...list],
    );
    api<{ cpm: Critical[] }>("compute", p)
      .then((v) => {
        if (current.current?.project.id === p.project.id) setCritical(v.cpm);
      })
      .catch((e) => setError(String(e)));
  };
  function choose(input: Plan) {
    const p = records.current.get(input.project.id) ?? input;
    undo.current = [];
    redo.current = [];
    setUndoCount(0);
    setRedoCount(0);
    adopt(p);
    setProjects((list) => [
      p,
      ...list.filter((x) => x.project.id !== p.project.id),
    ]);
    setSelected([]);
    setDetail(null);
    setCollapsed(new Set());
    setQuery("");
    setOwnerFilter("");
    setStatusFilter("");
    setExportOpt((o) => ({ ...o, title: p.project.name }));
    localStorage.setItem("plandesk-recent", p.project.id);
  }
  function change(fn: (p: Plan) => Plan | Promise<Plan>, record = true) {
    const id = current.current?.project.id;
    if (!id) return;
    pendingWrites.current++;
    setSaving(true);
    setError("");
    writer
      .write(id, fn)
      .then(({ before, saved }) => {
        if (record && current.current?.project.id === id) {
          undo.current.push(before);
          undo.current = undo.current.slice(-60);
          redo.current = [];
        }
        if (current.current?.project.id === id) adopt(saved);
        else
          setProjects((list) =>
            list.map((p) => (p.project.id === id ? saved : p)),
          );
        setConnected(true);
        setUnsaved((old) => {
          const next = new Set(old);
          next.delete(id);
          return next;
        });
        setUndoCount(undo.current.length);
        setRedoCount(redo.current.length);
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : String(error));
        if (error instanceof WriteError && error.pending) setConnected(false);
        setUnsaved((old) => new Set([...old, id]));
        if (
          error instanceof WriteError &&
          error.pending &&
          current.current?.project.id === id
        ) {
          current.current = error.pending;
          setPlan(error.pending);
        }
      })
      .finally(() => {
        pendingWrites.current--;
        setSaving(pendingWrites.current > 0);
      });
  }
  function update(id: string, patch: Partial<Task>) {
    change(async (p) => {
      const parent = p.tasks.some((t) => t.parentId === id);
      if (
        parent &&
        ("start" in patch ||
          "end" in patch ||
          "progress" in patch ||
          "status" in patch)
      )
        throw Error("父任务日期和进度由子任务自动聚合，请编辑子任务。");
      p.tasks = p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
      return auto ? api<Plan>("schedule", p) : p;
    });
  }
  function add(parent: string | null = null, after?: string) {
    change((p) => {
      const id = crypto.randomUUID();
      const prev = p.tasks.find((t) => t.id === after);
      if (parent)
        setCollapsed((old) => {
          const next = new Set(old);
          next.delete(parent);
          return next;
        });
      p.tasks.push(
        taskSchema.parse({
          id,
          name: "新任务",
          parentId: parent,
          order: prev
            ? prev.order + 0.01
            : Math.max(0, ...p.tasks.map((t) => t.order)) + 1,
        }),
      );
      pendingFocus.current = id;
      setSelected([id]);
      setView("gantt");
      return p;
    });
  }
  function indent(ids: string[], direction: number) {
    change((p) => api<Plan>("indent", { plan: p, ids, direction }));
  }
  function dependency(from: string, to: string, type = "FS", lag = 0) {
    change(async (p) => {
      p.dependencies.push({
        id: crypto.randomUUID(),
        from,
        to,
        type: type as Plan["dependencies"][number]["type"],
        lag,
      });
      return auto ? api<Plan>("schedule", p) : p;
    });
    setNotice("依赖将在验证通过后保存");
  }
  function move(id: string, target: string, child: boolean) {
    change((p) => {
      const a = p.tasks.find((t) => t.id === id)!;
      const b = p.tasks.find((t) => t.id === target)!;
      a.parentId = child ? b.id : b.parentId;
      a.order = b.order + 0.01;
      return p;
    });
  }
  function history(direction: number) {
    const source = direction < 0 ? undo : redo;
    const dest = direction < 0 ? redo : undo;
    change((p) => {
      const snapshot = source.current.pop();
      if (!snapshot) return p;
      dest.current.push(p);
      return { ...snapshot, revision: p.revision };
    }, false);
  }
  const allRows = plan ? rowsOf(plan) : [];
  const filtered = allRows.filter((t) => {
    if (
      query &&
      !t.name.toLowerCase().includes(query.toLowerCase()) &&
      !t.owner.includes(query)
    )
      return false;
    if (ownerFilter && t.owner !== ownerFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });
  const visible = filtered.filter((t) => {
    let parent = t.parentId;
    while (parent) {
      if (collapsed.has(parent)) return false;
      parent = plan?.tasks.find((x) => x.id === parent)?.parentId ?? null;
    }
    return view === "roadmap"
      ? t.type === "phase" || t.type === "milestone"
      : density === "Executive"
        ? t.depth === 0 || t.type === "milestone"
        : true;
  });
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id || !plan) return;
    const index = visible.findIndex((t) => t.id === id);
    if (index < 0) return;
    const container = document.querySelector<HTMLDivElement>(".gantt-scroll");
    if (container) {
      container.scrollTop =
        index *
        (density === "Compact" ? 34 : density === "Executive" ? 54 : 44);
    }
    const timer = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-task="${id}"] .task-name input`,
      );
      if (input) {
        input.focus();
        input.select();
        pendingFocus.current = null;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [plan, visible.length]);
  const detailTask = plan?.tasks.find((t) => t.id === detail);
  const m = plan ? metrics(plan) : null;
  function remove(branch = true) {
    const ids = selected.length ? selected : detail ? [detail] : [];
    change((p) => {
      const removing = new Set(ids);
      if (branch) {
        let size = -1;
        while (size !== removing.size) {
          size = removing.size;
          p.tasks
            .filter((t) => t.parentId && removing.has(t.parentId))
            .forEach((t) => removing.add(t.id));
        }
      } else {
        const parents = new Map(p.tasks.map((t) => [t.id, t.parentId]));
        p.tasks = p.tasks.map((t) => {
          let parentId = t.parentId;
          while (parentId && removing.has(parentId))
            parentId = parents.get(parentId) ?? null;
          return { ...t, parentId };
        });
      }
      p.tasks = p.tasks.filter((t) => !removing.has(t.id));
      p.dependencies = p.dependencies.filter(
        (d) => !removing.has(d.from) && !removing.has(d.to),
      );
      return p;
    });
    setSelected([]);
    setDetail(null);
    setModal(null);
  }
  function copyBranch() {
    change((p) => {
      const set = new Set(selected);
      let size = -1;
      while (size !== set.size) {
        size = set.size;
        p.tasks
          .filter((t) => t.parentId && set.has(t.parentId))
          .forEach((t) => set.add(t.id));
      }
      const map = new Map([...set].map((id) => [id, crypto.randomUUID()]));
      p.tasks.push(
        ...p.tasks
          .filter((t) => set.has(t.id))
          .map((t) => ({
            ...t,
            id: map.get(t.id)!,
            parentId: t.parentId ? (map.get(t.parentId) ?? t.parentId) : null,
            order: t.order + 0.1,
            name: selected.includes(t.id) ? t.name + "（副本）" : t.name,
          })),
      );
      p.dependencies.push(
        ...p.dependencies
          .filter((d) => set.has(d.from) && set.has(d.to))
          .map((d) => ({
            ...d,
            id: crypto.randomUUID(),
            from: map.get(d.from)!,
            to: map.get(d.to)!,
          })),
      );
      return p;
    });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const input = (e.target as HTMLElement).closest("input,textarea,select");
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setModal("help");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        setNotice("当前编辑已提交，请查看右上角保存状态");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !input) {
        e.preventDefault();
        history(e.shiftKey ? 1 : -1);
      }
      if (e.key === "Delete" && !input && selected.length) {
        e.preventDefault();
        setModal("delete");
      }
      if (e.key === "Escape") {
        setModal(null);
        setDetail(null);
      }
      if (e.key === "Tab" && !input && selected.length) {
        e.preventDefault();
        indent(selected, e.shiftKey ? -1 : 1);
      }
      if (e.key === "Enter" && !input && plan)
        add(
          plan.tasks.find((t) => t.id === selected[0])?.parentId ?? null,
          selected[0],
        );
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [selected, plan, saving]);
  async function create() {
    try {
      if (!newName.trim()) throw Error("请填写项目名称");
      const p = await api<Plan>("projects", {
        name: newName,
        start: newStart,
        template,
      });
      choose(p);
      setModal(null);
      setNotice("项目已创建，模板工期仅为可编辑建议");
    } catch (e) {
      setError(String(e));
    }
  }
  async function parseImport() {
    try {
      setBackupPreview([]);
      if (importFormat === "json") {
        const parsed: unknown = JSON.parse(importText);
        if (Array.isArray(parsed)) {
          const plans = await api<Plan[]>("restore/preview", parsed);
          setBackupPreview(plans);
          setPreview(null);
          setError("");
          return;
        }
      }
      const base = current.current ?? undefined;
      const p = await api<Plan>("import", {
        format: importFormat,
        text: importText,
        plan: base,
      });
      setPreview(p);
      setError("");
    } catch (e) {
      setError(String(e));
      setPreview(null);
      setBackupPreview([]);
    }
  }
  async function confirmImport() {
    if (!preview && !backupPreview.length) return;
    try {
      if (backupPreview.length) {
        await api("restore", backupPreview);
        await refresh();
        setModal(null);
        setBackupPreview([]);
        setNotice("备份已恢复为独立项目，原项目保持不变");
        return;
      }
      if (!preview) return;
      if (importMode === "merge" && current.current) {
        const imported = structuredClone(preview);
        const map = new Map(
          imported.tasks.map((t) => [t.id, crypto.randomUUID()]),
        );
        change((p) => {
          p.tasks.push(
            ...imported.tasks.map((t) => ({
              ...t,
              id: map.get(t.id)!,
              parentId: t.parentId ? (map.get(t.parentId) ?? null) : null,
              order: t.order + p.tasks.length,
            })),
          );
          p.dependencies.push(
            ...imported.dependencies.map((d) => ({
              ...d,
              id: crypto.randomUUID(),
              from: map.get(d.from)!,
              to: map.get(d.to)!,
            })),
          );
          return p;
        });
      } else {
        const p = await api<Plan>("projects", {
          plan: preview,
          name: preview.project.name + "（导入）",
        });
        choose(p);
      }
      setModal(null);
      setPreview(null);
      setBackupPreview([]);
      setNotice("导入完成");
    } catch (e) {
      setError(String(e));
    }
  }
  function exportData(format: string) {
    if (!plan) return;
    if (format === "json") {
      download(JSON.stringify(plan, null, 2), plan.project.name + ".json");
      return;
    }
    if (format === "csv") {
      api<{ text: string }>("csv/export", plan)
        .then((v) =>
          download(
            v.text,
            plan.project.name + ".csv",
            "text/csv;charset=utf-8",
          ),
        )
        .catch((e) => setError(String(e)));
      return;
    }
    setSaving(true);
    exportChart(
      plan,
      exportScope === "filtered"
        ? view === "roadmap" || density === "Executive"
          ? visible
          : filtered
        : allRows,
      format,
      exportOpt,
    )
      .then(() => setNotice("完整图表已导出"))
      .catch((e) => setError(String(e)))
      .finally(() => setSaving(false));
  }
  const stats = {
    total: projects.filter(
      (p) => !p.project.demo && p.project.status !== "archived",
    ).length,
    active: projects.filter(
      (p) => p.project.status === "active" && !p.project.demo,
    ).length,
  };
  return (
    <div className={"app " + (focus ? "focus-mode" : "")}>
      <aside className="sidebar">
        <a
          className="brand"
          onClick={() => {
            setPlan(null);
            current.current = null;
            setQuery("");
          }}
        >
          <img src="/icon.svg" />
          <span>
            PlanDesk<small>PROJECT WORKSPACE</small>
          </span>
        </a>
        <div className="workspace-label">
          个人工作空间 <span>⌄</span>
        </div>
        <button
          className={!plan ? "nav active" : "nav"}
          onClick={() => {
            setPlan(null);
            current.current = null;
            setQuery("");
          }}
        >
          <FolderOpen size={17} />
          项目工作台<span className="nav-count">{projects.length}</span>
        </button>
        <button className="nav" onClick={() => setModal("templates")}>
          <Layers size={17} />
          模板库<span className="nav-count">6</span>
        </button>
        <div className="sidebar-section">
          最近项目 <Plus size={13} onClick={() => setModal("create")} />
        </div>
        {projects.slice(0, 6).map((p) => (
          <button
            key={p.project.id}
            className={
              "recent-project " +
              (plan?.project.id === p.project.id ? "current" : "")
            }
            onClick={() => choose(p)}
          >
            <i className={p.project.demo ? "demo-dot" : ""} />
            <span>{p.project.name}</span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-dot" /> 本地优先{" "}
            <span className="push">SQLite</span>
            <small>你的计划，只保存在这台电脑。</small>
          </div>
          <button className="nav" onClick={() => setModal("help")}>
            <HelpCircle size={16} />
            使用与快捷键<span className="push">⌘ /</span>
          </button>
          <div className="profile">
            <span className="avatar">青</span>
            <div>
              个人工作空间<small>离线可用 · 无需登录</small>
            </div>
            <Settings2 size={15} />
          </div>
        </div>
      </aside>
      <main className="main">
        {!plan ? (
          <>
            <header className="topbar">
              <span>
                工作空间 <ChevronRight size={12} /> 项目工作台
              </span>
              <span className="local-status">
                <i /> {connected ? "本地数据已连接" : "本地服务未连接"}
              </span>
            </header>
            <div className="workspace">
              <div className="home-heading">
                <div>
                  <span className="eyebrow">
                    YOUR PROJECTS, CLEARLY PLANNED.
                  </span>
                  <h1>把复杂项目，变成清晰计划。</h1>
                  <p>
                    从第一个想法，到最后一次交付。规划、协作与进度，尽在掌握。
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setNewName("");
                    setModal("create");
                  }}
                >
                  <Plus size={16} />
                  新建项目
                </button>
              </div>
              <div className="home-stats">
                <div>
                  <span>我的项目</span>
                  <strong>{stats.total.toString().padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>进行中</span>
                  <strong>
                    {stats.active.toString().padStart(2, "0")}
                    <small>持续推进，稳步交付</small>
                  </strong>
                </div>
                <div>
                  <span>待完成工作项</span>
                  <strong>
                    {projects
                      .filter((p) => !p.project.demo)
                      .reduce(
                        (n, p) =>
                          n +
                          metrics(p).leaves.filter((t) => t.status !== "done")
                            .length,
                        0,
                      )
                      .toString()
                      .padStart(2, "0")}
                  </strong>
                </div>
                <div className="home-quote">
                  <GitBranch size={28} />
                  <p>
                    好计划，让每一步都有方向。
                    <small>WBS · Gantt · Roadmap · Insights</small>
                  </p>
                </div>
              </div>
              <div className="project-list-toolbar">
                <div>
                  <h2>全部项目</h2>
                  <button
                    className={!archived ? "text-tab on" : "text-tab"}
                    onClick={() => setArchived(false)}
                  >
                    活跃项目
                  </button>
                  <button
                    className={archived ? "text-tab on" : "text-tab"}
                    onClick={() => setArchived(true)}
                  >
                    已归档
                  </button>
                </div>
                <div>
                  <label className="search">
                    <Search size={15} />
                    <input
                      placeholder="搜索项目…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="updated">最近更新</option>
                    <option value="name">项目名称</option>
                    <option value="progress">完成进度</option>
                  </select>
                  <button onClick={() => setModal("import")}>
                    <Upload size={14} />
                    导入项目
                  </button>
                </div>
              </div>
              {!ready ? (
                <div className="empty">正在连接本地数据库…</div>
              ) : (
                <div className="project-grid">
                  {projects
                    .filter(
                      (p) =>
                        (p.project.status === "archived") === archived &&
                        p.project.name.includes(query),
                    )
                    .sort((a, b) =>
                      sort === "name"
                        ? a.project.name.localeCompare(b.project.name)
                        : sort === "progress"
                          ? metrics(b).progress - metrics(a).progress
                          : b.project.updatedAt.localeCompare(
                              a.project.updatedAt,
                            ),
                    )
                    .map((p) => {
                      const pm = metrics(p);
                      return (
                        <article
                          className={
                            "project-card " +
                            (p.project.demo ? "demo-card" : "")
                          }
                          key={p.project.id}
                        >
                          <div className="project-card-top">
                            <span className="project-symbol">
                              <ChartNoAxesGantt size={20} />
                            </span>
                            <span
                              className={
                                "badge " + (p.project.demo ? "demo" : "")
                              }
                            >
                              {p.project.demo
                                ? "演示项目"
                                : p.project.status === "active"
                                  ? "进行中"
                                  : p.project.status === "archived"
                                    ? "已归档"
                                    : "规划中"}
                            </span>
                            <button
                              className="push icon-button"
                              title="复制项目"
                              onClick={async () => {
                                const copy = await api<Plan>("projects", {
                                  plan: p,
                                  name: p.project.name + "（副本）",
                                });
                                setProjects((v) => [copy, ...v]);
                                setNotice("项目已复制");
                              }}
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              className="icon-button"
                              title={archived ? "恢复项目" : "归档项目"}
                              onClick={async () => {
                                await api(
                                  "projects/" + p.project.id,
                                  {
                                    ...p,
                                    project: {
                                      ...p.project,
                                      status: archived ? "active" : "archived",
                                    },
                                  },
                                  "PUT",
                                );
                                refresh();
                              }}
                            >
                              <Archive size={14} />
                            </button>
                          </div>
                          <button
                            className="project-open"
                            onClick={() => choose(p)}
                          >
                            <small>{p.project.code || "PROJECT"}</small>
                            <h3>{p.project.name}</h3>
                            <p>
                              {p.project.description ||
                                "从清晰的工作分解开始，构建可持续维护的交付计划。"}
                            </p>
                            <div className="card-progress-title">
                              <span>项目进度</span>
                              <strong>{pm.progress}%</strong>
                            </div>
                            <div className="project-progress">
                              <i style={{ width: pm.progress + "%" }} />
                            </div>
                            <div className="card-counts">
                              <span>
                                <Layers size={13} />
                                {pm.leaves.length} 项任务
                              </span>
                              <span>
                                <Flag size={13} />
                                {pm.milestones.length} 里程碑
                              </span>
                              {pm.overdue.length > 0 && (
                                <span className="risk-text">
                                  {pm.overdue.length} 逾期
                                </span>
                              )}
                            </div>
                            <footer>
                              <span className="avatar">
                                {p.project.owner.slice(-1) || "?"}
                              </span>
                              <span>{p.project.owner || "未分配"}</span>
                              <span className="push">
                                {p.project.start} <ArrowUpRight size={14} />
                              </span>
                            </footer>
                          </button>
                        </article>
                      );
                    })}
                  <button
                    className="new-project-card"
                    onClick={() => setModal("create")}
                  >
                    <span>
                      <Plus size={22} />
                    </span>
                    <strong>开启下一个项目</strong>
                    <small>从空白计划或专业模板开始</small>
                  </button>
                </div>
              )}
              <div className="template-banner">
                <div className="banner-icon">
                  <Layers size={25} />
                </div>
                <div>
                  <strong>专业计划，从成熟的方法开始。</strong>
                  <p>
                    产品全生命周期、AI 应用、系统迁移… 6 个模板，内含
                    WBS、依赖、交付物和验收标准。
                  </p>
                </div>
                <button onClick={() => setModal("templates")}>
                  浏览项目模板 <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="home-footer">
                <span>
                  <Check size={13} /> 自动保存至本地 · 无需云服务
                </span>
                <button
                  onClick={() =>
                    api<{ name: string }>("backup", {})
                      .then((v) =>
                        setNotice("备份已保存：data/backups/" + v.name),
                      )
                      .catch((e) => setError(String(e)))
                  }
                >
                  备份全部项目
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="topbar">
              <span>
                <button
                  onClick={() => {
                    setPlan(null);
                    current.current = null;
                    setQuery("");
                  }}
                >
                  全部项目
                </button>
                <ChevronRight size={12} />
                {plan.project.code}
                <ChevronRight size={12} />
                <strong>{plan.project.name}</strong>
              </span>
              <span className="save-state">
                {saving ? (
                  "正在保存…"
                ) : (
                  <>
                    <Check size={13} />
                    {unsaved.has(plan.project.id)
                      ? "更改未保存 · 草稿已保留"
                      : "已保存到本地"}
                  </>
                )}
              </span>
            </header>
            {localStorage.getItem("plandesk-draft-" + plan.project.id) && (
              <div className="draft-banner">
                发现未保存草稿。可恢复后重试，或先导出保留。
                <button
                  onClick={() => {
                    const text = localStorage.getItem(
                      "plandesk-draft-" + plan.project.id,
                    );
                    if (text)
                      change((p) => ({
                        ...JSON.parse(text),
                        revision: p.revision,
                      }));
                  }}
                >
                  恢复并保存
                </button>
                <button
                  onClick={() =>
                    download(
                      localStorage.getItem(
                        "plandesk-draft-" + plan.project.id,
                      ) ?? "",
                      "未保存草稿.json",
                    )
                  }
                >
                  导出草稿
                </button>
              </div>
            )}
            <div className="project-header">
              <div className="project-title-row">
                <span className="project-symbol">
                  <ChartNoAxesGantt size={22} />
                </span>
                <div>
                  <h1>
                    {plan.project.name}
                    <button
                      className="subtle"
                      onClick={() => setModal("project")}
                    >
                      <Settings2 size={14} />
                    </button>
                  </h1>
                  <p>
                    {plan.project.description ||
                      "将工作拆解为清晰的交付步骤，让计划持续向前。"}
                  </p>
                </div>
                <div className="title-actions">
                  <button onClick={() => setModal("import")}>
                    <Upload size={14} />
                    导入
                  </button>
                  <button onClick={() => setModal("baseline")}>
                    <GitBranch size={14} />
                    计划基线
                  </button>
                  <button
                    className="primary"
                    onClick={() => setModal("export")}
                  >
                    <Download size={14} />
                    导出报告
                  </button>
                </div>
              </div>
              <div className="project-info">
                <span className={"badge " + (plan.project.demo ? "demo" : "")}>
                  {plan.project.demo ? "独立演示项目" : "进行中"}
                </span>
                <span>
                  <span className="avatar tiny">
                    {plan.project.owner.slice(-1)}
                  </span>
                  {plan.project.owner}
                </span>
                <span>
                  <CalendarDays size={13} />
                  {plan.project.start} — {m?.end ?? "未排期"}
                </span>
                <span>
                  <Layers size={13} />
                  {m?.leaves.length} 项任务
                </span>
                <span>
                  <Flag size={13} />
                  {m?.milestones.length} 里程碑
                </span>
                <span className="project-progress-inline">
                  <i style={{ width: (m?.progress ?? 0) + "%" }} />
                </span>
                <strong>{m?.progress}%</strong>
                {!!m?.overdue.length && (
                  <span className="risk-text">{m.overdue.length} 项逾期</span>
                )}
              </div>
            </div>
            <nav className="view-tabs">
              {views.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => {
                    setView(id);
                    if (id === "roadmap") setScale("月");
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
              <span className="push" />
              <button
                title="撤销"
                disabled={!undoCount}
                onClick={() => history(-1)}
              >
                <Undo2 size={15} />
              </button>
              <button
                title="重做"
                disabled={!redoCount}
                onClick={() => history(1)}
              >
                <Redo2 size={15} />
              </button>
              <button title="快捷键" onClick={() => setModal("help")}>
                <HelpCircle size={15} />
              </button>
            </nav>
            <div className="view-toolbar">
              <div className="toolbar-left">
                <button className="primary soft" onClick={() => add()}>
                  <Plus size={14} />
                  新增任务
                </button>
                <button
                  title="新增子任务"
                  disabled={!selected.length}
                  onClick={() => add(selected[0])}
                >
                  子任务
                </button>
                <label className="search">
                  <Search size={14} />
                  <input
                    placeholder="搜索任务 / 负责人"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="负责人筛选"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                >
                  <option value="">所有负责人</option>
                  {[
                    ...new Set(plan.tasks.map((t) => t.owner).filter(Boolean)),
                  ].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select
                  aria-label="状态筛选"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">所有状态</option>
                  {Object.entries(statusNames).map(([v, n]) => (
                    <option value={v} key={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar-right">
                {["gantt", "wbs", "roadmap"].includes(view) && (
                  <>
                    <select
                      aria-label="时间尺度"
                      value={scale}
                      onChange={(e) => setScale(e.target.value)}
                    >
                      {["日", "周", "月", "季度", "年"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      aria-label="视觉模板"
                      value={density}
                      onChange={(e) => setDensity(e.target.value)}
                    >
                      {["Professional", "Executive", "Compact"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </>
                )}
                <button title="视图设置" onClick={() => setModal("settings")}>
                  <Settings2 size={15} />
                </button>
                <button title="专注模式" onClick={() => setFocus(!focus)}>
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
            {selected.length > 0 && ["gantt", "wbs"].includes(view) && (
              <div className="selection-bar">
                <span>已选 {selected.length} 项</span>
                <button onClick={() => indent(selected, 1)}>缩进 Tab</button>
                <button onClick={() => indent(selected, -1)}>提升 ⇧Tab</button>
                <button onClick={copyBranch}>
                  <Copy size={12} />
                  复制分支
                </button>
                <button onClick={() => setModal("batch")}>批量修改</button>
                <button onClick={() => setModal("delete")}>
                  <Trash2 size={12} />
                  删除
                </button>
                <button onClick={() => setDetail(selected[0])}>
                  任务详情 ↗
                </button>
                <button className="push" onClick={() => setSelected([])}>
                  <X size={12} />
                </button>
              </div>
            )}
            {view === "gantt" || view === "wbs" || view === "roadmap" ? (
              <Gantt
                plan={plan}
                rows={visible}
                selected={selected}
                select={(id, multi) =>
                  setSelected((v) =>
                    multi
                      ? v.includes(id)
                        ? v.filter((x) => x !== id)
                        : [...v, id]
                      : [id],
                  )
                }
                update={update}
                open={setDetail}
                collapsed={collapsed}
                toggle={(id) =>
                  setCollapsed((old) => {
                    const n = new Set(old);
                    n.has(id) ? n.delete(id) : n.add(id);
                    return n;
                  })
                }
                scale={scale}
                density={view === "roadmap" ? "Executive" : density}
                critical={
                  new Set(critical.filter((t) => t.critical).map((t) => t.id))
                }
                showCritical={showCritical}
                showBaseline={showBaseline}
                showDeps={showDeps}
                tableWidth={view === "wbs" ? Math.max(width, 1000) : width}
                hidden={hidden}
                onIndent={indent}
                onAdd={add}
                onMove={move}
                onDependency={dependency}
                focus={Number(focus)}
                search={query}
                columns={columns}
              />
            ) : view === "overview" ? (
              <Overview
                plan={plan}
                open={setDetail}
                update={update}
                critical={critical}
                filter={query}
              />
            ) : view === "kanban" ? (
              <Kanban
                plan={plan}
                open={setDetail}
                update={update}
                critical={critical}
                filter={query || ownerFilter}
              />
            ) : view === "calendar" ? (
              <CalendarView
                plan={plan}
                open={setDetail}
                update={update}
                critical={critical}
                filter={query}
              />
            ) : (
              <Resources
                plan={plan}
                open={setDetail}
                update={update}
                critical={critical}
                filter={query}
              />
            )}
          </>
        )}
      </main>
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="error-toast">
          <strong>操作未完成</strong>
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {detailTask && plan && (
        <TaskPanel
          task={detailTask}
          plan={plan}
          critical={critical.find((c) => c.id === detailTask.id)}
          close={() => setDetail(null)}
          update={(patch) => update(detailTask.id, patch)}
          dependency={dependency}
          removeDependency={(id) =>
            change((p) => ({
              ...p,
              dependencies: p.dependencies.filter((d) => d.id !== id),
            }))
          }
          remove={() => {
            setSelected([detailTask.id]);
            setModal("delete");
          }}
        />
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={
              "modal " +
              (["import", "templates", "export"].includes(modal) ? "wide" : "")
            }
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span className="eyebrow">PLANDESK WORKSPACE</span>
                <h2>
                  {
                    (
                      {
                        create: "创建新项目",
                        templates: "从专业模板开始",
                        import: "导入项目计划",
                        export: "导出专业报告",
                        settings: "视图与排期设置",
                        baseline: "不可变计划基线",
                        delete: "删除选中任务",
                        help: "高效工作，从这里开始",
                        project: "项目信息",
                        batch: "批量修改任务",
                      } as Record<string, string>
                    )[modal]
                  }
                </h2>
              </div>
              <button aria-label="关闭" onClick={() => setModal(null)}>
                <X size={19} />
              </button>
            </header>
            {modal === "create" && (
              <>
                <label>
                  项目名称
                  <input
                    autoFocus
                    placeholder="例如：企业知识库 2.0"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    开始日期
                    <input
                      type="date"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </label>
                  <label>
                    项目模板
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                    >
                      {templates.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="info-box">
                  模板包含合理的工作分解、依赖与验收标准。工期是初始建议，请根据团队能力评估调整；空白项目不会自动生成日期。
                </p>
                <footer>
                  <button onClick={() => setModal(null)}>取消</button>
                  <button className="primary" onClick={create}>
                    创建项目 <ArrowUpRight size={14} />
                  </button>
                </footer>
              </>
            )}
            {modal === "templates" && (
              <div className="template-grid">
                {templates.map((t, i) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTemplate(t);
                      setNewName("");
                      setModal("create");
                    }}
                  >
                    <span className="template-number">0{i + 1}</span>
                    <Layers size={22} />
                    <strong>{t}</strong>
                    <small>
                      {i === 5
                        ? "从零搭建你的计划"
                        : "9 个阶段 · 完整交付链 · 工期建议可调整"}
                    </small>
                    <span className="muted">使用此模板 →</span>
                  </button>
                ))}
              </div>
            )}
            {modal === "import" && (
              <>
                <p className="muted">
                  导入前验证日期、ID、WBS 与依赖环，验证失败不会更改现有项目。
                </p>
                <div className="form-grid">
                  <label>
                    文件格式
                    <select
                      value={importFormat}
                      onChange={(e) => {
                        setImportFormat(e.target.value);
                        setPreview(null);
                        setBackupPreview([]);
                      }}
                    >
                      <option value="json">PlanDesk JSON v1</option>
                      <option value="csv">CSV / Excel 粘贴 (TSV)</option>
                    </select>
                  </label>
                  <label className="file-label">
                    选择本地文件
                    <input
                      type="file"
                      accept=".json,.csv,.tsv,.txt"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImportText(await file.text());
                          setImportFormat(
                            file.name.endsWith(".json") ? "json" : "csv",
                          );
                          setPreview(null);
                          setBackupPreview([]);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  aria-label="导入内容"
                  className="code-input"
                  placeholder={
                    importFormat === "json"
                      ? "粘贴 AI 生成的标准 JSON…"
                      : "id,name,parentId,start,end,owner\na,需求分析,,,,青阳"
                  }
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setPreview(null);
                    setBackupPreview([]);
                  }}
                />
                <div className="import-links">
                  <button
                    onClick={() => {
                      api<unknown>("schema").then((s) =>
                        download(
                          JSON.stringify(s, null, 2),
                          "plandesk-v1.schema.json",
                        ),
                      );
                    }}
                  >
                    下载 JSON Schema
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        "请按 PlanDesk JSON Schema v1 生成项目计划。schemaVersion:1，project:{id,name,start:YYYY-MM-DD}，calendar:{weekdays:[1,2,3,4,5],holidays:[]}，tasks:[{id,parentId,order,name,type:task|phase|milestone|review,start,end,progress,status:todo|doing|blocked|done|cancelled,owner,dependencies:[],deliverables,acceptanceCriteria}]，dependencies:[{id,from,to,type:FS,lag:0}]，milestones:[]，baseline:[]。日期不确定请用 null，不编造；依赖仅引用叶子任务，不允许循环。请输出纯 JSON。",
                      );
                      setNotice("AI 提示词已复制");
                    }}
                  >
                    复制 AI 生成提示词
                  </button>
                </div>
                {!!backupPreview.length && (
                  <div className="preview-box">
                    <strong>完整备份 · {backupPreview.length} 个项目</strong>
                    {backupPreview.map((p) => (
                      <p key={p.project.id}>
                        {p.project.name} · {p.tasks.length} 个工作项
                      </p>
                    ))}
                    <small>恢复为独立副本，不覆盖现有项目。</small>
                  </div>
                )}
                {preview && (
                  <div className="preview-box">
                    <strong>{preview.project.name}</strong>
                    <p>
                      {preview.tasks.length} 个工作项 ·{" "}
                      {preview.dependencies.length} 个依赖 ·{" "}
                      {preview.tasks.filter((t) => !t.start).length} 个未排期
                    </p>
                    <div>
                      {rowsOf(preview)
                        .slice(0, 10)
                        .map((t) => (
                          <div key={t.id} style={{ paddingLeft: t.depth * 15 }}>
                            {t.wbs}　{t.name}{" "}
                            <small>{t.start ?? "未排期"}</small>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                <footer>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value)}
                  >
                    <option value="new">创建新项目</option>
                    {plan && (
                      <option value="merge">
                        合并到当前项目（重新分配 ID）
                      </option>
                    )}
                  </select>
                  <button onClick={parseImport}>验证与预览</button>
                  <button
                    className="primary"
                    disabled={!preview && !backupPreview.length}
                    onClick={confirmImport}
                  >
                    确认导入
                  </button>
                </footer>
              </>
            )}
            {modal === "export" && plan && (
              <>
                <div className="export-preview">
                  <ChartNoAxesGantt size={30} />
                  <div>
                    <strong>{plan.project.name}</strong>
                    <p>
                      {allRows.length} 个工作项 · 完整时间范围 ·
                      独立渲染，不截取屏幕
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    报告标题
                    <input
                      value={exportOpt.title}
                      onChange={(e) =>
                        setExportOpt((v) => ({ ...v, title: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    副标题
                    <input
                      value={exportOpt.subtitle}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          subtitle: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    导出范围
                    <select
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value)}
                    >
                      <option value="all">完整项目</option>
                      <option value="filtered">当前筛选任务</option>
                    </select>
                  </label>
                  <label>
                    PDF 纸张
                    <select
                      value={exportOpt.paper}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          paper: e.target.value as "a4" | "a3",
                        }))
                      }
                    >
                      <option value="a3">A3 横向</option>
                      <option value="a4">A4 横向</option>
                    </select>
                  </label>
                  <label>
                    输出倍率
                    <select
                      value={exportOpt.scale}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          scale: Number(e.target.value),
                        }))
                      }
                    >
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                    </select>
                  </label>
                  <label>
                    PDF 页边距 mm
                    <input
                      type="number"
                      min="5"
                      max="30"
                      value={exportOpt.margin}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          margin: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="check-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={exportOpt.legend}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          legend: e.target.checked,
                        }))
                      }
                    />
                    显示图例
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={exportOpt.dependencies}
                      onChange={(e) =>
                        setExportOpt((v) => ({
                          ...v,
                          dependencies: e.target.checked,
                        }))
                      }
                    />
                    显示依赖
                  </label>
                  <button
                    onClick={() => {
                      setDensity("Executive");
                      setExportScope("filtered");
                      setShowDeps(false);
                      setView("roadmap");
                      setModal(null);
                      setNotice("已切换高层路线图，再次导出时选择当前筛选任务");
                    }}
                  >
                    管理层汇报模式 ↗
                  </button>
                </div>
                <footer>
                  {["json", "csv", "svg", "png", "pdf"].map((f) => (
                    <button
                      key={f}
                      className={f === "png" || f === "pdf" ? "primary" : ""}
                      disabled={saving}
                      onClick={() => exportData(f)}
                    >
                      <Download size={13} />
                      {f.toUpperCase()}
                    </button>
                  ))}
                </footer>
              </>
            )}
            {modal === "settings" && plan && (
              <>
                <div className="form-grid">
                  <label>
                    左表宽度 {width}px
                    <input
                      type="range"
                      min="450"
                      max="1100"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    优先级筛选
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                      <option value="">全部</option>
                      {["low", "medium", "high", "urgent"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="check-list">
                  {[
                    ["显示关键路径", showCritical, setShowCritical],
                    ["显示依赖连线", showDeps, setShowDeps],
                    ["显示最新基线", showBaseline, setShowBaseline],
                    ["隐藏左侧任务表", hidden, setHidden],
                    ["修改日期后自动排期", auto, setAuto],
                  ].map(([n, v, set]) => (
                    <label key={String(n)}>
                      <input
                        type="checkbox"
                        checked={Boolean(v)}
                        onChange={(e) =>
                          (set as (v: boolean) => void)(e.target.checked)
                        }
                      />
                      {String(n)}
                    </label>
                  ))}
                </div>
                <p className="info-box">
                  自动排期支持 FS / SS / FF / SF 和工作日 Lag。CPM
                  计算已排期叶子任务的 ES / EF / LS / LF /
                  Float；详情面板可查看。摘要任务不直接参与依赖。
                </p>
                <h3>显示列 · 顺序</h3>
                <div className="column-settings">
                  {[
                    "owner",
                    "start",
                    "end",
                    "duration",
                    "progress",
                    "status",
                  ].map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox"
                        checked={columns.includes(c)}
                        onChange={(e) =>
                          setColumns((v) =>
                            e.target.checked
                              ? [...v, c]
                              : v.filter((x) => x !== c),
                          )
                        }
                      />
                      {c}
                      <button
                        onClick={() =>
                          setColumns((v) => {
                            const n = [...v];
                            const i = n.indexOf(c);
                            if (i > 0) [n[i - 1], n[i]] = [n[i], n[i - 1]];
                            return n;
                          })
                        }
                      >
                        ←
                      </button>
                    </label>
                  ))}
                </div>
                <h3>工作日历</h3>
                <div className="check-row">
                  {["日", "一", "二", "三", "四", "五", "六"].map((s, i) => (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={plan.calendar.weekdays.includes(i)}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          change((p) => ({
                            ...p,
                            calendar: {
                              ...p.calendar,
                              weekdays: checked
                                ? [...p.calendar.weekdays, i]
                                : p.calendar.weekdays.filter((d) => d !== i),
                            },
                          }));
                        }}
                      />
                      周{s}
                    </label>
                  ))}
                </div>
                <label>
                  节假日（逗号分隔 YYYY-MM-DD）
                  <input
                    defaultValue={plan.calendar.holidays.join(",")}
                    onBlur={(e) =>
                      change((p) => ({
                        ...p,
                        calendar: {
                          ...p.calendar,
                          holidays: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </label>
                <footer>
                  <button
                    onClick={() => {
                      setCollapsed(new Set());
                      setScale("月");
                      setModal(null);
                    }}
                  >
                    适应完整计划
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      change((p) => api<Plan>("schedule", p));
                      setModal(null);
                    }}
                  >
                    执行自动排期
                  </button>
                </footer>
              </>
            )}
            {modal === "baseline" && plan && (
              <>
                <p className="info-box">
                  基线保存当前日期和进度的不可变快照，后续任务修改不会改变它。
                </p>
                {plan.baseline.map((b) => (
                  <div className="baseline-row" key={b.id}>
                    <div>
                      <strong>{b.name}</strong>
                      <small>
                        {new Date(b.createdAt).toLocaleString()} ·{" "}
                        {b.tasks.length} 项
                      </small>
                    </div>
                    <button
                      onClick={() => {
                        setShowBaseline(true);
                        setModal(null);
                      }}
                    >
                      显示对比
                    </button>
                  </div>
                ))}
                <label>
                  新基线名称
                  <input
                    id="baseline-name"
                    defaultValue={"计划基线 " + (plan.baseline.length + 1)}
                  />
                </label>
                <footer>
                  <button
                    className="primary"
                    onClick={() => {
                      const name = (
                        document.querySelector(
                          "#baseline-name",
                        ) as HTMLInputElement
                      ).value;
                      change((p) => ({
                        ...p,
                        baseline: [
                          ...p.baseline,
                          {
                            id: crypto.randomUUID(),
                            name,
                            createdAt: new Date().toISOString(),
                            tasks: p.tasks.map((t) => ({
                              id: t.id,
                              start: t.start,
                              end: t.end,
                              progress: t.progress,
                            })),
                          },
                        ],
                      }));
                      setShowBaseline(true);
                      setModal(null);
                    }}
                  >
                    保存当前计划为基线
                  </button>
                </footer>
              </>
            )}
            {modal === "delete" && (
              <>
                <p>
                  删除 {selected.length}{" "}
                  个选中任务。可同时删除其子任务，或将子任务提升一级保留。此操作支持撤销。
                </p>
                <footer>
                  <button onClick={() => remove(false)}>
                    保留并提升子任务
                  </button>
                  <button className="danger" onClick={() => remove(true)}>
                    删除整个分支
                  </button>
                </footer>
              </>
            )}
            {modal === "batch" && (
              <>
                <p className="muted">
                  修改 {selected.length} 个任务；父任务的聚合字段保持自动计算。
                </p>
                <label>
                  负责人
                  <input id="batch-owner" placeholder="留空则不修改" />
                </label>
                <label>
                  状态
                  <select id="batch-status">
                    <option value="">不修改</option>
                    {Object.entries(statusNames).map(([s, n]) => (
                      <option key={s} value={s}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <footer>
                  <button
                    className="primary"
                    onClick={() => {
                      const owner = (
                        document.querySelector(
                          "#batch-owner",
                        ) as HTMLInputElement
                      ).value;
                      const status = (
                        document.querySelector(
                          "#batch-status",
                        ) as HTMLSelectElement
                      ).value;
                      change((p) => ({
                        ...p,
                        tasks: p.tasks.map((t) =>
                          selected.includes(t.id) &&
                          !p.tasks.some((x) => x.parentId === t.id)
                            ? {
                                ...t,
                                ...(owner ? { owner } : {}),
                                ...(status
                                  ? {
                                      status: status as Task["status"],
                                      ...(status === "done"
                                        ? { progress: 100 }
                                        : {}),
                                    }
                                  : {}),
                              }
                            : t,
                        ),
                      }));
                      setModal(null);
                    }}
                  >
                    应用修改
                  </button>
                </footer>
              </>
            )}
            {modal === "project" && plan && (
              <>
                <label>
                  项目名称
                  <input
                    defaultValue={plan.project.name}
                    onBlur={(e) =>
                      change((p) => ({
                        ...p,
                        project: { ...p.project, name: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  项目说明
                  <textarea
                    defaultValue={plan.project.description}
                    onBlur={(e) =>
                      change((p) => ({
                        ...p,
                        project: { ...p.project, description: e.target.value },
                      }))
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    负责人
                    <input
                      defaultValue={plan.project.owner}
                      onBlur={(e) =>
                        change((p) => ({
                          ...p,
                          project: { ...p.project, owner: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    编号
                    <input
                      defaultValue={plan.project.code}
                      onBlur={(e) =>
                        change((p) => ({
                          ...p,
                          project: { ...p.project, code: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    目标结束
                    <input
                      type="date"
                      defaultValue={plan.project.target ?? ""}
                      onBlur={(e) =>
                        change((p) => ({
                          ...p,
                          project: {
                            ...p.project,
                            target: e.target.value || null,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    状态
                    <select
                      value={plan.project.status}
                      onChange={(e) => {
                        const value = e.target
                          .value as Plan["project"]["status"];
                        change((p) => ({
                          ...p,
                          project: { ...p.project, status: value },
                        }));
                      }}
                    >
                      {["planning", "active", "completed", "archived"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <footer>
                  <button
                    onClick={() => {
                      const draft = localStorage.getItem(
                        "plandesk-draft-" + plan.project.id,
                      );
                      if (draft) download(draft, "未保存草稿.json");
                      else setNotice("当前没有未保存草稿");
                    }}
                  >
                    导出未保存草稿
                  </button>
                  <button className="primary" onClick={() => setModal(null)}>
                    完成
                  </button>
                </footer>
              </>
            )}
            {modal === "help" && (
              <>
                <p className="muted">
                  任务表像电子表格一样工作，复杂信息在右侧面板编辑。
                </p>
                <div className="shortcut-list">
                  {[
                    ["Enter", "新增同级任务"],
                    ["Tab / Shift + Tab", "降低 / 提升层级"],
                    ["⌘ / Ctrl + Z", "撤销"],
                    ["⌘ / Ctrl + Shift + Z", "重做"],
                    ["⌘ / Ctrl + S", "保存状态"],
                    ["Delete", "删除选中任务"],
                    ["⌘ / Ctrl + 点击", "多选任务"],
                    ["Alt + 拖动任务行", "移动到目标任务下"],
                    ["双击任务条 / ↗", "打开完整任务详情"],
                    ["任务条尾部连接点", "拖动或点击连接前后任务"],
                  ].map(([k, n]) => (
                    <div key={k}>
                      <span>{n}</span>
                      <kbd>{k}</kbd>
                    </div>
                  ))}
                </div>
                <p className="info-box">
                  实际数据保存在 data/plandesk.sqlite。建议定期导出 JSON
                  或在项目首页备份全部项目。未排期任务不会被自动填入虚假日期。
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
