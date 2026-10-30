import { it, expect } from "vitest";
import { planSchema, taskSchema } from "@plandesk/schema";
import {
  validate,
  schedule,
  aggregate,
  cpm,
  indent,
  duration,
} from "../src/index";
import { createPlan, templates } from "../src/templates";
const p = () =>
  planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "p", start: "2026-10-30" },
    tasks: [
      { id: "a", name: "a", start: "2026-10-30", end: "2026-11-02" },
      { id: "b", name: "b", start: "2026-11-03", end: "2026-11-04" },
    ],
    dependencies: [{ id: "d", from: "a", to: "b", type: "FS", lag: 0 }],
  });
it("rejects invalid leap days but accepts real leap days", () => {
  expect(() =>
    taskSchema.parse({ id: "x", name: "x", start: "2027-02-29" }),
  ).toThrow();
  expect(() =>
    taskSchema.parse({ id: "x", name: "x", start: "2028-02-29" }),
  ).not.toThrow();
});
it("FS lag and lead are working days", () => {
  const x = p();
  x.dependencies[0].lag = 2;
  expect(schedule(x).tasks[1].start).toBe("2026-11-05");
  x.dependencies[0].lag = -1;
  expect(schedule(x).tasks[1].start).toBe("2026-11-02");
});
it.each(["SS", "FF", "SF"] as const)(
  "%s produces exact constraints",
  (type) => {
    const x = p();
    x.dependencies[0].type = type;
    const t = schedule(x).tasks[1];
    if (type === "SS") expect(t.start).toBe("2026-10-30");
    if (type === "FF") expect(t.end).toBe("2026-11-02");
    if (type === "SF") expect(t.end).toBe("2026-10-29");
  },
);
it("rejects dependency on a summary without losing data", () => {
  const x = p();
  x.tasks.push(taskSchema.parse({ id: "c", name: "child", parentId: "a" }));
  expect(() => validate(x)).toThrow(/叶子/);
  expect(x.tasks).toHaveLength(3);
});
it("unscheduled predecessor yields actionable error", () => {
  const x = p();
  x.tasks[0].start = null;
  x.tasks[0].end = null;
  expect(() => schedule(x)).toThrow(/尚未排期/);
});
it("baseline remains unchanged during aggregation and scheduling", () => {
  const x = p();
  x.baseline = [
    {
      id: "base",
      name: "base",
      createdAt: "now",
      tasks: x.tasks.map((t) => ({
        id: t.id,
        start: t.start,
        end: t.end,
        progress: t.progress,
      })),
    },
  ];
  x.tasks[0].end = "2026-11-05";
  expect(schedule(x).baseline).toEqual(x.baseline);
  expect(schedule(x).tasks[1].start).toBe("2026-11-06");
});
it("all templates produce valid complete dependency graphs", () => {
  templates.forEach((t) => {
    const x = createPlan(t, "2026-10-30", t);
    expect(() => validate(x)).not.toThrow();
    if (t === "空白项目") {
      expect(x.tasks).toHaveLength(0);
      return;
    }
    expect(x.tasks.length).toBeGreaterThanOrEqual(40);
    expect(x.milestones.length).toBeGreaterThanOrEqual(5);
    expect(schedule(x).tasks).toEqual(x.tasks);
  });
});
it("CPM excludes unscheduled nodes", () => {
  const x = p();
  x.tasks[1].start = null;
  x.tasks[1].end = null;
  expect(cpm(x)).toHaveLength(1);
});
it("outdent preserves grandchildren", () => {
  const x = p();
  x.dependencies = [];
  x.tasks.push(taskSchema.parse({ id: "c", name: "c", parentId: "b" }));
  x.tasks[1].parentId = "a";
  const y = indent(x, ["b"], -1);
  expect(y.tasks[1].parentId).toBeNull();
  expect(y.tasks[2].parentId).toBe("b");
});
it("handles 1000 scheduled nodes without dropping dependencies", () => {
  const x = p();
  x.tasks = Array.from({ length: 1000 }, (_, i) =>
    taskSchema.parse({
      id: String(i),
      name: String(i),
      start: "2026-10-30",
      end: "2026-10-30",
      order: i,
    }),
  );
  x.dependencies = x.tasks.slice(1).map((t, i) => ({
    id: "d" + i,
    from: String(i),
    to: t.id,
    type: "FS",
    lag: 0,
  }));
  const scheduled = schedule(x);
  expect(cpm(scheduled)).toHaveLength(1000);
  expect(scheduled.tasks.at(-1)?.start).not.toBe("2026-10-30");
});
it("rejects contradictory per-task dependency references", () => {
  const x = p();
  x.tasks[1].dependencies = ["missing"];
  expect(() => validate(x)).toThrow(/依赖/);
});
it("deleting an edge is not undone by stale projected task dependencies", () => {
  const x = aggregate(p());
  x.dependencies = [];
  const y = aggregate(validate(x));
  expect(y.dependencies).toHaveLength(0);
  expect(y.tasks[1].dependencies).toEqual([]);
});
it("rejects milestones as summary parents before persistence", () => {
  const x = p();
  x.dependencies = [];
  x.tasks[0].type = "milestone";
  x.tasks[0].end = x.tasks[0].start;
  x.tasks[1].parentId = "a";
  expect(() => validate(x)).toThrow(/里程碑.*子任务/);
});
it("zero-duration milestone consumes no extra working day in an FS chain", () => {
  const x = p();
  x.tasks[0].end = x.tasks[0].start;
  x.tasks[1].type = "milestone";
  x.tasks[1].end = x.tasks[1].start;
  x.tasks.push(
    taskSchema.parse({
      id: "c",
      name: "c",
      start: "2026-11-03",
      end: "2026-11-03",
    }),
  );
  x.dependencies.push({ id: "e", from: "b", to: "c", type: "FS", lag: 0 });
  const y = schedule(x);
  expect(y.tasks[1].start).toBe("2026-11-02");
  expect(y.tasks[2].start).toBe("2026-11-02");
  expect(cpm(y).every((t) => t.critical)).toBe(true);
});
