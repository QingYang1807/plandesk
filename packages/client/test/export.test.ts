import { it, expect } from "vitest";
import { planSchema } from "@plandesk/schema";
import { renderChart } from "../src/export";
import { rowsOf } from "../src/model";
const opt = {
  title: "R&D <report>",
  subtitle: "Roadmap & delivery",
  legend: true,
  dependencies: true,
  scale: 2,
  paper: "a3" as const,
  margin: 12,
  background: "#fff",
};
it("escapes project data and renders every row in a full chart", () => {
  const p = planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "p", code: "R&D <1>", start: "2026-10-30" },
    tasks: Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      name: "任务 & " + i,
      owner: "A&B",
      order: i,
      start: "2026-10-30",
      end: "2026-11-02",
    })),
  });
  const svg = renderChart(p, rowsOf(p), opt);
  expect(svg).toContain("R&amp;D &lt;1&gt;");
  expect(svg).toContain("任务 &amp; 59");
  expect(svg).toContain('height="2520"');
  expect(svg).not.toContain("A&B");
});
it("uses the same full-project date range on all PDF row pages", () => {
  const p = planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "p", start: "2026-01-01" },
    tasks: [
      { id: "a", name: "Jan", start: "2026-01-05", end: "2026-01-09" },
      { id: "b", name: "Dec", start: "2026-12-01", end: "2026-12-05" },
    ],
  });
  const rows = rowsOf(p);
  const a = renderChart(p, [rows[0]], opt),
    b = renderChart(p, [rows[1]], opt);
  expect(a).toContain("2026-12</text>");
  expect(b).toContain("2026-02</text>");
});
import { axisBands } from "../src/model";
it("uses calendar months and ISO weeks across the year boundary", () => {
  const bands = axisBands(
    Math.floor(Date.parse("2026-12-28") / 86400000),
    Math.floor(Date.parse("2027-01-08") / 86400000),
    "周",
  );
  expect(bands.bottom.map((b) => b.label)).toEqual(["W53", "W1"]);
  expect(bands.top.map((b) => b.label)).toEqual([
    "2026 年 12 月",
    "2027 年 1 月",
  ]);
});
