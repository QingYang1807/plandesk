import { createPlan, templates } from "../packages/core/src/templates";
import { renderChart, createPdf } from "../packages/client/src/export";
import { rowsOf } from "../packages/client/src/model";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
const p = createPlan(
  "AI 企业智能应用平台研发项目",
  "2026-10-01",
  templates[0],
  true,
);
const opt = {
  title: p.project.name,
  subtitle: "完整计划 · 演示数据 · 工期为初始建议",
  legend: true,
  dependencies: true,
  scale: 2,
  paper: "a3" as const,
  margin: 12,
  background: "#ffffff",
};
await writeFile(
  "examples/ai-enterprise-platform.json",
  JSON.stringify(p, null, 2),
);
const rows = rowsOf(p);
const svg = renderChart(p, rows, opt);
await writeFile("artifacts/demo-gantt.svg", svg);
await sharp(Buffer.from(svg)).png().toFile("artifacts/demo-gantt.png");
const pdf = await createPdf(p, rows, opt, async (svg) => {
  const result = await sharp(Buffer.from(svg))
    .resize({ width: 3200 })
    .png()
    .toBuffer({ resolveWithObject: true });
  return {
    png: result.data,
    width: result.info.width,
    height: result.info.height,
  };
});
await writeFile(
  "artifacts/demo-gantt.pdf",
  Buffer.from(pdf.output("arraybuffer")),
);
const executive = rows.filter((t) => !t.parentId || t.type === "milestone");
await writeFile(
  "artifacts/demo-roadmap.svg",
  renderChart(p, executive, { ...opt, title: "AI 平台 · 交付路线图" }),
);
await sharp(Buffer.from(renderChart(p, executive, opt)))
  .png()
  .toFile("artifacts/demo-roadmap.png");
console.log(
  JSON.stringify({
    tasks: rows.length,
    phases: rows.filter((t) => !t.parentId).length,
    milestones: p.milestones.length,
    dependencies: p.dependencies.length,
    pdfPages: pdf.getNumberOfPages(),
  }),
);
