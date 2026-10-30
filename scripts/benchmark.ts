import { taskSchema, planSchema } from "@plandesk/schema";
import { schedule, cpm, tree } from "@plandesk/core";
const p = planSchema.parse({
  schemaVersion: 1,
  project: { id: "benchmark", name: "1000 task chain", start: "2026-10-30" },
  tasks: Array.from({ length: 1000 }, (_, i) =>
    taskSchema.parse({
      id: String(i),
      name: "Task " + i,
      start: "2026-10-30",
      end: "2026-10-30",
      order: i,
    }),
  ),
  dependencies: Array.from({ length: 999 }, (_, i) => ({
    id: "dep-" + i,
    from: String(i),
    to: String(i + 1),
    type: "FS",
    lag: 0,
  })),
});
const start = performance.now();
const scheduled = schedule(p);
const schedulingMs = performance.now() - start;
const next = performance.now();
const critical = cpm(scheduled);
const cpmMs = performance.now() - next;
console.log(
  JSON.stringify(
    {
      node: process.version,
      tasks: tree(scheduled).length,
      dependencies: p.dependencies.length,
      schedulingMs: Number(schedulingMs.toFixed(2)),
      cpmMs: Number(cpmMs.toFixed(2)),
      criticalCount: critical.filter((t) => t.critical).length,
      browserRendering: "not measured",
    },
    null,
    2,
  ),
);
