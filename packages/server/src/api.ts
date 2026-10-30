import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  aggregate,
  validate,
  schedule,
  tree,
  cpm,
  indent,
  csvExport,
  csvImport,
} from "@plandesk/core";
import { planSchema, dateSchema, taskSchema } from "@plandesk/schema";
import { createPlan, templates } from "../../core/src/templates";
import type { openStore } from "./store";
export function createApi(
  store: ReturnType<typeof openStore>,
  backupDir: string,
) {
  return async function handle(request: Request) {
    const url = new URL(request.url);
    const send = (data: unknown, status = 200) =>
      Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
    try {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return send({ error: "仅允许本机同源访问" }, 403);
      const body =
        request.method === "GET" || request.method === "DELETE"
          ? undefined
          : await request.json();
      if (url.pathname === "/api/health")
        return send({
          service: "PlanDesk",
          schemaVersion: 1,
          storage: "SQLite",
          address: "127.0.0.1",
        });
      if (url.pathname === "/api/schema")
        return send(z.toJSONSchema(planSchema));
      if (url.pathname === "/api/templates") return send(templates);
      if (url.pathname === "/api/projects" && request.method === "GET")
        return send(store.list());
      if (url.pathname === "/api/projects" && request.method === "POST") {
        const input = z
          .object({
            name: z.string().min(1),
            start: dateSchema.optional(),
            template: z.string().optional(),
            plan: planSchema.optional(),
          })
          .parse(body);
        if (!input.plan && !input.start) throw Error("请提供项目开始日期");
        if (input.template && !templates.includes(input.template))
          throw Error("模板不存在");
        const p = input.plan
          ? validate(input.plan)
          : createPlan(input.name, input.start!, input.template);
        if (input.plan) {
          p.project.id = crypto.randomUUID();
          p.project.name = input.name;
          p.project.demo = false;
          p.revision = 0;
          p.history = [];
          p.project.createdAt = new Date().toISOString();
        }
        return send(store.save(p, true));
      }
      const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (match) {
        if (request.method === "DELETE") {
          store.remove(match[1]);
          return send({ ok: true });
        }
        if (request.method === "PUT") {
          const p = planSchema.parse(body);
          if (p.project.id !== match[1]) throw Error("项目 ID 不匹配");
          return send(store.save(p));
        }
        const p = store.get(match[1]);
        return p ? send(p) : send({ error: "项目不存在" }, 404);
      }
      if (url.pathname === "/api/compute") {
        const p = aggregate(validate(body));
        return send({ plan: p, rows: tree(p), cpm: cpm(p) });
      }
      if (url.pathname === "/api/schedule")
        return send(schedule(validate(body)));
      if (url.pathname === "/api/indent") {
        const input = z
          .object({
            plan: planSchema,
            ids: z.array(z.string()),
            direction: z
              .number()
              .int()
              .refine((v) => v === 1 || v === -1),
          })
          .parse(body);
        return send(indent(input.plan, input.ids, input.direction));
      }
      if (url.pathname === "/api/csv/export")
        return send({ text: csvExport(validate(body)) });
      if (url.pathname === "/api/import") {
        const input = z
          .object({
            format: z.enum(["json", "csv"]),
            text: z.string().max(16_000_000),
            plan: planSchema.optional(),
          })
          .parse(body);
        const base =
          input.plan ??
          createPlan(
            "导入项目",
            new Date().toISOString().slice(0, 10),
            "空白项目",
          );
        const p =
          input.format === "csv"
            ? planSchema.parse({
                ...base,
                tasks: csvImport(input.text),
                dependencies: [],
                baseline: [],
              })
            : validate(JSON.parse(input.text));
        return send(aggregate(validate(p)));
      }
      if (url.pathname === "/api/restore/preview") {
        const plans = z.array(planSchema).min(1).parse(body).map(validate);
        return send(plans);
      }
      if (url.pathname === "/api/restore") return send(store.restore(body));
      if (url.pathname === "/api/backup") {
        const name =
          "backup-" + new Date().toISOString().replaceAll(":", "-") + ".json";
        await mkdir(backupDir, { recursive: true });
        await writeFile(
          path.join(backupDir, name),
          JSON.stringify(store.list(), null, 2),
        );
        return send({ name });
      }
      if (url.pathname === "/api/task") return send(taskSchema.parse(body));
      return send({ error: "接口不存在" }, 404);
    } catch (error) {
      return send(
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  };
}
