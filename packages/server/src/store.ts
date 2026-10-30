import { z } from "zod";
import { planSchema } from "@plandesk/schema";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { aggregate, validate, projectProgress } from "@plandesk/core";
import type { Plan } from "@plandesk/schema";
export function openStore(filename: string) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS project (id TEXT PRIMARY KEY, document TEXT NOT NULL, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY, project_id TEXT NOT NULL, created_at TEXT NOT NULL, document TEXT NOT NULL); PRAGMA user_version=1;",
  );
  return {
    db,
    list: () =>
      db
        .prepare("SELECT document FROM project")
        .all()
        .map((r) => JSON.parse(String(r.document)) as Plan),
    get: (id: string) => {
      const r = db.prepare("SELECT document FROM project WHERE id=?").get(id);
      return r ? (JSON.parse(String(r.document)) as Plan) : undefined;
    },
    save: (input: unknown, create = false) => {
      const p = validate(aggregate(validate(input)));
      const row = db
        .prepare("SELECT revision, document FROM project WHERE id=?")
        .get(p.project.id);
      if (create && row) throw Error("项目 ID 已存在");
      if (row && row.revision !== p.revision)
        throw Error("版本冲突：项目已由另一窗口更新，请先导出草稿再刷新。");
      p.revision = (row ? Number(row.revision) : 0) + 1;
      p.project.updatedAt = new Date().toISOString();
      const progress = projectProgress(p);
      const today = new Date().toISOString().slice(0, 10);
      p.history = [
        ...p.history.filter((h) => h.date !== today),
        { date: today, progress },
      ].slice(-365);
      db.exec("BEGIN IMMEDIATE");
      try {
        if (row)
          db.prepare(
            "INSERT INTO snapshot (project_id,created_at,document) VALUES (?,?,?)",
          ).run(p.project.id, p.project.updatedAt, String(row.document));
        db.prepare(
          "INSERT INTO project VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document, revision=excluded.revision",
        ).run(p.project.id, JSON.stringify(p), p.revision);
        db.prepare(
          "DELETE FROM snapshot WHERE project_id=? AND id NOT IN (SELECT id FROM snapshot WHERE project_id=? ORDER BY id DESC LIMIT 100)",
        ).run(p.project.id, p.project.id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return p;
    },
    restore: (input: unknown) => {
      const plans = z
        .array(planSchema)
        .min(1)
        .parse(input)
        .map((input) => {
          const p = validate(aggregate(validate(input)));
          p.project.id = crypto.randomUUID();
          p.project.name += "（恢复）";
          p.project.updatedAt = new Date().toISOString();
          p.revision = 1;
          return p;
        });
      db.exec("BEGIN IMMEDIATE");
      try {
        plans.forEach((p) =>
          db
            .prepare("INSERT INTO project VALUES (?,?,?)")
            .run(p.project.id, JSON.stringify(p), p.revision),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return plans;
    },
    remove: (id: string) =>
      db.prepare("DELETE FROM project WHERE id=?").run(id),
    close: () => db.close(),
  };
}
