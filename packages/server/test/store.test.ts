import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../src/store";
import { planSchema } from "@plandesk/schema";
it("persists across restart, rejects stale revisions and invalid updates atomically", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "plandesk-"));
  const filename = path.join(dir, "test.sqlite");
  let store = openStore(filename);
  const input = planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "Persistent", start: "2026-10-30" },
  });
  const saved = store.save(input, true);
  expect(saved.revision).toBe(1);
  store.close();
  store = openStore(filename);
  expect(store.get("p")?.project.name).toBe("Persistent");
  expect(() => store.save(input)).toThrow(/版本冲突/);
  expect(() =>
    store.save({ ...saved, tasks: [{ id: "x", name: "x", start: "bad" }] }),
  ).toThrow();
  expect(store.get("p")?.revision).toBe(1);
  store.close();
  rmSync(dir, { recursive: true });
});
it("rejects a milestone parent without inserting invalid aggregate", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "plandesk-milestone-"));
  const store = openStore(path.join(dir, "db"));
  const p = planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "Invalid", start: "2026-11-02" },
    tasks: [
      {
        id: "m",
        name: "milestone",
        type: "milestone",
        start: "2026-11-02",
        end: "2026-11-02",
      },
      {
        id: "c",
        name: "child",
        parentId: "m",
        start: "2026-11-02",
        end: "2026-11-04",
      },
    ],
  });
  expect(() => store.save(p, true)).toThrow(/里程碑.*子任务/);
  expect(store.list()).toHaveLength(0);
  store.close();
  rmSync(dir, { recursive: true });
});
it("restores a whole backup atomically and assigns independent project ids", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "plandesk-restore-"));
  const store = openStore(path.join(dir, "db"));
  const p = planSchema.parse({
    schemaVersion: 1,
    project: { id: "p", name: "Original", start: "2026-11-02" },
  });
  store.save(p, true);
  const restored = store.restore([p, p]);
  expect(restored[0].project.id).not.toBe(restored[1].project.id);
  expect(store.list()).toHaveLength(3);
  expect(() => store.restore([p, { bad: true }])).toThrow();
  expect(store.list()).toHaveLength(3);
  store.close();
  rmSync(dir, { recursive: true });
});
