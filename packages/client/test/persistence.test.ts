import { it, expect } from "vitest";
import { planSchema } from "@plandesk/schema";
import { createWriter, ApiError } from "../src/persistence";
const plan = (id: string) =>
  planSchema.parse({
    schemaVersion: 1,
    project: { id, name: id, start: "2026-10-30" },
  });
it("serializes revisions and captures project before navigation", async () => {
  const records = new Map([
    ["a", plan("a")],
    ["b", plan("b")],
  ]);
  const saved: string[] = [];
  const writer = createWriter(
    records,
    async (p) => {
      await Promise.resolve();
      saved.push(p.project.id);
      return { ...p, revision: p.revision + 1 };
    },
    { put: () => {}, remove: () => {} },
  );
  const a = writer.write("a", (p) => ({
    ...p,
    project: { ...p.project, name: "A1" },
  }));
  const second = writer.write("a", (p) => ({
    ...p,
    project: { ...p.project, owner: "owner" },
  }));
  const b = writer.write("b", (p) => ({
    ...p,
    project: { ...p.project, name: "B1" },
  }));
  await Promise.all([a, second, b]);
  expect(saved).toEqual(["a", "a", "b"]);
  expect(records.get("a")?.project).toMatchObject({
    name: "A1",
    owner: "owner",
  });
  expect(records.get("a")?.revision).toBe(2);
  expect(records.get("b")?.project.name).toBe("B1");
});
it("a failed offline edit is included in the next successful edit", async () => {
  const records = new Map([["a", plan("a")]]);
  let online = false;
  const drafts = new Map<string, Plan>();
  const writer = createWriter(
    records,
    async (p) => {
      if (!online) throw new TypeError("offline");
      return { ...p, revision: 1 };
    },
    {
      put: (p) => drafts.set(p.project.id, p),
      remove: (id) => drafts.delete(id),
    },
  );
  await expect(
    writer.write("a", (p) => ({
      ...p,
      project: { ...p.project, name: "Kept" },
    })),
  ).rejects.toThrow("offline");
  expect(drafts.get("a")?.project.name).toBe("Kept");
  online = true;
  const result = await writer.write("a", (p) => ({
    ...p,
    project: { ...p.project, owner: "Owner" },
  }));
  expect(result.saved.project).toMatchObject({ name: "Kept", owner: "Owner" });
  expect(drafts.size).toBe(0);
});
it("validation failures preserve the saved record and retain a downloadable draft", async () => {
  const records = new Map([["a", plan("a")]]);
  const drafts = new Map<string, Plan>();
  const writer = createWriter(
    records,
    async () => {
      throw new ApiError("invalid", 400);
    },
    { put: (p) => drafts.set("a", p), remove: () => {} },
  );
  await expect(
    writer.write("a", (p) => ({ ...p, project: { ...p.project, name: "" } })),
  ).rejects.toThrow("invalid");
  expect(records.get("a")?.project.name).toBe("a");
  expect(drafts.get("a")?.project.name).toBe("");
});
import type { Plan } from "@plandesk/schema";
