import { describe, it, expect } from "vitest";
import {
  addWork,
  duration,
  validate,
  aggregate,
  schedule,
  cpm,
  indent,
  csvExport,
  csvImport,
} from "../src/index";
import { taskSchema, planSchema } from "@plandesk/schema";
const task = (
  id: string,
  start = "2026-12-31",
  end = start,
  parentId: string | null = null,
) => taskSchema.parse({ id, name: id, start, end, parentId });
const plan = () =>
  planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "Test", start: "2026-12-31" },
    tasks: [task("a"), task("b")],
    dependencies: [{ id: "d", from: "a", to: "b", type: "FS", lag: 0 }],
  });
describe("calendar", () => {
  it("counts inclusive weekdays across year", () =>
    expect(
      duration("2026-12-31", "2027-01-04", {
        weekdays: [1, 2, 3, 4, 5],
        holidays: [],
      }),
    ).toBe(3));
  it("skips configured holidays", () =>
    expect(
      addWork("2026-12-31", 1, {
        weekdays: [1, 2, 3, 4, 5],
        holidays: ["2027-01-01"],
      }),
    ).toBe("2027-01-04"));
  it("rejects rolled-over dates", () =>
    expect(() => task("x", "2026-02-30")).toThrow());
});
describe("domain", () => {
  it("rejects cycles and duplicate ids", () => {
    const p = plan();
    p.dependencies.push({ id: "x", from: "b", to: "a", type: "FS", lag: 0 });
    expect(() => validate(p)).toThrow(/循环/);
    p.dependencies = [];
    p.tasks.push(task("a"));
    expect(() => validate(p)).toThrow(/重复/);
  });
  it("aggregates weighted child progress and range", () => {
    const p = plan();
    p.tasks = [
      task("parent"),
      { ...task("a", "2026-12-31", "2027-01-01", "parent"), progress: 100 },
      task("b", "2027-01-04", "2027-01-04", "parent"),
    ];
    p.dependencies = [];
    const result = aggregate(p);
    expect(result.tasks[0].end).toBe("2027-01-04");
    expect(result.tasks[0].progress).toBe(67);
  });
  it("schedules FS deterministically", () => {
    const p = schedule(plan());
    expect(p.tasks[1].start).toBe("2027-01-01");
    expect(schedule(p).tasks).toEqual(p.tasks);
  });
  it("honors lag and locked conflicts without mutation", () => {
    const p = plan();
    p.dependencies[0].lag = 1;
    p.tasks[1].autoSchedule = false;
    expect(() => schedule(p)).toThrow(/锁定/);
    expect(p.tasks[1].start).toBe("2026-12-31");
  });
  it("keeps unscheduled tasks unscheduled", () => {
    const p = plan();
    p.tasks[1].start = null;
    p.tasks[1].end = null;
    expect(schedule(p).tasks[1].start).toBeNull();
  });
  it("computes CPM float for parallel branches", () => {
    const p = plan();
    p.tasks = [
      task("a"),
      task("b", "2026-12-31", "2027-01-05"),
      task("c", "2026-12-31", "2027-01-06"),
    ];
    p.dependencies = [];
    const result = cpm(p);
    expect(result.find((t) => t.id === "a")?.float).toBe(4);
    expect(result.find((t) => t.id === "c")?.critical).toBe(true);
  });
  it("supports SS FF SF constraints", () => {
    for (const type of ["SS", "FF", "SF"] as const) {
      const p = plan();
      p.dependencies[0].type = type;
      expect(() => validate(schedule(p))).not.toThrow();
    }
  });
  it("indents and rejects parent cycle", () => {
    const p = plan();
    p.dependencies = [];
    expect(indent(p, ["b"], 1).tasks[1].parentId).toBe("a");
    p.tasks[0].parentId = "b";
    p.tasks[1].parentId = "a";
    expect(() => validate(p)).toThrow(/循环/);
  });
  it("CSV roundtrips hierarchy with escaped text and empty dates", () => {
    const p = plan();
    p.tasks[0].name = '架构,"方案"\n评审';
    p.tasks[1].parentId = "a";
    p.dependencies = [];
    p.tasks[1].start = null;
    p.tasks[1].end = null;
    const tasks = csvImport(csvExport(p));
    expect(tasks[0].name).toBe(p.tasks[0].name);
    expect(tasks[1].parentId).toBe("a");
    expect(tasks[1].start).toBeNull();
  });
  it("validates malformed date ranges", () => {
    const p = plan();
    p.tasks[0].end = "2026-01-01";
    expect(() => validate(p)).toThrow(/结束/);
  });
});
