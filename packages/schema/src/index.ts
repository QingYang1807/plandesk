import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, "非法日期");
export const calendarSchema = z.object({
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .default([1, 2, 3, 4, 5]),
  holidays: z.array(dateSchema).default([]),
});
export const taskSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable().default(null),
  order: z.number().default(0),
  name: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["task", "phase", "milestone", "review"]).default("task"),
  phase: z.string().default(""),
  tags: z.array(z.string()).default([]),
  start: dateSchema.nullable().default(null),
  end: dateSchema.nullable().default(null),
  progress: z.number().min(0).max(100).default(0),
  status: z
    .enum(["todo", "doing", "blocked", "done", "cancelled"])
    .default("todo"),
  owner: z.string().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  autoSchedule: z.boolean().default(true),
  estimate: z.number().nonnegative().default(0),
  actualHours: z.number().nonnegative().default(0),
  actualStart: dateSchema.nullable().default(null),
  actualEnd: dateSchema.nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  deliverables: z.string().default(""),
  acceptanceCriteria: z.string().default(""),
  notes: z.string().default(""),
  risk: z.string().default(""),
});
export const dependencySchema = z.object({
  id: z.string().min(1),
  from: z.string(),
  to: z.string(),
  type: z.enum(["FS", "SS", "FF", "SF"]).default("FS"),
  lag: z.number().int().min(-3650).max(3650).default(0),
});
export const baselineSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  tasks: z.array(
    z.object({
      id: z.string(),
      start: dateSchema.nullable(),
      end: dateSchema.nullable(),
      progress: z.number(),
    }),
  ),
});
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().default(""),
  description: z.string().default(""),
  type: z.string().default("软件研发"),
  owner: z.string().default(""),
  status: z
    .enum(["planning", "active", "completed", "archived"])
    .default("planning"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  start: dateSchema,
  target: dateSchema.nullable().default(null),
  demo: z.boolean().default(false),
  updatedAt: z.string().default(""),
  createdAt: z.string().default(""),
});
export const planSchema = z.object({
  schemaVersion: z.literal(1),
  project: projectSchema,
  calendar: calendarSchema.default({ weekdays: [1, 2, 3, 4, 5], holidays: [] }),
  tasks: z.array(taskSchema).max(10000).default([]),
  dependencies: z.array(dependencySchema).default([]),
  milestones: z.array(z.string()).default([]),
  baseline: z.array(baselineSchema).default([]),
  history: z
    .array(z.object({ date: z.string(), progress: z.number() }))
    .default([]),
  revision: z.number().int().nonnegative().default(0),
});
export type Task = z.infer<typeof taskSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Calendar = z.infer<typeof calendarSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Project = z.infer<typeof projectSchema>;
