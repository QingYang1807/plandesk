import type { Plan } from "@plandesk/schema";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export class WriteError extends Error {
  constructor(
    message: string,
    public pending: Plan | null,
  ) {
    super(message);
  }
}
// Serializes writes, but binds every edit to its project even after navigation.
export function createWriter(
  records: Map<string, Plan>,
  save: (plan: Plan) => Promise<Plan>,
  drafts: { put: (p: Plan) => void; remove: (id: string) => void },
) {
  let tail = Promise.resolve();
  return {
    write(id: string, edit: (p: Plan) => Plan | Promise<Plan>) {
      const job = tail.then(async () => {
        const stored = records.get(id);
        if (!stored) throw Error("项目不存在");
        const before = structuredClone(stored);
        const next = await edit(structuredClone(before));
        next.tasks.forEach((t) => {
          t.dependencies = next.dependencies
            .filter((d) => d.to === t.id)
            .map((d) => d.from);
        });
        next.revision = before.revision;
        drafts.put(next);
        try {
          const saved = await save(next);
          records.set(id, saved);
          drafts.remove(id);
          return { before, saved };
        } catch (error) {
          const pending =
            error instanceof TypeError ||
            (error instanceof ApiError && error.status >= 500)
              ? next
              : null;
          if (pending) records.set(id, pending);
          throw new WriteError(
            error instanceof Error ? error.message : String(error),
            pending,
          );
        }
      });
      tail = job.then(
        () => {},
        () => {},
      );
      return job;
    },
  };
}
