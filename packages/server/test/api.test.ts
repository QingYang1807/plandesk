import { it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApi } from "../src/api";
import { openStore } from "../src/store";
import { planSchema, taskSchema } from "@plandesk/schema";
import type { Plan } from "@plandesk/schema";
it("real API CRUD scheduling baseline JSON import and restart persistence", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "plandesk-api-"));
  const file = path.join(dir, "db.sqlite");
  let store = openStore(file);
  let handle = createApi(store, path.join(dir, "backups"));
  async function call(
    url: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) {
    return handle(
      new Request("http://127.0.0.1:4318/api/" + url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  }
  const result = await call("projects", {
    name: "Real flow",
    start: "2026-10-30",
    template: "Web / SaaS 产品研发",
  });
  expect(result.status).toBe(200);
  let p = planSchema.parse(await result.json());
  expect(p.tasks).toHaveLength(44);
  const id = p.project.id;
  p.tasks.push(
    taskSchema.parse({
      id: "extra",
      name: "Added task",
      start: "2026-11-02",
      end: "2026-11-04",
      order: 100,
    }),
  );
  p = planSchema.parse(await (await call("projects/" + id, p, "PUT")).json());
  p.baseline.push({
    id: "base",
    name: "Original",
    createdAt: new Date().toISOString(),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      start: t.start,
      end: t.end,
      progress: t.progress,
    })),
  });
  p.tasks.find((t) => t.id === "extra")!.end = "2026-11-06";
  p = planSchema.parse(await (await call("projects/" + id, p, "PUT")).json());
  expect(p.baseline[0].tasks.find((t) => t.id === "extra")?.end).toBe(
    "2026-11-04",
  );
  const invalid = {
    ...p,
    dependencies: [
      ...p.dependencies,
      { id: "self", from: "extra", to: "extra", type: "FS", lag: 0 },
    ],
  };
  expect((await call("projects/" + id, invalid, "PUT")).status).toBe(400);
  expect(store.get(id)?.revision).toBe(p.revision);
  const parsed = planSchema.parse(
    await (
      await call("import", { format: "json", text: JSON.stringify(p) })
    ).json(),
  );
  const copy = planSchema.parse(
    await (await call("projects", { name: "Roundtrip", plan: parsed })).json(),
  );
  expect(copy.project.id).not.toBe(id);
  expect(copy.tasks).toEqual(p.tasks);
  expect(copy.dependencies).toEqual(p.dependencies);
  const backup = (await (await call("backup", {})).json()) as { name: string };
  expect(
    JSON.parse(readFileSync(path.join(dir, "backups", backup.name), "utf8")),
  ).toHaveLength(2);
  store.close();
  store = openStore(file);
  handle = createApi(store, path.join(dir, "backups"));
  expect(
    ((await (await call("projects/" + id)).json()) as Plan).tasks.find(
      (t) => t.id === "extra",
    )?.end,
  ).toBe("2026-11-06");
  store.close();
  rmSync(dir, { recursive: true });
});
it("invalid import is read-only and cross-origin writes fail", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "plandesk-api-"));
  const store = openStore(path.join(dir, "db"));
  const handle = createApi(store, dir);
  const invalid = await handle(
    new Request("http://127.0.0.1:4318/api/import", {
      method: "POST",
      body: JSON.stringify({ format: "json", text: '{"broken":true}' }),
    }),
  );
  expect(invalid.status).toBe(400);
  expect(store.list()).toHaveLength(0);
  const denied = await handle(
    new Request("http://127.0.0.1:4318/api/projects", {
      method: "POST",
      headers: { Origin: "https://example.com" },
      body: "{}",
    }),
  );
  expect(denied.status).toBe(403);
  store.close();
  rmSync(dir, { recursive: true });
});
