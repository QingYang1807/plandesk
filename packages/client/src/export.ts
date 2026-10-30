import type { Plan } from "@plandesk/schema";
import type { Row } from "./model";
import { day, date, download, metrics, phaseColors, rowsOf } from "./model";
export type ExportOptions = {
  title: string;
  subtitle: string;
  legend: boolean;
  dependencies: boolean;
  scale: number;
  paper: "a4" | "a3";
  margin: number;
  background: string;
};
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function renderChart(p: Plan, rows: Row[], opt: ExportOptions) {
  const start =
    Math.min(
      day(p.project.start),
      ...p.tasks.flatMap((t) => (t.start ? [day(t.start)] : [])),
    ) - 2;
  const end =
    Math.max(
      start + 14,
      ...p.tasks.flatMap((t) => (t.end ? [day(t.end)] : [])),
    ) + 4;
  const span = end - start;
  const left = 410;
  const width = 1600;
  const unit = (width - left - 48) / span;
  const height = 190 + rows.length * 38 + (opt.legend ? 50 : 0);
  const y = (i: number) => 154 + i * 38;
  const positions = new Map(
    rows.map((t, i) => [
      t.id,
      {
        x: t.start ? left + (day(t.start) - start) * unit : left,
        w:
          t.start && t.end
            ? Math.max(4, (day(t.end) - day(t.start) + 1) * unit)
            : 0,
        y: y(i) + 10,
      },
    ]),
  );
  const phases = rowsOf(p)
    .filter((t) => !t.parentId)
    .map((t) => t.id);
  function color(t: Row) {
    return t.status === "done"
      ? "#83a99b"
      : phaseColors[
          Math.max(
            0,
            phases.indexOf(
              rowsOf(p).find((r) => r.wbs === t.wbs.split(".")[0])?.id ?? "",
            ),
          ) % phaseColors.length
        ];
  }
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${opt.background}"/><style>text{font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;fill:#29324c;font-size:12px}.muted{fill:#7d879c}</style><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#9aa6be"/></marker></defs><text x="32" y="45" style="font-size:25px;font-weight:700">${esc(opt.title)}</text><text x="32" y="72" class="muted">${esc(opt.subtitle)} · ${esc(p.project.code)} · ${p.project.start} — ${metrics(p).end ?? "未排期"}</text><text x="${width - 32}" y="44" text-anchor="end" style="font-size:16px;fill:#5e6ad2">PlanDesk</text><text x="${width - 32}" y="71" text-anchor="end" class="muted">完成 ${metrics(p).progress}% · ${rows.length} 个工作项</text><rect x="24" y="100" width="${width - 48}" height="40" rx="5" fill="#f0f2f8"/><text x="36" y="125">WBS / 工作分解</text><text x="310" y="125">负责人</text>`;
  for (let d = start; d <= end; d++) {
    const x = left + (d - start) * unit;
    const s = date(d);
    if (new Date(s).getUTCDate() === 1) {
      svg += `<text x="${x + 4}" y="125">${s.slice(0, 7)}</text><path d="M${x} 140V${height - 50}" stroke="#e9edf4"/>`;
    }
  }
  rows.forEach((t, i) => {
    const pos = positions.get(t.id)!;
    svg += `<rect x="24" y="${y(i) - 4}" width="${width - 48}" height="38" fill="${i % 2 === 0 ? "#fff" : "#f9fafc"}"/><text x="36" y="${y(i) + 18}" class="muted">${t.wbs}</text><text x="${90 + t.depth * 14}" y="${y(i) + 18}" style="font-weight:${t.type === "phase" ? 700 : 400}">${esc(t.name.length > Math.floor((210 - t.depth * 14) / 12) ? t.name.slice(0, Math.floor((210 - t.depth * 14) / 12) - 1) + "…" : t.name)}</text><text x="310" y="${y(i) + 18}" class="muted">${esc(t.owner)}</text>`;
    if (!t.start) return;
    if (t.type === "milestone") {
      svg += `<path d="M${pos.x} ${pos.y + 9}l7 -7 7 7 -7 7z" fill="${color(t)}"/>`;
      return;
    }
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${t.type === "phase" ? 12 : 18}" rx="${t.type === "phase" ? 2 : 5}" fill="${color(t)}" opacity="${t.type === "phase" ? 1 : 0.25}"/><rect x="${pos.x}" y="${pos.y}" width="${(pos.w * t.progress) / 100}" height="18" rx="5" fill="${color(t)}"/>`;
    const baseline = p.baseline.at(-1)?.tasks.find((b) => b.id === t.id);
    if (baseline?.start && baseline.end)
      svg += `<rect x="${left + (day(baseline.start) - start) * unit}" y="${pos.y + 22}" width="${Math.max(3, (day(baseline.end) - day(baseline.start) + 1) * unit)}" height="3" fill="#adb5c5"/>`;
  });
  if (opt.dependencies)
    p.dependencies.forEach((d) => {
      const a = positions.get(d.from),
        b = positions.get(d.to);
      if (!a?.w || !b?.w) return;
      const x = a.x + (d.type[0] === "F" ? a.w : 0),
        tx = b.x + (d.type[1] === "F" ? b.w : 0);
      svg += `<path d="M${x} ${a.y + 9}H${x + 8}V${b.y - 4}H${tx - 8}V${b.y + 9}H${tx - 2}" fill="none" stroke="#9aa6be" stroke-width="0.8" opacity=".55" marker-end="url(#arrow)"/>`;
    });
  if (opt.legend)
    svg += `<text x="36" y="${height - 20}" class="muted">■ 阶段与任务　 ◆ 里程碑　 ━ 计划基线　 • 进度为实际完成比例　 |　日期为包含首尾的工作日计划</text>`;
  return svg + "</svg>";
}
async function rasterize(svg: string, scale: number) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(Error("图表渲染失败"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(url);
    throw Error("图像尺寸超过浏览器能力，请降低倍率或改用 SVG / PDF");
  }
  context.scale(scale, scale);
  context.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return { canvas, width: img.width, height: img.height };
}
export async function exportChart(
  p: Plan,
  rows: Row[],
  format: string,
  opt: ExportOptions,
) {
  if (format === "pdf") {
    const pdf = await createPdf(p, rows, opt, async (svg) => {
      const image = await rasterize(svg, 2);
      return {
        png: image.canvas.toDataURL("image/png"),
        width: image.width,
        height: image.height,
      };
    });
    pdf.save(opt.title + ".pdf");
    return;
  }
  const svg = renderChart(p, rows, opt);
  if (format === "svg") {
    download(svg, opt.title + ".svg", "image/svg+xml");
    return;
  }
  const image = await rasterize(svg, opt.scale);
  const blob = await new Promise<Blob | null>((resolve) =>
    image.canvas.toBlob(resolve),
  );
  if (!blob) throw Error("PNG 超过浏览器画布限制，请降低倍率或选择 SVG / PDF");
  download(blob, opt.title + ".png");
}
export async function createPdf(
  p: Plan,
  rows: Row[],
  opt: ExportOptions,
  raster: (
    svg: string,
  ) => Promise<{ png: string | Uint8Array; width: number; height: number }>,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    compress: true,
    orientation: "landscape",
    unit: "mm",
    format: opt.paper,
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = Math.max(5, Math.min(30, opt.margin));
  const capacity = Math.max(
    1,
    Math.floor(
      (((pageH - margin * 2 - 5) / (pageW - margin * 2)) * 1600 - 240) / 38,
    ),
  );
  const maxRows = Math.max(
    1,
    Math.ceil(rows.length / Math.max(1, Math.ceil(rows.length / capacity))),
  );
  for (let index = 0; index < rows.length || index === 0; index += maxRows) {
    if (index) pdf.addPage();
    const image = await raster(
      renderChart(p, rows.slice(index, index + maxRows), opt),
    );
    pdf.addImage(
      image.png,
      "PNG",
      margin,
      margin,
      pageW - margin * 2,
      ((pageW - margin * 2) * image.height) / image.width,
    );
    pdf.setFontSize(8);
    pdf.text(
      `${Math.floor(index / maxRows) + 1} / ${Math.max(1, Math.ceil(rows.length / maxRows))}`,
      pageW - margin,
      pageH - 5,
      { align: "right" },
    );
  }
  return pdf;
}
