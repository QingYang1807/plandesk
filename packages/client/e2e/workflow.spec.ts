import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Plan } from "@plandesk/schema";
const root = path.resolve("../..");
const evidence = path.join(root, "artifacts/screenshots");
const dir = mkdtempSync(path.join(tmpdir(), "plandesk-browser-"));
let server: ChildProcess | undefined;
async function start() {
  let log = "";
  server = spawn(
    process.execPath,
    ["--import", "tsx", "packages/server/src/index.ts"],
    {
      cwd: root,
      env: {
        ...process.env,
        PORT: "4320",
        PLANDESK_DB: path.join(dir, "e2e.sqlite"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (c) => (log += String(c)));
  server.stderr?.on("data", (c) => (log += String(c)));
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw Error("Local server failed: " + log);
    const response = await fetch("http://127.0.0.1:4320/api/health").catch(
      () => null,
    );
    if (response?.ok) {
      const health = await response.json();
      expect(health.service).toBe("PlanDesk");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error("Server did not start: " + log);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}
test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  await start();
});
test.afterAll(stop);
test("complete project lifecycle with real UI, exports and restart", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "把复杂项目，变成清晰计划。" }),
  ).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "01-workspace.png") });
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("例如：企业知识库 2.0").fill("浏览器验收项目");
  await dialog.locator("input[type=date]").fill("2026-11-02");
  await dialog.locator("select").selectOption("Web / SaaS 产品研发");
  await dialog.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "浏览器验收项目" }),
  ).toBeVisible();
  const get = async () => {
    const list = (await (await request.get("/api/projects")).json()) as Plan[];
    return list.find((p) => p.project.name === "浏览器验收项目")!;
  };
  await expect.poll(async () => (await get()).tasks.length).toBe(44);
  await page.getByRole("button", { name: "新增任务", exact: true }).click();
  await expect.poll(async () => (await get()).tasks.length).toBe(45);
  const input = page.getByRole("textbox", {
    name: "任务名称 新任务",
    exact: true,
  });
  await input.fill("验收工作包");
  await input.press("Enter");
  await expect.poll(async () => (await get()).tasks.length).toBe(46);
  const child = page.getByRole("textbox", {
    name: "任务名称 新任务",
    exact: true,
  });
  await child.fill("浏览器验证任务");
  await child.press("Tab");
  await expect
    .poll(
      async () =>
        (await get()).tasks.find((t) => t.name === "浏览器验证任务")?.parentId,
    )
    .toBeTruthy();
  // Open the real detail component; dates can also be changed directly in the grid.
  await page
    .getByRole("button", { name: "详情 浏览器验证任务", exact: true })
    .click();
  await page.getByLabel("详情计划开始").fill("2026-11-02");
  await page.getByLabel("详情计划开始").press("Tab");
  await expect
    .poll(
      async () =>
        (await get()).tasks.find((t) => t.name === "浏览器验证任务")?.start,
    )
    .toBe("2026-11-02");
  await page.getByLabel("详情计划结束").fill("2026-11-04");
  await page.getByLabel("详情计划结束").press("Tab");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await expect
    .poll(
      async () =>
        (await get()).tasks.find((t) => t.name === "浏览器验证任务")?.end,
    )
    .toBe("2026-11-04");
  await page
    .getByLabel("end 浏览器验证任务", { exact: true })
    .fill("2026-11-05");
  await page.getByLabel("end 浏览器验证任务", { exact: true }).press("Tab");
  await expect
    .poll(
      async () =>
        (await get()).tasks.find((t) => t.name === "浏览器验证任务")?.end,
    )
    .toBe("2026-11-05");
  const p = await get();
  const t = p.tasks.find((t) => t.name === "浏览器验证任务")!;
  await page.getByRole("button", { name: "定位选中", exact: true }).click();
  const resize = page.locator(`[data-resize="${t.id}"]`);
  await resize.scrollIntoViewIfNeeded();
  const box = await resize.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 3, box!.y + 10);
  await page.mouse.down();
  await page.mouse.move(box!.x + 33, box!.y + 10, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await get()).tasks.find((x) => x.id === t.id)?.end)
    .not.toBe("2026-11-05");
  await page.getByRole("button", { name: "新增任务", exact: true }).click();
  await expect.poll(async () => (await get()).tasks.length).toBe(47);
  const next = page.getByRole("textbox", {
    name: "任务名称 新任务",
    exact: true,
  });
  await next.fill("交付里程碑");
  await next.press("Tab");
  await page
    .getByRole("button", { name: "详情 交付里程碑", exact: true })
    .click();
  await page
    .locator(".detail-panel")
    .getByLabel("任务类型", { exact: true })
    .selectOption("milestone");
  await page.getByLabel("详情计划开始").fill("2026-11-02");
  await page.getByLabel("详情计划开始").press("Tab");
  await page.getByLabel("前置任务").selectOption(t.id);
  await page.getByRole("button", { name: "添加依赖", exact: true }).click();
  await expect.poll(async () => (await get()).dependencies.length).toBe(37);
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "视图设置", exact: true }).click();
  await page.getByRole("button", { name: "执行自动排期", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await get()).tasks.find((x) => x.name === "交付里程碑")?.start,
    )
    .not.toBe("2026-11-02");
  await page
    .getByRole("button", { name: "详情 浏览器验证任务", exact: true })
    .click();
  await page
    .locator(".detail-panel")
    .getByLabel("完成进度 %", { exact: true })
    .fill("65");
  await page
    .locator(".detail-panel")
    .getByLabel("完成进度 %", { exact: true })
    .press("Tab");
  await expect
    .poll(async () => (await get()).tasks.find((x) => x.id === t.id)?.progress)
    .toBe(65);
  await page.getByRole("button", { name: "关闭详情" }).click();
  for (const [name, file] of [
    ["甘特图", "02-gantt"],
    ["工作分解", "03-wbs"],
    ["路线图", "04-roadmap"],
    ["看板", "05-kanban"],
    ["项目概览", "06-overview"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.screenshot({ path: path.join(evidence, file + ".png") });
  }
  await page.getByRole("button", { name: "看板", exact: true }).click();
  await expect(
    page.getByRole("button").filter({ hasText: "浏览器验证任务" }).first(),
  ).toContainText("65%");
  await page.getByRole("button", { name: "导出报告", exact: true }).click();
  for (const format of ["SVG", "PNG", "PDF", "JSON"]) {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const file = await dl;
    await file.saveAs(
      path.join(root, "artifacts/browser-export." + format.toLowerCase()),
    );
  }
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  const before = await get();
  await stop();
  await start();
  await page.reload();
  await expect
    .poll(async () => (await get()).tasks.length)
    .toBe(before.tasks.length);
  await page.getByRole("button", { name: "导入项目", exact: true }).click();
  await page.getByLabel("导入内容").fill(JSON.stringify(before));
  await page.getByRole("button", { name: "验证与预览", exact: true }).click();
  await expect(page.locator(".preview-box")).toContainText("47 个工作项");
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "浏览器验收项目（导入）", exact: true }),
  ).toBeVisible();
  const list = (await (await request.get("/api/projects")).json()) as Plan[];
  const imported = list.find(
    (p) => p.project.name === "浏览器验收项目（导入）",
  )!;
  expect(imported.tasks).toEqual(before.tasks);
  expect(imported.dependencies).toEqual(before.dependencies);
  expect(errors).toEqual([]);
});
