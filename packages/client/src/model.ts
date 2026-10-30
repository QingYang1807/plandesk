import { ApiError } from "./persistence";
import type { Plan, Task } from "@plandesk/schema";
export type Row = Task & { depth: number; wbs: string };
export const statusNames = {
  todo: "未开始",
  doing: "进行中",
  blocked: "已阻塞",
  done: "已完成",
  cancelled: "已取消",
};
export const typeNames = {
  task: "普通任务",
  phase: "阶段",
  milestone: "里程碑",
  review: "评审节点",
};
export const today = () => new Date().toLocaleDateString("en-CA");
export const day = (s: string) =>
  Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
export const date = (n: number) =>
  new Date(n * 86400000).toISOString().slice(0, 10);
export const plus = (s: string, n: number) => date(day(s) + n);
export function rowsOf(p: Plan) {
  const result: Row[] = [];
  const groups = new Map<string | null, Task[]>();
  p.tasks.forEach((t) =>
    groups.set(t.parentId, [...(groups.get(t.parentId) ?? []), t]),
  );
  function visit(id: string | null, depth: number, prefix: string) {
    (groups.get(id) ?? [])
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => {
        const wbs = prefix ? `${prefix}.${i + 1}` : String(i + 1);
        result.push({ ...t, depth, wbs });
        visit(t.id, depth + 1, wbs);
      });
  }
  visit(null, 0, "");
  return result;
}
export function metrics(p: Plan) {
  const parents = new Set(
    p.tasks.flatMap((t) => (t.parentId ? [t.parentId] : [])),
  );
  const leaves = p.tasks.filter(
    (t) => !parents.has(t.id) && t.status !== "cancelled",
  );
  const overdue = leaves.filter(
    (t) => t.end && t.end < today() && t.status !== "done",
  );
  return {
    leaves,
    overdue,
    done: leaves.filter((t) => t.status === "done").length,
    progress: Math.round(
      leaves.reduce(
        (n, t) => n + t.progress * Math.max(1, workDuration(p, t) ?? 1),
        0,
      ) /
        Math.max(
          1,
          leaves.reduce((n, t) => n + Math.max(1, workDuration(p, t) ?? 1), 0),
        ),
    ),
    milestones: p.tasks.filter((t) => t.type === "milestone"),
    end:
      p.tasks
        .flatMap((t) => (t.end ? [t.end] : []))
        .sort()
        .at(-1) ?? null,
  };
}
export async function api<T>(
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const response = await fetch("/api/" + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.error ?? "服务暂时不可用", response.status);
  return data;
}
export function download(
  data: Blob | string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    typeof data === "string" ? new Blob([data], { type }) : data,
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export const phaseColors = [
  "#5e6ad2",
  "#428e9c",
  "#8773b8",
  "#557fab",
  "#4d9885",
  "#ba9456",
  "#738ba9",
  "#7b82ac",
  "#5f9391",
];

export function workDuration(p: Plan, t: Task) {
  if (!t.start || !t.end) return null;
  if (t.type === "milestone") return 0;
  let count = 0;
  for (let d = day(t.start); d <= day(t.end); d++) {
    const value = date(d);
    if (
      p.calendar.weekdays.includes(
        new Date(value + "T00:00:00Z").getUTCDay(),
      ) &&
      !p.calendar.holidays.includes(value)
    )
      count++;
  }
  return count;
}
export function axisBands(start: number, end: number, scale: string) {
  const top: { key: string; label: string; start: number; end: number }[] = [];
  const bottom: { key: string; label: string; start: number; end: number }[] =
    [];
  const add = (list: typeof top, key: string, label: string, n: number) => {
    if (list.at(-1)?.key === key) list.at(-1)!.end = n;
    else list.push({ key, label, start: n, end: n });
  };
  for (let n = start; n <= end; n++) {
    const value = date(n);
    const year = value.slice(0, 4),
      month = Number(value.slice(5, 7)),
      q = Math.ceil(month / 3);
    const topKey =
      scale === "日" || scale === "周"
        ? value.slice(0, 7)
        : scale === "月"
          ? year + "Q" + q
          : year;
    add(
      top,
      topKey,
      scale === "日" || scale === "周"
        ? `${year} 年 ${month} 月`
        : scale === "月"
          ? `${year} · Q${q}`
          : year + " 年",
      n,
    );
    if (scale === "日") add(bottom, value, value.slice(8), n);
    else if (scale === "周") {
      const d = new Date(value + "T00:00:00Z");
      const monday = n - ((d.getUTCDay() + 6) % 7);
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const week = Math.ceil(
        ((+d - Date.parse(d.getUTCFullYear() + "-01-01T00:00:00Z")) / 86400000 +
          1) /
          7,
      );
      add(bottom, String(monday), "W" + week, n);
    } else if (scale === "月") add(bottom, value.slice(0, 7), month + " 月", n);
    else add(bottom, year + "Q" + q, "Q" + q, n);
  }
  return { top, bottom };
}
