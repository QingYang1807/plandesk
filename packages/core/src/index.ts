import { planSchema, taskSchema } from "@plandesk/schema";
import type { Plan, Task, Calendar } from "@plandesk/schema";
const DAY = 86400000;
export const day = (s: string) =>
  Math.floor(Date.parse(s + "T00:00:00Z") / DAY);
export const date = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const plus = (s: string, n: number) => date(day(s) + n);
export function work(s: string, c: Calendar) {
  return (
    c.weekdays.includes(new Date(s + "T00:00:00Z").getUTCDay()) &&
    !c.holidays.includes(s)
  );
}
export function addWork(s: string, n: number, c: Calendar): string {
  let d = s;
  let count = Math.abs(n);
  while (count) {
    d = plus(d, Math.sign(n));
    if (work(d, c)) count--;
  }
  return d;
}
export function nextWork(s: string, c: Calendar) {
  let d = s;
  while (!work(d, c)) d = plus(d, 1);
  return d;
}
export function duration(s: string, e: string, c: Calendar) {
  let n = 0;
  for (let d = day(s); d <= day(e); d++) if (work(date(d), c)) n++;
  return n;
}
export function validate(input: unknown): Plan {
  const p = planSchema.parse(input);
  const ids = new Set<string>();
  p.tasks.forEach((t) => {
    if (ids.has(t.id)) throw Error("任务 ID 重复: " + t.id);
    ids.add(t.id);
    if (t.start && t.end && t.end < t.start)
      throw Error("结束日期早于开始日期: " + t.name);
    if (Boolean(t.start) !== Boolean(t.end))
      throw Error("开始和结束日期必须同时提供: " + t.name);
    if (t.type === "milestone" && t.start !== t.end)
      throw Error("里程碑必须为同一天");
  });
  p.tasks.forEach((t) =>
    t.dependencies.forEach((from) => {
      if (!ids.has(from)) throw Error("依赖任务不存在: " + from);
    }),
  );
  p.tasks.forEach((t) => {
    if (t.type === "milestone" && p.tasks.some((c) => c.parentId === t.id))
      throw Error("里程碑不能包含子任务，请先转换为阶段");
  });
  const parents = new Map(p.tasks.map((t) => [t.id, t.parentId]));
  p.tasks.forEach((t) => {
    const seen = new Set([t.id]);
    let id = t.parentId;
    while (id) {
      if (!ids.has(id)) throw Error("父任务不存在");
      if (seen.has(id)) throw Error("WBS 循环引用");
      seen.add(id);
      id = parents.get(id) ?? null;
    }
  });
  const edges = new Map<string, string[]>();
  const depIds = new Set<string>();
  p.dependencies.forEach((d) => {
    if (depIds.has(d.id)) throw Error("依赖 ID 重复");
    depIds.add(d.id);
    if (!ids.has(d.from) || !ids.has(d.to)) throw Error("依赖任务不存在");
    if (p.tasks.some((t) => t.parentId === d.from || t.parentId === d.to))
      throw Error("依赖仅支持叶子任务");
    edges.set(d.from, [...(edges.get(d.from) ?? []), d.to]);
  });
  const visited = new Set<string>();
  const active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw Error("依赖循环");
    if (visited.has(id)) return;
    active.add(id);
    (edges.get(id) ?? []).forEach(visit);
    active.delete(id);
    visited.add(id);
  }
  p.tasks.forEach((t) => visit(t.id));
  return p;
}
export function tree(p: Plan) {
  const output: (Task & { depth: number; wbs: string })[] = [];
  const children = new Map<string | null, Task[]>();
  p.tasks.forEach((t) =>
    children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]),
  );
  function walk(id: string | null, depth: number, prefix: string) {
    (children.get(id) ?? [])
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => {
        const wbs = prefix ? prefix + "." + (i + 1) : String(i + 1);
        output.push({ ...t, depth, wbs });
        walk(t.id, depth + 1, wbs);
      });
  }
  walk(null, 0, "");
  return output;
}
export function aggregate(input: Plan): Plan {
  const p = structuredClone(input);
  const children = new Map<string, Task[]>();
  p.tasks.forEach((t) => {
    if (t.parentId)
      children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
  });
  function fold(t: Task): { weight: number; total: number } {
    const subs = children.get(t.id);
    if (!subs)
      return {
        weight:
          t.start && t.end
            ? Math.max(1, duration(t.start, t.end, p.calendar))
            : 1,
        total:
          t.progress *
          (t.start && t.end
            ? Math.max(1, duration(t.start, t.end, p.calendar))
            : 1),
      };
    const sums = subs.map(fold);
    const starts = subs.flatMap((x) => (x.start ? [x.start] : [])).sort();
    const ends = subs.flatMap((x) => (x.end ? [x.end] : [])).sort();
    t.start = starts[0] ?? null;
    t.end = ends.at(-1) ?? null;
    const weight = sums.reduce((a, b) => a + b.weight, 0);
    const total = sums.reduce((a, b) => a + b.total, 0);
    t.progress = Math.round(total / weight);
    t.status =
      t.progress === 100
        ? "done"
        : subs.some((s) => s.status === "blocked")
          ? "blocked"
          : t.progress > 0
            ? "doing"
            : "todo";
    return { weight, total };
  }
  p.tasks.filter((t) => !t.parentId).forEach(fold);
  p.tasks.forEach((t) => {
    t.dependencies = p.dependencies
      .filter((d) => d.to === t.id)
      .map((d) => d.from);
  });
  p.milestones = p.tasks.filter((t) => t.type === "milestone").map((t) => t.id);
  return p;
}
export function schedule(input: Plan): Plan {
  const p = validate(input);
  const tasks = new Map(p.tasks.map((t) => [t.id, t]));
  const done = new Set<string>();
  function run(t: Task) {
    if (done.has(t.id)) return;
    p.dependencies
      .filter((d) => d.to === t.id)
      .forEach((d) => run(tasks.get(d.from)!));
    done.add(t.id);
    if (!t.start || !t.end || p.tasks.some((x) => x.parentId === t.id)) return;
    const length =
      t.type === "milestone"
        ? 1
        : Math.max(1, duration(t.start, t.end, p.calendar));
    const bounds = p.dependencies
      .filter((d) => d.to === t.id)
      .flatMap((d) => {
        const prev = tasks.get(d.from)!;
        if (!prev.start || !prev.end)
          throw Error("前置任务尚未排期: " + prev.name);
        // Finish boundaries are exclusive internally; displayed end dates remain inclusive.
        const anchor =
          d.type[0] === "F" && prev.type !== "milestone"
            ? addWork(prev.end, 1, p.calendar)
            : prev.start;
        const bound = addWork(anchor, d.lag, p.calendar);
        return [
          d.type[1] === "F"
            ? addWork(bound, t.type === "milestone" ? 0 : -length, p.calendar)
            : nextWork(bound, p.calendar),
        ];
      });
    const required = bounds.sort().at(-1);
    if (!required) return;
    if (!t.autoSchedule) {
      if (t.start < required) throw Error("锁定日期与依赖冲突: " + t.name);
      return;
    }
    t.start = required;
    t.end = addWork(required, length - 1, p.calendar);
  }
  p.tasks.forEach(run);
  return aggregate(p);
}
export function cpm(input: Plan) {
  const p = validate(input);
  const leaves = p.tasks.filter(
    (t) =>
      !p.tasks.some((x) => x.parentId === t.id) &&
      t.start &&
      t.end &&
      t.status !== "cancelled",
  );
  const ids = new Set(leaves.map((t) => t.id));
  const deps = p.dependencies.filter((d) => ids.has(d.from) && ids.has(d.to));
  const data = new Map(
    leaves.map((t) => [
      t.id,
      {
        id: t.id,
        es: 0,
        ef: 0,
        ls: 0,
        lf: 0,
        float: 0,
        critical: false,
        length:
          t.type === "milestone"
            ? 0
            : Math.max(1, duration(t.start!, t.end!, p.calendar)),
      },
    ]),
  );
  const visited = new Set<string>();
  const ordered: string[] = [];
  function walk(id: string) {
    if (visited.has(id)) return;
    deps.filter((d) => d.to === id).forEach((d) => walk(d.from));
    visited.add(id);
    ordered.push(id);
  }
  leaves.forEach((t) => walk(t.id));
  function offset(d: Plan["dependencies"][number]) {
    const a = data.get(d.from)!;
    const b = data.get(d.to)!;
    return (
      (d.type[0] === "F" ? a.length : 0) -
      (d.type[1] === "F" ? b.length : 0) +
      d.lag
    );
  }
  ordered.forEach((id) => {
    const t = data.get(id)!;
    t.es = Math.max(
      0,
      ...deps
        .filter((d) => d.to === id)
        .map((d) => data.get(d.from)!.es + offset(d)),
    );
    t.ef = t.es + t.length;
  });
  const finish = Math.max(0, ...[...data.values()].map((t) => t.ef));
  ordered.toReversed().forEach((id) => {
    const t = data.get(id)!;
    t.ls = Math.min(
      finish - t.length,
      ...deps
        .filter((d) => d.from === id)
        .map((d) => data.get(d.to)!.ls - offset(d)),
    );
    t.lf = t.ls + t.length;
    t.float = t.ls - t.es;
    t.critical = t.float === 0;
  });
  return [...data.values()];
}
export function indent(input: Plan, ids: string[], direction: number) {
  const p = structuredClone(input);
  const rows = tree(p);
  ids.forEach((id) => {
    const row = rows.find((t) => t.id === id);
    const t = p.tasks.find((t) => t.id === id);
    if (!row || !t) return;
    if (direction < 0) {
      t.parentId = p.tasks.find((x) => x.id === t.parentId)?.parentId ?? null;
      return;
    }
    const prev = rows
      .slice(0, rows.indexOf(row))
      .findLast(
        (x) =>
          x.depth === row.depth &&
          x.parentId === row.parentId &&
          !ids.includes(x.id),
      );
    if (prev) t.parentId = prev.id;
  });
  return aggregate(validate(p));
}
export function csvExport(p: Plan) {
  const keys = [
    "id",
    "parentId",
    "order",
    "name",
    "type",
    "start",
    "end",
    "progress",
    "status",
    "owner",
    "deliverables",
    "acceptanceCriteria",
  ] as const;
  const escape = (v: unknown) =>
    '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      keys.join(","),
      ...tree(p).map((t) => keys.map((k) => escape(t[k])).join(",")),
    ].join("\r\n")
  );
}
export function csvImport(text: string): Task[] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && (c === "," || c === "\t")) {
      rows.at(-1)!.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && s[i + 1] === "\n") i++;
      rows.at(-1)!.push(cell);
      cell = "";
      rows.push([]);
      continue;
    }
    cell += c;
  }
  if (quoted) throw Error("CSV 引号未闭合");
  rows.at(-1)!.push(cell);
  const keys = rows.shift()!;
  return rows
    .filter((r) => r.some(Boolean))
    .map((r, i) => {
      const obj = Object.fromEntries(
        keys.map((k, j) => [k.trim(), r[j] ?? ""]),
      );
      return taskSchema.parse({
        ...obj,
        id: obj.id || crypto.randomUUID(),
        name: obj.name || obj["任务名称"] || obj["名称"],
        order: obj.order ? Number(obj.order) : i,
        parentId: obj.parentId || null,
        start: obj.start || null,
        end: obj.end || null,
        progress: Number(obj.progress || 0),
        type: obj.type || "task",
        status: obj.status || "todo",
      });
    });
}

export function projectProgress(p: Plan) {
  const parents = new Set(
    p.tasks.flatMap((t) => (t.parentId ? [t.parentId] : [])),
  );
  const leaves = p.tasks.filter(
    (t) => !parents.has(t.id) && t.status !== "cancelled",
  );
  const weight = (t: Task) =>
    t.start && t.end ? Math.max(1, duration(t.start, t.end, p.calendar)) : 1;
  return Math.round(
    leaves.reduce((n, t) => n + t.progress * weight(t), 0) /
      Math.max(
        1,
        leaves.reduce((n, t) => n + weight(t), 0),
      ),
  );
}
